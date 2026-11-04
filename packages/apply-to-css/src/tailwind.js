import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { compile } from 'tailwindcss'
import postcss from 'postcss'
import { splitSelectors } from './selectors.js'
import { readTextFile, resolveModuleFile, resolveStylesheetFile } from './resolve.js'

/** Thrown when Tailwind cannot expand one or more `@apply` rules. */
export class ApplyExpansionError extends Error {
  constructor(message, { themeFile, cause, requests = [] } = {}) {
    super(message, { cause })
    this.name = 'ApplyExpansionError'
    this.themeFile = themeFile
    this.requests = requests
  }
}

async function loadStylesheet(id, base) {
  const file = resolveStylesheetFile(id, base, { fallbackToToolRoot: true })
  return { path: file, base: path.dirname(file), content: readTextFile(file) }
}

async function loadModule(id, base) {
  const file = resolveModuleFile(id, base)
  const imported = await import(pathToFileURL(file).href)
  return { path: file, base: path.dirname(file), module: imported.default ?? imported }
}

const COMPILE_OPTIONS = { loadStylesheet, loadModule }

async function compileOnce(themeFile, requests, probePrefix) {
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
function collectPropertyDefaults(root) {
  const defaults = new Map()

  root.walkAtRules('property', (atRule) => {
    const name = atRule.params.trim()
    let initialValue
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
function collectProbeRules(root, probePrefix) {
  const pattern = new RegExp(`^\\.${escapeRegExp(probePrefix)}_(\\d+)(?![\\w-])`)
  /** @type {Map<number, Array<{ atContext: Array<{ name: string, params: string }>, suffix: string, rule: import('postcss').Rule }>>} */
  const matches = new Map()

  root.walkRules((rule) => {
    const atContext = []
    let ancestor = rule.parent

    while (ancestor && ancestor.type !== 'root') {
      // A rule nested in another rule already belongs to that probe's cloned
      // subtree; reading it separately would duplicate it.
      if (ancestor.type === 'rule') return
      if (ancestor.type === 'atrule') {
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

  const rules = new Map()

  for (const [index, entries] of matches) {
    const synthetic = postcss.rule({ selector: `.${probePrefix}_${index}` })

    for (const { atContext, suffix, rule } of entries) {
      if (suffix === '' && atContext.length === 0) {
        for (const node of rule.nodes) synthetic.append(node.clone())
        continue
      }

      const inner = postcss.rule({ selector: suffix === '' ? '&' : `&${suffix}` })
      for (const node of rule.nodes) inner.append(node.clone())

      let wrapper = inner
      for (let depth = atContext.length - 1; depth >= 0; depth--) {
        const atRule = postcss.atRule({ ...atContext[depth] })
        atRule.append(wrapper)
        wrapper = atRule
      }

      synthetic.append(wrapper)
    }

    rules.set(index, synthetic)
  }

  return rules
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


function unknownUtilityFromError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const match = /unknown utility class [`'"]([^`'"]+)[`'"]/i.exec(message)
  return match?.[1] ?? null
}

async function isolateFailures(themeFile, requests, probePrefix) {
  try {
    await compileOnce(themeFile, requests, probePrefix)
    return []
  } catch {
    if (requests.length <= 1) return requests

    const middle = Math.ceil(requests.length / 2)
    const left = requests.slice(0, middle)
    const right = requests.slice(middle)

    const failures = []
    for (const half of [left, right]) {
      if (half.length === 0) continue
      failures.push(...(await isolateFailures(themeFile, half, probePrefix)))
    }

    // A single invalid probe can sometimes only fail when compiled together
    // with the full list; fall back to the whole batch in that case.
    return failures.length > 0 ? failures : requests
  }
}

function describeRequests(requests) {
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
 *
 * @param {string} themeFile Absolute path to the Tailwind CSS entry.
 * @param {Array<{params: string, meta?: object}>} requests Unique requests.
 * @returns {Promise<{
 *   rules: Map<string, import('postcss').Rule>,
 *   propertyDefaults: Map<string, string>,
 * }>}
 */
export async function expandApplyRules(themeFile, requests) {
  if (requests.length === 0) return { rules: new Map(), propertyDefaults: new Map() }

  const probePrefix = `__apply_to_css_${crypto.randomBytes(6).toString('hex')}`

  let compiled
  try {
    compiled = await compileOnce(themeFile, requests, probePrefix)
  } catch (error) {
    // Is the theme itself broken?
    try {
      await compileOnce(themeFile, [], probePrefix)
    } catch (themeError) {
      throw new ApplyExpansionError(
        `Tailwind failed to compile the theme ${themeFile}: ${themeError.message}`,
        { themeFile, cause: themeError },
      )
    }

    const hintedClass = unknownUtilityFromError(error)
    let failing = hintedClass
      ? requests.filter((request) => request.params.split(/\s+/).includes(hintedClass))
      : []

    if (failing.length === 0) {
      failing = await isolateFailures(themeFile, requests, probePrefix)
    }

    throw new ApplyExpansionError(
      `Cannot expand ${describeRequests(failing)}: ${error.message}`,
      { themeFile, cause: error, requests: failing },
    )
  }

  const expansions = new Map()

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
export function findDefaultTheme(cwd) {
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
