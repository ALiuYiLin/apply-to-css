/**
 * Minimal Vue SFC helpers.
 *
 * Only `<style>` blocks matter for this tool, and their contents are plain CSS.
 * A tiny attribute parser is enough; pulling in @vue/compiler-sfc would make the
 * package much heavier for no gain.
 */

const STYLE_OPEN_RE = /<style\b([^>]*)>/gi

/** Parse the attributes of an opening tag. */
export function parseAttributes(source) {
  const attributes = {}
  const attributeRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

  let match
  while ((match = attributeRe.exec(source))) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    attributes[name] = value
  }

  return attributes
}

/**
 * Find every `<style>` block in a Vue SFC.
 *
 * @returns {Array<{
 *   index: number,
 *   openTag: string,
 *   attributes: Record<string, string>,
 *   lang: string,
 *   external: boolean,
 *   content: string,
 *   contentStart: number,
 *   contentEnd: number,
 *   contentStartLine: number,
 * }>}
 */
export function findStyleBlocks(source) {
  const blocks = []
  STYLE_OPEN_RE.lastIndex = 0

  let match
  while ((match = STYLE_OPEN_RE.exec(source))) {
    const openTag = match[0]
    const contentStart = match.index + openTag.length
    const closeIndex = source.toLowerCase().indexOf('</style>', contentStart)
    if (closeIndex === -1) break

    const content = source.slice(contentStart, closeIndex)
    const attributes = parseAttributes(match[1])

    blocks.push({
      index: match.index,
      openTag,
      attributes,
      lang: (attributes.lang ?? 'css').toLowerCase(),
      external: Boolean(attributes.src),
      content,
      contentStart,
      contentEnd: closeIndex,
      contentStartLine: source.slice(0, contentStart).split('\n').length,
    })

    STYLE_OPEN_RE.lastIndex = closeIndex + '</style>'.length
  }

  return blocks
}

/** Replace style block contents while keeping everything else untouched. */
export function replaceStyleBlocks(source, blocks, contents) {
  if (blocks.length !== contents.length) {
    throw new Error('replaceStyleBlocks: blocks/contents length mismatch')
  }

  let result = source
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    result = result.slice(0, block.contentStart) + contents[i] + result.slice(block.contentEnd)
  }
  return result
}

/** Detect the dominant line ending of a source string. */
export function detectEol(source) {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

/** Normalize line endings to `\n` for processing. */
export function normalizeEol(source) {
  return source.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
}

/** Restore `\n` output to the given line ending. */
export function restoreEol(source, eol) {
  return eol === '\n' ? source : source.replaceAll('\n', eol)
}
