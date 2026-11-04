import postcss from 'postcss'
import { composeSelectors } from './selectors.js'

export { composeSelectors, splitSelectors } from './selectors.js'

/** Thrown when an `@apply` rule cannot be rewritten. */
export class ApplyTransformError extends Error {
  constructor(message, { line, column, cause } = {}) {
    super(message, { cause })
    this.name = 'ApplyTransformError'
    this.line = line
    this.column = column
  }
}

const TAILWIND_AT_RULES = new Set([
  'apply',
  'variant',
  'utility',
  'theme',
  'custom-variant',
  'source',
  'plugin',
  'config',
  'tailwind',
])

/**
 * Rewrite every `@apply` rule in a CSS string into plain declarations.
 *
 * Nested output produced by Tailwind for variants (`&:hover`, `@media`, ...)
 * is flattened into normal top-level rules, so the result does not rely on
 * CSS nesting support in the browser or in Vue's scoped-style transform.
 *
 * @param {string} css
 * @param {{
 *   expansionFor: (params: string) => import('postcss').Rule | undefined,
 *   propertyDefaults?: Map<string, string>,
 *   removeReference?: boolean,
 *   from?: string,
 * }} options
 */
export function transformStyleCss(
  css,
  { expansionFor, propertyDefaults, removeReference = true, from } = {},
) {
  const root = postcss.parse(css, { from })

  let applyCount = 0
  let declarationCount = 0
  let generatedCount = 0
  let referenceRemoved = false

  /** @type {Map<import('postcss').Rule, import('postcss').Node>} */
  const insertionAnchors = new Map()
  /** @type {Set<import('postcss').Rule>} */
  const emptiedRules = new Set()

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== 'apply') return

    const parent = atRule.parent
    if (!parent || parent.type !== 'rule') {
      const start = atRule.source?.start
      throw new ApplyTransformError(
        '@apply can only be used inside a CSS rule',
        { line: start?.line, column: start?.column },
      )
    }

    const expansion = expansionFor(atRule.params)
    if (!expansion) {
      const start = atRule.source?.start
      throw new ApplyTransformError(
        `No Tailwind expansion was produced for \`@apply ${atRule.params};\``,
        { line: start?.line, column: start?.column },
      )
    }

    const ruleChain = collectRuleChain(atRule)
    const outerRule = ruleChain[0]
    const baseSelector = ruleChain
      .slice(1)
      .reduce((selector, rule) => composeSelectors(selector, rule.selector), ruleChain[0].selector)
    const atContext = collectInterveningAtRules(atRule, outerRule)

    const declarations = expansion.nodes.filter((node) => node.type === 'decl')
    const nested = expansion.nodes.filter((node) => node.type === 'rule' || node.type === 'atrule')

    const indent = indentOf(atRule)
    const before = atRule.raws.before && atRule.raws.before.includes('\n')
      ? atRule.raws.before
      : `\n${indent}`

    for (const declaration of declarations) {
      const clone = cloneDeclaration(declaration, propertyDefaults)
      clone.raws.before = before
      clone.raws.between = ': '
      parent.insertBefore(atRule, clone)
      declarationCount++
    }

    parent.raws.semicolon = true
    atRule.remove()
    applyCount++

    if (parent.nodes.length === 0) emptiedRules.add(parent)

    if (nested.length === 0) return

    const generated = flattenExpansion(nested, baseSelector, atContext)
    const insertAfter = insertionAnchors.get(outerRule) ?? outerRule

    if (generated.length > 0) {
      const nodes = generated.map((entry, index) =>
        buildGeneratedNode(entry, indentOf(outerRule), index === 0, propertyDefaults),
      )
      outerRule.parent.insertAfter(insertAfter, nodes)
      insertionAnchors.set(outerRule, nodes[nodes.length - 1])
      generatedCount += nodes.length
    }
  })

  if (removeReference && applyCount > 0 && !usesTailwind(root)) {
    referenceRemoved = removeReferenceRules(root)
  }

  // A rule whose entire body was an `@apply` with only variants would be left
  // empty; its generated rules already live next to it, so drop the shell.
  for (const rule of emptiedRules) {
    if (!rule.parent || rule.nodes.length > 0) continue

    const next = rule.next()
    if (!rule.prev() && next) {
      next.raws.before = (next.raws.before ?? '').replace(/^\n\n/, '\n')
    }
    rule.remove()
  }

  return {
    root,
    css: root.toString(),
    applyCount,
    declarationCount,
    generatedCount,
    referenceRemoved,
  }
}

function collectRuleChain(node) {
  const chain = []
  let current = node.parent

  while (current && current.type !== 'root') {
    if (current.type === 'rule') chain.unshift(current)
    current = current.parent
  }

  return chain
}

function collectInterveningAtRules(applyAtRule, outerRule) {
  const atRules = []
  let current = applyAtRule.parent

  while (current && current !== outerRule) {
    if (current.type === 'atrule') {
      atRules.unshift({ name: current.name, params: current.params })
    }
    current = current.parent
  }

  return atRules
}

function indentOf(node) {
  const before = node.raws?.before ?? ''
  const match = /\n([ \t]*)$/.exec(before)
  return match ? match[1] : ''
}

/**
 * Flatten the nested AST Tailwind emits for `@apply` into logical rules.
 *
 * @returns {Array<{ atContext: Array<{name: string, params: string}>, selector: string, declarations: import('postcss').Declaration[] }>}
 */
function flattenExpansion(nodes, baseSelector, atContext) {
  const output = []

  const declarations = []
  const children = []

  for (const node of nodes) {
    if (node.type === 'decl') declarations.push(node)
    else if (node.type === 'rule' || node.type === 'atrule') children.push(node)
  }

  if (declarations.length > 0) {
    output.push({ atContext, selector: baseSelector, declarations })
  }

  for (const child of children) {
    if (child.type === 'rule') {
      const selector = composeSelectors(baseSelector, child.selector)
      output.push(...flattenExpansion(child.nodes, selector, atContext))
      continue
    }

    output.push(
      ...flattenExpansion(child.nodes, baseSelector, [
        ...atContext,
        { name: child.name, params: child.params },
      ]),
    )
  }

  return output
}

function buildGeneratedNode(entry, topIndent, isFirst, propertyDefaults) {
  const depth = entry.atContext.length
  const ruleIndent = topIndent + '  '.repeat(depth)

  const rule = postcss.rule({ selector: entry.selector })
  rule.raws.before = `\n${ruleIndent}`
  rule.raws.between = ' '
  rule.raws.after = `\n${ruleIndent}`
  rule.raws.semicolon = true

  for (const declaration of entry.declarations) {
    const clone = cloneDeclaration(declaration, propertyDefaults)
    clone.raws.before = `\n${ruleIndent}  `
    clone.raws.between = ': '
    rule.append(clone)
  }

  let node = rule

  for (let index = depth - 1; index >= 0; index--) {
    const { name, params } = entry.atContext[index]
    const atRule = postcss.atRule({ name, params })
    atRule.raws.before = `\n${topIndent}${'  '.repeat(index)}`
    atRule.raws.afterName = params ? ' ' : ''
    atRule.raws.between = ' '
    atRule.raws.after = `\n${topIndent}${'  '.repeat(index)}`
    atRule.append(node)
    node = atRule
  }

  node.raws.before = `${isFirst ? '\n\n' : '\n'}${topIndent}`
  return node
}

function cloneDeclaration(declaration, propertyDefaults) {
  const clone = declaration.clone()

  if (propertyDefaults && propertyDefaults.size > 0 && clone.value) {
    clone.value = clone.value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (match, name) => {
      const initialValue = propertyDefaults.get(name)
      return initialValue === undefined ? match : `var(${name}, ${initialValue})`
    })
  }

  return clone
}

function usesTailwind(root) {
  let used = false

  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase()
    if (name === 'reference') return
    if (TAILWIND_AT_RULES.has(name)) used = true
    if (name === 'import' && /(?:tailwindcss|tw-animate)/.test(atRule.params)) used = true
  })

  if (used) return true

  return /(?:^|[^\w-])theme\s*\(|--(?:alpha|spacing|theme)\s*\(/.test(root.toString())
}

function removeReferenceRules(root) {
  const references = []
  root.walkAtRules('reference', (atRule) => references.push(atRule))
  if (references.length === 0) return false

  for (const reference of references) {
    const next = reference.next()
    if (next && !reference.prev()) {
      next.raws.before = reference.raws.before || next.raws.before
    }
    reference.remove()
  }

  return true
}
