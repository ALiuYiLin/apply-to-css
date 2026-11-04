/**
 * Small PostCSS helpers shared by the transform and the Tailwind probe reader.
 *
 * `postcss` types widen `Node#type` to `string`, so discriminant narrowing needs
 * these guards. `Container#nodes` is also optional in the typings (PostCSS
 * removes the property once a container is empty).
 */

import type { AtRule, ChildNode, Container, Root, Rule } from 'postcss'

/** An at-rule wrapper (`@media`, `@supports`, ...) kept around a nested rule. */
export interface AtRuleInfo {
  name: string
  params: string
}

/** Is this node a CSS rule? */
export function isRule(node: { type: string }): node is Rule {
  return node.type === 'rule'
}

/** Is this node an at-rule? */
export function isAtRule(node: { type: string }): node is AtRule {
  return node.type === 'atrule'
}

/** Is this node the document root? */
export function isRoot(node: { type: string }): node is Root {
  return node.type === 'root'
}

/** Children of a container, tolerating the missing `nodes` of an empty one. */
export function childNodes(container: Container): ChildNode[] {
  return container.nodes ?? []
}
