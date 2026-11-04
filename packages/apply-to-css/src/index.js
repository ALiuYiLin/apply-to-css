import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'
import { expandApplyRules, findDefaultTheme } from './tailwind.js'
import { ApplyTransformError, transformStyleCss } from './transform.js'
import { resolveStylesheetFile } from './resolve.js'
import {
  detectEol,
  findStyleBlocks,
  normalizeEol,
  replaceStyleBlocks,
  restoreEol,
} from './sfc.js'

/**
 * @typedef {object} ConvertFileResult
 * @property {string} file Absolute path.
 * @property {boolean} changed Whether the source needs to be written.
 * @property {number} applyCount Number of expanded `@apply` rules.
 * @property {number} declarationCount Number of generated declarations.
 * @property {number} generatedCount Number of extra (variant/at-rule) rules.
 * @property {boolean} referenceRemoved Whether a dangling `@reference` was removed.
 * @property {string} [output] Converted source (present when `emitOutput` is true).
 * @property {string[]} warnings
 */

/**
 * Convert Tailwind `@apply` usage in `<style>` blocks of Vue SFCs.
 *
 * @param {object} options
 * @param {string[]} options.files Absolute paths to `.vue` files.
 * @param {string} [options.cwd] Project root (used for fallback theme lookup).
 * @param {string} [options.css] Fallback Tailwind entry (absolute or relative to cwd).
 * @param {boolean} [options.write] Write converted files to disk.
 * @param {boolean} [options.removeReference] Remove `@reference` when nothing else needs Tailwind.
 * @param {boolean} [options.emitOutput] Include converted source in results.
 * @returns {Promise<{
 *   files: ConvertFileResult[],
 *   changedFiles: number,
 *   applyCount: number,
 *   declarationCount: number,
 *   generatedCount: number,
 *   warnings: string[],
 *   errors: Array<{ file: string, line?: number, message: string }>,
 * }>}
 */
export async function convertFiles({
  files,
  cwd = process.cwd(),
  css,
  write = false,
  removeReference = true,
  emitOutput = false,
} = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('convertFiles: at least one file is required')
  }

  const fallbackTheme = resolveFallbackTheme(cwd, css)
  const warnings = []
  const errors = []
  const results = []

  /** @type {Map<string, { requests: Map<string, { params: string, meta: object }> }>} */
  const themeGroups = new Map()
  /** @type {Array<{ file: string, eol: string, normalized: string, blocks: object[] }>} */
  const fileRecords = []

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8')
    const eol = detectEol(raw)
    const source = normalizeEol(raw)
    const blocks = findStyleBlocks(source)

    const record = { file, eol, normalized: source, blocks: [] }

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

      let root
      try {
        root = postcss.parse(block.content, { from: file })
      } catch (error) {
        const line = error.line ? block.contentStartLine + error.line - 1 : undefined
        errors.push({
          file,
          line,
          message: `Failed to parse <style> block: ${error.reason ?? error.message}`,
        })
        continue
      }

      const applies = []
      root.walkAtRules((atRule) => {
        if (atRule.name.toLowerCase() !== 'apply') return
        applies.push({
          params: atRule.params.trim(),
          line: block.contentStartLine + (atRule.source?.start?.line ?? 1) - 1,
        })
      })

      if (applies.length === 0) continue

      let themeFile
      try {
        themeFile = resolveThemeForBlock(root, file, fallbackTheme)
      } catch (error) {
        errors.push({ file, message: error.message })
        continue
      }

      const group = themeGroups.get(themeFile) ?? { requests: new Map() }
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

  /** @type {Map<string, { rules: Map<string, import('postcss').Rule>, propertyDefaults: Map<string, string> }>} */
  const expansionsByTheme = new Map()

  for (const [themeFile, group] of themeGroups) {
    try {
      const expanded = await expandApplyRules(themeFile, [...group.requests.values()])
      expansionsByTheme.set(themeFile, expanded)
    } catch (error) {
      const firstRequest = error.requests?.[0]
      errors.push({
        file: firstRequest?.meta?.file ?? themeFile,
        line: firstRequest?.meta?.line,
        message: error.message,
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
        const line = error instanceof ApplyTransformError && error.line
          ? block.contentStartLine + error.line - 1
          : undefined
        errors.push({
          file: record.file,
          line,
          message: error.message,
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

function resolveFallbackTheme(cwd, css) {
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

function resolveThemeForBlock(root, file, fallbackTheme) {
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

function findReference(root) {
  let reference = null
  root.walkAtRules((atRule) => {
    if (reference || atRule.name.toLowerCase() !== 'reference') return
    const value = atRule.params.trim().replace(/^url\(\s*/, '').replace(/\s*\)$/, '')
    reference = value.replace(/^['"]|['"]$/g, '')
  })
  return reference
}

function relative(cwd, file) {
  const value = path.relative(cwd, file)
  return value.startsWith('..') ? file : value.replaceAll('\\', '/')
}
