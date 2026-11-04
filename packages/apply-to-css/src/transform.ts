import postcss from 'postcss'
import type { AtRule, ChildNode, Container, Declaration, Document, Node, Root, Rule } from 'postcss'
import { childNodes, isAtRule, isRoot, isRule } from './ast.js'
import type { AtRuleInfo } from './ast.js'
import { composeSelectors } from './selectors.js'

export { composeSelectors, splitSelectors } from './selectors.js'

/** Thrown when an `@apply` rule cannot be rewritten. */
export class ApplyTransformError extends Error {
  /** 1-based line inside the style block, when known. */
  readonly line: number | undefined
  /** 1-based column inside the style block, when known. */
  readonly column: number | undefined

  constructor(message: string, options: { line?: number; column?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'ApplyTransformError'
    this.line = options.line
    this.column = options.column
  }
}

/** Options accepted by {@link transformStyleCss}. */
export interface TransformStyleOptions {
  /** Look up the synthetic rule exported by Tailwind for one `@apply` parameter string. */
  expansionFor: (params: string) => Rule | undefined
  /** `@property` initial values used as `var()` fallbacks. */
  propertyDefaults?: Map<string, string>
  /** Remove `@reference` once nothing else in the block needs Tailwind. */
  removeReference?: boolean
  /** Source path used for PostCSS error positions. */
  from?: string
}

/** Result returned by {@link transformStyleCss}. */
export interface TransformStyleResult {
  root: Root
  css: string
  applyCount: number
  declarationCount: number
  generatedCount: number
  referenceRemoved: boolean
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

/** One flattened rule produced from a nested Tailwind expansion. */
interface FlattenedRule {
  atContext: AtRuleInfo[]
  selector: string
  declarations: Declaration[]
}

/**
 * Rewrite every `@apply` rule in a CSS string into plain declarations.
 *
 * Nested output produced by Tailwind for variants (`&:hover`, `@media`, ...)
 * is flattened into normal top-level rules, so the result does not rely on
 * CSS nesting support in the browser or in Vue's scoped-style transform.
 */
export function transformStyleCss(
  css: string,
  { expansionFor, propertyDefaults, removeReference = true, from }: TransformStyleOptions,
): TransformStyleResult {
  const root = postcss.parse(css, { from })

  let applyCount = 0
  let declarationCount = 0
  let generatedCount = 0
  let referenceRemoved = false

  const insertionAnchors = new Map<Rule, ChildNode>()
  const emptiedRules = new Set<Rule>()

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== 'apply') return

    const parent = atRule.parent
    if (!parent || !isRule(parent)) {
      const start = atRule.source?.start
      throw new ApplyTransformError('@apply can only be used inside a CSS rule', {
        line: start?.line,
        column: start?.column,
      })
    }

    const expansion = expansionFor(atRule.params)
    if (!expansion) {
      const start = atRule.source?.start
      throw new ApplyTransformError(`No Tailwind expansion was produced for \`@apply ${atRule.params};\``, {
        line: start?.line,
        column: start?.column,
      })
    }

    const ruleChain = collectRuleChain(atRule)
    const outerRule = ruleChain[0]
    const baseSelector = ruleChain
      .slice(1)
      .reduce((selector, rule) => composeSelectors(selector, rule.selector), outerRule.selector)
    const atContext = collectInterveningAtRules(atRule, outerRule)

    const expansionNodes = childNodes(expansion)
    const declarations = expansionNodes.filter((node): node is Declaration => node.type === 'decl')
    const nested = expansionNodes.filter(
      (node): node is Rule | AtRule => node.type === 'rule' || node.type === 'atrule',
    )

    const indent = indentOf(atRule)
    const rawBefore: unknown = atRule.raws.before
    const before =
      typeof rawBefore === 'string' && rawBefore.includes('\n') ? rawBefore : `\n${indent}`

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

    if ((parent.nodes?.length ?? 0) === 0) emptiedRules.add(parent)

    if (nested.length === 0) return

    const generated = flattenExpansion(nested, baseSelector, atContext)
    const insertAfter = insertionAnchors.get(outerRule) ?? outerRule
    const outerParent = outerRule.parent

    if (generated.length > 0 && outerParent) {
      const nodes = generated.map((entry, index) =>
        buildGeneratedNode(entry, indentOf(outerRule), index === 0, propertyDefaults),
      )
      outerParent.insertAfter(insertAfter, nodes)
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
    if (!rule.parent || (rule.nodes?.length ?? 0) > 0) continue

    const next = rule.next()
    if (!rule.prev() && next) {
      next.raws.before = String(next.raws.before ?? '').replace(/^\n\n/, '\n')
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

function collectRuleChain(node: Node): Rule[] {
  const chain: Rule[] = []
  let current: Container | Document | undefined = node.parent

  while (current && !isRoot(current)) {
    if (isRule(current)) chain.unshift(current)
    current = current.parent
  }

  return chain
}

function collectInterveningAtRules(applyAtRule: AtRule, outerRule: Rule): AtRuleInfo[] {
  const atRules: AtRuleInfo[] = []
  let current: Container | Document | undefined = applyAtRule.parent

  while (current && current !== outerRule) {
    if (isAtRule(current)) {
      atRules.unshift({ name: current.name, params: current.params })
    }
    current = current.parent
  }

  return atRules
}

function indentOf(node: Node): string {
  const before: unknown = node.raws?.before
  const match = /\n([ \t]*)$/.exec(typeof before === 'string' ? before : '')
  return match ? match[1] : ''
}

/**
 * Flatten the nested AST Tailwind emits for `@apply` into logical rules.
 */
function flattenExpansion(
  nodes: ChildNode[],
  baseSelector: string,
  atContext: AtRuleInfo[],
): FlattenedRule[] {
  const output: FlattenedRule[] = []

  const declarations = nodes.filter((node): node is Declaration => node.type === 'decl')
  const children = nodes.filter(
    (node): node is Rule | AtRule => node.type === 'rule' || node.type === 'atrule',
  )

  if (declarations.length > 0) {
    output.push({ atContext, selector: baseSelector, declarations })
  }

  for (const child of children) {
    if (isRule(child)) {
      const selector = composeSelectors(baseSelector, child.selector)
      output.push(...flattenExpansion(childNodes(child), selector, atContext))
      continue
    }

    output.push(
      ...flattenExpansion(childNodes(child), baseSelector, [
        ...atContext,
        { name: child.name, params: child.params },
      ]),
    )
  }

  return output
}

function buildGeneratedNode(
  entry: FlattenedRule,
  topIndent: string,
  isFirst: boolean,
  propertyDefaults: Map<string, string> | undefined,
): ChildNode {
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

  let node: Rule | AtRule = rule

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

function cloneDeclaration(
  declaration: Declaration,
  propertyDefaults: Map<string, string> | undefined,
): Declaration {
  const clone = declaration.clone()

  if (propertyDefaults && propertyDefaults.size > 0 && clone.value) {
    clone.value = clone.value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (match, name: string) => {
      const initialValue = propertyDefaults.get(name)
      return initialValue === undefined ? match : `var(${name}, ${initialValue})`
    })
  }

  return clone
}

function usesTailwind(root: Root): boolean {
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

function removeReferenceRules(root: Root): boolean {
  const references: AtRule[] = []
  root.walkAtRules('reference', (atRule) => {
    references.push(atRule)
  })
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
