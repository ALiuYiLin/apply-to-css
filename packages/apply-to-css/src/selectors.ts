/** Selector helpers shared by the transform and the Tailwind probe reader. */

/**
 * Split a selector list at top-level commas, ignoring commas inside strings,
 * parentheses and attribute selectors.
 */
export function splitSelectors(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0

  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]

    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (char === ',' && depth === 0) {
      parts.push(selector.slice(start, index).trim())
      start = index + 1
    }
  }

  parts.push(selector.slice(start).trim())
  return parts.filter(Boolean)
}

/** Compose a parent selector list with one nested selector. */
export function composeSelectors(parentSelector: string, childSelector: string): string {
  const parents = splitSelectors(parentSelector)
  const children = splitSelectors(childSelector)
  const composed: string[] = []

  for (const child of children) {
    for (const parent of parents) {
      composed.push(child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`)
    }
  }

  return composed.join(', ')
}
