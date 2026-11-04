import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { compile } from 'tailwindcss'
import postcss from 'postcss'
import type { AtRule, Container, Document, Root, Rule } from 'postcss'
import { childNodes, isAtRule, isRoot, isRule } from './ast.js'
import type { AtRuleInfo } from './ast.js'
import { splitSelectors } from './selectors.js'
import { readTextFile, resolveModuleFile, resolveStylesheetFile } from './resolve.js'

/** One unique `@apply` parameter string and where it was first seen. */
export interface ApplyRequest {
  params: string
  meta: ApplyRequestMeta
}

/** Source metadata used to report expansion failures. */
export interface ApplyRequestMeta {
  file: string
  line: number
  location: string
  occurrences: number
}

/** Output of expanding a batch of `@apply` rules against one theme. */
export interface ApplyExpansion {
  /** Synthetic rule per `@apply` parameter string. */
  rules: Map<string, Rule>
  /** `@property` initial values, used as `var()` fallbacks. */
  propertyDefaults: Map<string, string>
}

/** Thrown when Tailwind cannot expand one or more `@apply` rules. */
export class ApplyExpansionError extends Error {
  /** Tailwind entry the expansion failed against. */
  readonly themeFile: string | undefined
  /** Requests that could not be expanded (when known). */
  readonly requests: ApplyRequest[]

  constructor(
    message: string,
    options: { themeFile?: string; cause?: unknown; requests?: ApplyRequest[] } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = 'ApplyExpansionError'
    this.themeFile = options.themeFile
    this.requests = options.requests ?? []
  }
}

/** Read a stylesheet for Tailwind's `loadStylesheet` hook. */
async function loadStylesheet(
  id: string,
  base: string,
): Promise<{ path: string; base: string; content: string }> {
  const file = resolveStylesheetFile(id, base, { fallbackToToolRoot: true })
  return { path: file, base: path.dirname(file), content: readTextFile(file) }
}

/**
 * Resolve a JS/TS module for Tailwind's `loadModule` hook.
 *
 * The dynamic import intentionally types the loaded value as `any`: a plugin or
 * config module can be ESM (default export) or CJS (module object), and the
 * resolved `Plugin | Config` union declared by Tailwind cannot be expressed for
 * an id only known at runtime.
 */
async function loadModule(
  id: string,
  base: string,
): Promise<{ path: string; base: string; module: any }> {
  const file = resolveModuleFile(id, base)
  const imported: any = await import(pathToFileURL(file).href)
  return { path: file, base: path.dirname(file), module: imported.default ?? imported }
}

const COMPILE_OPTIONS = { loadStylesheet, loadModule }

/** One `@apply` output captured as a synthetic, possibly nested rule. */
interface CompiledExpansion {
  rules: Map<number, Rule>
  propertyDefaults: Map<string, string>
  output: string
}

/** A rule Tailwind emitted for one probe, with its enclosing at-rules. */
interface ProbeMatch {
  atContext: AtRuleInfo[]
  suffix: string
  rule: Rule
}

async function compileOnce(
  themeFile: string,
  requests: ApplyRequest[],
  probePrefix: string,
): Promise<CompiledExpansion> {
  const theme = readTextFile(themeFile)
  const probes = requests
    .map((request, index) => `.${probePrefix}_${index} { @apply ${request.params}; }`)
    .join('\n')

  const css = `${theme}\n\n${probes}\n`
  const compiler = await compile(css, {
    base: path.dirname(themeFile),
    from: themeFile,
    ...COMPILE_OPTIONS,
  })
  const output = compiler.build([])

  const root = postcss.parse(output, { from: themeFile })
  const rules = collectProbeRules(root, probePrefix)
  const propertyDefaults = collectPropertyDefaults(root)

  return { rules, propertyDefaults, output }
}

/**
 * Collect `@property --name { initial-value: ... }` registrations emitted by
 * Tailwind. Adding those values as `var()` fallbacks keeps the converted CSS
 * working even when the `@property` rules themselves are not loaded.
 */
function collectPropertyDefaults(root: Root): Map<string, string> {
  const defaults = new Map<string, string>()

  root.walkAtRules('property', (atRule) => {
    const name = atRule.params.trim()
    let initialValue: string | undefined
    atRule.walkDecls('initial-value', (declaration) => {
      initialValue = declaration.value
    })
    if (initialValue !== undefined) defaults.set(name, initialValue)
  })

  return defaults
}

/**
 * Convert Tailwind's output for the probe rules back into one synthetic rule
 * per request.
 *
 * Tailwind emits:
 *   .__probe { ... }                       (utilities without variants)
 *   .__probe:hover { ... }                 (variant-only)
 *   @media (...) { .__probe { ... } }      (at-rule variants only)
 *
 * The synthetic rule restores the nested shape (`&:hover`, `@media { ... }`)
 * that `flattenExpansion` expects, regardless of how Tailwind grouped it.
 */
function collectProbeRules(root: Root, probePrefix: string): Map<number, Rule> {
  const pattern = new RegExp(`^\\.${escapeRegExp(probePrefix)}_(\\d+)(?![\\w-])`)
  const matches = new Map<number, ProbeMatch[]>()

  root.walkRules((rule) => {
    const atContext: AtRuleInfo[] = []
    let ancestor: Container | Document | undefined = rule.parent

    while (ancestor && !isRoot(ancestor)) {
      // A rule nested in another rule already belongs to that probe's cloned
      // subtree; reading it separately would duplicate it.
      if (isRule(ancestor)) return
      if (isAtRule(ancestor)) {
        atContext.unshift({ name: ancestor.name, params: ancestor.params })
      }
      ancestor = ancestor.parent
    }

    for (const selector of splitSelectors(rule.selector)) {
      const match = pattern.exec(selector)
      if (!match) continue

      const index = Number(match[1])
      const suffix = selector.slice(match[0].length)
      const entries = matches.get(index) ?? []
      entries.push({ atContext, suffix, rule })
      matches.set(index, entries)
    }
  })

  const rules = new Map<number, Rule>()

  for (const [index, entries] of matches) {
    const synthetic = postcss.rule({ selector: `.${probePrefix}_${index}` })

    for (const { atContext, suffix, rule } of entries) {
      if (suffix === '' && atContext.length === 0) {
        for (const node of childNodes(rule)) synthetic.append(node.clone())
        continue
      }

      const inner = postcss.rule({ selector: suffix === '' ? '&' : `&${suffix}` })
      for (const node of childNodes(rule)) inner.append(node.clone())

      let wrapper: Rule | AtRule = inner
      for (let depth = atContext.length - 1; depth >= 0; depth--) {
        const { name, params } = atContext[depth]
        const atRule = postcss.atRule({ name, params })
        atRule.append(wrapper)
        wrapper = atRule
      }

      synthetic.append(wrapper)
    }

    rules.set(index, synthetic)
  }

  return rules
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function unknownUtilityFromError(error: unknown): string | null {
  const match = /unknown utility class [`'"]([^`'"]+)[`'"]/i.exec(errorMessage(error))
  return match?.[1] ?? null
}

async function isolateFailures(
  themeFile: string,
  requests: ApplyRequest[],
  probePrefix: string,
): Promise<ApplyRequest[]> {
  try {
    await compileOnce(themeFile, requests, probePrefix)
    return []
  } catch {
    if (requests.length <= 1) return requests

    const middle = Math.ceil(requests.length / 2)
    const left = requests.slice(0, middle)
    const right = requests.slice(middle)

    const failures: ApplyRequest[] = []
    for (const half of [left, right]) {
      if (half.length === 0) continue
      failures.push(...(await isolateFailures(themeFile, half, probePrefix)))
    }

    // A single invalid probe can sometimes only fail when compiled together
    // with the full list; fall back to the whole batch in that case.
    return failures.length > 0 ? failures : requests
  }
}

function describeRequests(requests: ApplyRequest[]): string {
  const params = requests.map((request) => `\`@apply ${request.params};\``)
  if (params.length === 1) return params[0]
  const preview = params.slice(0, 5).join(', ')
  return `${preview}${params.length > 5 ? ` and ${params.length - 5} more` : ''}`
}

/**
 * Expand a batch of `@apply` parameter strings against one Tailwind theme file.
 *
 * All rules are compiled in a single pass for speed; on error the batch is
 * bisected so the failing rule(s) can be reported with their source location.
 */
export async function expandApplyRules(
  themeFile: string,
  requests: ApplyRequest[],
): Promise<ApplyExpansion> {
  if (requests.length === 0) return { rules: new Map(), propertyDefaults: new Map() }

  const probePrefix = `__apply_to_css_${crypto.randomBytes(6).toString('hex')}`

  let compiled: CompiledExpansion
  try {
    compiled = await compileOnce(themeFile, requests, probePrefix)
  } catch (error) {
    // Is the theme itself broken?
    try {
      await compileOnce(themeFile, [], probePrefix)
    } catch (themeError) {
      throw new ApplyExpansionError(
        `Tailwind failed to compile the theme ${themeFile}: ${errorMessage(themeError)}`,
        { themeFile, cause: themeError },
      )
    }

    const hintedClass = unknownUtilityFromError(error)
    let failing: ApplyRequest[] = []
    if (hintedClass !== null) {
      const hinted = hintedClass
      failing = requests.filter((request) => request.params.split(/\s+/).includes(hinted))
    }

    if (failing.length === 0) {
      failing = await isolateFailures(themeFile, requests, probePrefix)
    }

    throw new ApplyExpansionError(`Cannot expand ${describeRequests(failing)}: ${errorMessage(error)}`, {
      themeFile,
      cause: error,
      requests: failing,
    })
  }

  const expansions = new Map<string, Rule>()

  for (let index = 0; index < requests.length; index++) {
    const rule = compiled.rules.get(index)
    if (!rule) {
      throw new ApplyExpansionError(
        `Tailwind did not produce output for \`@apply ${requests[index].params};\` using ${themeFile}`,
        { themeFile, requests: [requests[index]] },
      )
    }
    expansions.set(requests[index].params, rule)
  }

  return { rules: expansions, propertyDefaults: compiled.propertyDefaults }
}

/** Find the Tailwind entry stylesheet for a project. */
export function findDefaultTheme(cwd: string): string | null {
  const candidates = [
    'src/style.css',
    'src/styles/style.css',
    'src/assets/main.css',
    'src/assets/style.css',
    'src/app.css',
    'src/index.css',
    'app.css',
    'style.css',
    'tailwind.css',
    'assets/main.css',
  ]

  for (const candidate of candidates) {
    const file = path.resolve(cwd, candidate)
    if (fs.existsSync(file)) return file
  }
  return null
}
