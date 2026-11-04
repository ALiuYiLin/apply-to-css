import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import { CssSyntaxError } from 'postcss'
import type { Root } from 'postcss'
import { ApplyExpansionError, expandApplyRules, findDefaultTheme } from './tailwind.js'
import type { ApplyExpansion, ApplyRequest } from './tailwind.js'
import { ApplyTransformError, transformStyleCss } from './transform.js'
import { resolveStylesheetFile } from './resolve.js'
import { detectEol, findStyleBlocks, normalizeEol, replaceStyleBlocks, restoreEol } from './sfc.js'
import type { StyleBlock } from './sfc.js'

/** Per-file outcome of {@link convertFiles}. */
export interface ConvertFileResult {
  /** Absolute path. */
  file: string
  /** Whether the source needs to be written. */
  changed: boolean
  /** Number of expanded `@apply` rules. */
  applyCount: number
  /** Number of generated declarations. */
  declarationCount: number
  /** Number of extra (variant/at-rule) rules. */
  generatedCount: number
  /** Whether a dangling `@reference` was removed. */
  referenceRemoved: boolean
  /** Converted source (present when `emitOutput` is true). */
  output?: string
}

/** One conversion error, with a best-effort source location. */
export interface ConvertError {
  file: string
  line?: number
  message: string
}

/** Aggregate result of {@link convertFiles}. */
export interface ConvertResult {
  files: ConvertFileResult[]
  changedFiles: number
  applyCount: number
  declarationCount: number
  generatedCount: number
  warnings: string[]
  errors: ConvertError[]
}

/** Options accepted by {@link convertFiles}. */
export interface ConvertOptions {
  /** Absolute paths to `.vue` files. */
  files: string[]
  /** Project root (used for fallback theme lookup). */
  cwd?: string
  /** Fallback Tailwind entry (absolute or relative to `cwd`). */
  css?: string
  /** Write converted files to disk. */
  write?: boolean
  /** Remove `@reference` when nothing else needs Tailwind. */
  removeReference?: boolean
  /** Include converted source in results. */
  emitOutput?: boolean
}

/** One `@apply` rule found while scanning a style block. */
interface ApplyCall {
  params: string
  line: number
}

/** A style block that needs conversion, plus its resolved theme. */
interface BlockRecord {
  block: StyleBlock
  applies: ApplyCall[]
  themeFile: string
}

/** A Vue file that contains style blocks needing conversion. */
interface FileRecord {
  file: string
  eol: string
  normalized: string
  blocks: BlockRecord[]
}

/** Unique `@apply` requests grouped by Tailwind theme. */
interface ThemeGroup {
  requests: Map<string, ApplyRequest>
}

/**
 * Convert Tailwind `@apply` usage in `<style>` blocks of Vue SFCs.
 */
export async function convertFiles(options: ConvertOptions): Promise<ConvertResult> {
  if (!options || typeof options !== 'object') {
    throw new Error('convertFiles: at least one file is required')
  }

  const {
    files,
    cwd = process.cwd(),
    css,
    write = false,
    removeReference = true,
    emitOutput = false,
  } = options

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('convertFiles: at least one file is required')
  }

  const fallbackTheme = resolveFallbackTheme(cwd, css)
  const warnings: string[] = []
  const errors: ConvertError[] = []
  const results: ConvertFileResult[] = []

  const themeGroups = new Map<string, ThemeGroup>()
  const fileRecords: FileRecord[] = []

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    const eol = detectEol(raw)
    const source = normalizeEol(raw)
    const blocks = findStyleBlocks(source)

    const record: FileRecord = { file, eol, normalized: source, blocks: [] }

    for (const block of blocks) {
      if (block.external) {
        warnings.push(`${relative(cwd, file)}: skipped <style src> block`)
        continue
      }

      if (block.lang !== 'css' && block.lang !== 'postcss') {
        if (block.content.includes('@apply')) {
          warnings.push(
            `${relative(cwd, file)}: skipped <style lang="${block.lang}"> block (only plain CSS is supported)`,
          )
        }
        continue
      }

      if (!block.content.includes('@apply')) continue

      let root: Root
      try {
        root = postcss.parse(block.content, { from: file })
      } catch (error) {
        const line = parseErrorLine(error)
        errors.push({
          file,
          line: line ? block.contentStartLine + line - 1 : undefined,
          message: `Failed to parse <style> block: ${parseErrorMessage(error)}`,
        })
        continue
      }

      const applies: ApplyCall[] = []
      root.walkAtRules((atRule) => {
        if (atRule.name.toLowerCase() !== 'apply') return
        applies.push({
          params: atRule.params.trim(),
          line: block.contentStartLine + (atRule.source?.start?.line ?? 1) - 1,
        })
      })

      if (applies.length === 0) continue

      let themeFile: string
      try {
        themeFile = resolveThemeForBlock(root, file, fallbackTheme)
      } catch (error) {
        errors.push({ file, message: errorMessage(error) })
        continue
      }

      const group = themeGroups.get(themeFile) ?? { requests: new Map<string, ApplyRequest>() }
      for (const apply of applies) {
        const existing = group.requests.get(apply.params)
        if (existing) {
          existing.meta.occurrences++
        } else {
          group.requests.set(apply.params, {
            params: apply.params,
            meta: {
              file,
              line: apply.line,
              location: `${relative(cwd, file)}:${apply.line}`,
              occurrences: 1,
            },
          })
        }
      }
      themeGroups.set(themeFile, group)

      record.blocks.push({ block, applies, themeFile })
    }

    fileRecords.push(record)
  }

  const expansionsByTheme = new Map<string, ApplyExpansion>()

  for (const [themeFile, group] of themeGroups) {
    try {
      const expanded = await expandApplyRules(themeFile, [...group.requests.values()])
      expansionsByTheme.set(themeFile, expanded)
    } catch (error) {
      const firstRequest = error instanceof ApplyExpansionError ? error.requests[0] : undefined
      errors.push({
        file: firstRequest?.meta.file ?? themeFile,
        line: firstRequest?.meta.line,
        message: errorMessage(error),
      })
    }
  }

  let totalApplyCount = 0
  let totalDeclarationCount = 0
  let totalGeneratedCount = 0
  let changedFiles = 0

  for (const record of fileRecords) {
    if (record.blocks.length === 0) continue

    const contents = record.blocks.map(({ block }) => block.content)
    let fileChanged = false
    let fileHasError = false
    let fileApplyCount = 0
    let fileDeclarations = 0
    let fileGenerated = 0
    let referenceRemoved = false

    for (let index = 0; index < record.blocks.length; index++) {
      const { block, themeFile } = record.blocks[index]
      const themeExpansion = expansionsByTheme.get(themeFile)

      if (!themeExpansion) {
        // The theme batch failed; the error was reported above.
        contents[index] = block.content
        fileHasError = true
        continue
      }

      let transformed
      try {
        transformed = transformStyleCss(block.content, {
          from: record.file,
          removeReference,
          propertyDefaults: themeExpansion.propertyDefaults,
          expansionFor: (params) => themeExpansion.rules.get(params.trim()),
        })
      } catch (error) {
        const line =
          error instanceof ApplyTransformError && error.line
            ? block.contentStartLine + error.line - 1
            : undefined
        errors.push({
          file: record.file,
          line,
          message: errorMessage(error),
        })
        fileHasError = true
        continue
      }

      contents[index] = transformed.css
      fileApplyCount += transformed.applyCount
      fileDeclarations += transformed.declarationCount
      fileGenerated += transformed.generatedCount
      referenceRemoved ||= transformed.referenceRemoved

      if (transformed.css !== block.content) fileChanged = true
    }

    const output = replaceStyleBlocks(record.normalized, record.blocks.map((entry) => entry.block), contents)
    const finalOutput = restoreEol(fileHasError ? record.normalized : output, record.eol)

    if (fileHasError) {
      // Never leave a file half-converted when one of its blocks failed.
      fileChanged = false
      fileApplyCount = 0
      fileDeclarations = 0
      fileGenerated = 0
      referenceRemoved = false
    }

    if (fileChanged && write) {
      fs.writeFileSync(record.file, finalOutput, 'utf8')
    }

    if (fileChanged) changedFiles++
    totalApplyCount += fileApplyCount
    totalDeclarationCount += fileDeclarations
    totalGeneratedCount += fileGenerated
    results.push({
      file: record.file,
      changed: fileChanged,
      applyCount: fileApplyCount,
      declarationCount: fileDeclarations,
      generatedCount: fileGenerated,
      referenceRemoved,
      ...(emitOutput ? { output: finalOutput } : {}),
    })
  }

  return {
    files: results,
    changedFiles,
    applyCount: totalApplyCount,
    declarationCount: totalDeclarationCount,
    generatedCount: totalGeneratedCount,
    warnings,
    errors,
  }
}

function resolveFallbackTheme(cwd: string, css: string | undefined): string | null {
  if (css) {
    const absolute = path.resolve(cwd, css)
    if (!fs.existsSync(absolute)) {
      throw new Error(`Tailwind stylesheet not found: ${absolute}`)
    }
    return fs.realpathSync(absolute)
  }

  const detected = findDefaultTheme(cwd)
  return detected ? fs.realpathSync(detected) : null
}

function resolveThemeForBlock(root: Root, file: string, fallbackTheme: string | null): string {
  const reference = findReference(root)

  if (!reference) {
    if (!fallbackTheme) {
      throw new Error(
        'no `@reference` directive found; add one to the <style> block or pass --css <tailwind-entry>.',
      )
    }
    return fallbackTheme
  }

  const resolved = resolveStylesheetFile(reference, path.dirname(file))
  return fs.realpathSync(resolved)
}

function findReference(root: Root): string | null {
  let reference: string | null = null
  root.walkAtRules((atRule) => {
    if (reference || atRule.name.toLowerCase() !== 'reference') return
    const value = atRule.params.trim().replace(/^url\(\s*/, '').replace(/\s*\)$/, '')
    reference = value.replace(/^['"]|['"]$/g, '')
  })
  return reference
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof CssSyntaxError) return error.reason
  return errorMessage(error)
}

function parseErrorLine(error: unknown): number | undefined {
  return error instanceof CssSyntaxError ? error.line : undefined
}

function relative(cwd: string, file: string): string {
  const value = path.relative(cwd, file)
  return value.startsWith('..') ? file : value.replaceAll('\\', '/')
}
