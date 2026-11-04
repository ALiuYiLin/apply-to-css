/** A very small unified-diff helper (no external dependency). */

const MAX_CELLS = 4_000_000

/**
 * @returns {string | null} Unified diff, or `null` when the inputs are identical
 *   or too large for the in-memory LCS table.
 */
export function createUnifiedDiff(before, after, { from = 'before', to = 'after', context = 3 } = {}) {
  if (before === after) return null

  const a = before.split('\n')
  const b = after.split('\n')

  // Trim common prefix/suffix first; this keeps the LCS table small.
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  let suffix = 0
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++
  }

  const left = a.slice(prefix, a.length - suffix)
  const right = b.slice(prefix, b.length - suffix)

  if (left.length * right.length > MAX_CELLS) {
    return `--- ${from}\n+++ ${to}\n@@ file too large for a line diff @@\n`
  }

  const operations = diffSequences(left, right)
  const hunks = buildHunks(operations, context, prefix)

  if (hunks.length === 0) return null

  const lines = [`--- ${from}`, `+++ ${to}`]
  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
    )
    for (const op of hunk.operations) {
      lines.push(`${op.type === 'equal' ? ' ' : op.type === 'delete' ? '-' : '+'}${op.value}`)
    }
  }

  return lines.join('\n') + '\n'
}

function diffSequences(left, right) {
  const rows = left.length + 1
  const columns = right.length + 1
  const lengths = new Uint32Array(rows * columns)

  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      lengths[i * columns + j] =
        left[i] === right[j]
          ? lengths[(i + 1) * columns + j + 1] + 1
          : Math.max(lengths[(i + 1) * columns + j], lengths[i * columns + j + 1])
    }
  }

  const operations = []
  let i = 0
  let j = 0

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      operations.push({ type: 'equal', value: left[i] })
      i++
      j++
    } else if (lengths[(i + 1) * columns + j] >= lengths[i * columns + j + 1]) {
      operations.push({ type: 'delete', value: left[i] })
      i++
    } else {
      operations.push({ type: 'insert', value: right[j] })
      j++
    }
  }

  while (i < left.length) operations.push({ type: 'delete', value: left[i++] })
  while (j < right.length) operations.push({ type: 'insert', value: right[j++] })

  return operations
}

function buildHunks(operations, context, lineOffset = 0) {
  const hunks = []
  let index = 0

  while (index < operations.length) {
    while (index < operations.length && operations[index].type === 'equal') index++
    if (index >= operations.length) break

    let start = Math.max(0, index - context)
    let end = index

    // Extend while changes are close enough to keep in one hunk.
    while (end < operations.length) {
      if (operations[end].type !== 'equal') {
        end++
        continue
      }

      let run = 0
      while (end + run < operations.length && operations[end + run].type === 'equal') run++
      if (run > context * 2) break
      end += run
    }

    const tail = Math.min(operations.length, end + context)
    const hunkOperations = operations.slice(start, tail)

    let oldStart = 0
    let newStart = 0
    for (let i = 0; i < start; i++) {
      if (operations[i].type !== 'insert') oldStart++
      if (operations[i].type !== 'delete') newStart++
    }
    oldStart += 1 + lineOffset
    newStart += 1 + lineOffset

    let oldCount = 0
    let newCount = 0
    for (const operation of hunkOperations) {
      if (operation.type !== 'insert') oldCount++
      if (operation.type !== 'delete') newCount++
    }

    hunks.push({
      oldStart,
      oldCount,
      newStart,
      newCount,
      operations: hunkOperations,
    })

    index = tail
  }

  return hunks
}
