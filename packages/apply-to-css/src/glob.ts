import fs from 'node:fs'
import type { Dirent } from 'node:fs'
import path from 'node:path'

/** Directories that are never worth walking. */
const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  '.nuxt',
  '.output',
  '.vite',
  '.turbo',
  '.next',
  'coverage',
])

/** Expand a single `{a,b}` group into several globs. */
function expandBraces(pattern: string): string[] {
  const start = pattern.indexOf('{')
  if (start === -1) return [pattern]

  let depth = 0
  for (let i = start; i < pattern.length; i++) {
    if (pattern[i] === '{') depth++
    else if (pattern[i] === '}') {
      depth--
      if (depth === 0) {
        const head = pattern.slice(0, start)
        const body = pattern.slice(start + 1, i)
        const tail = pattern.slice(i + 1)
        return splitTopLevel(body).flatMap((part) => expandBraces(head + part + tail))
      }
    }
  }
  return [pattern]
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts
}

/** Convert the common glob syntax (`**`, `*`, `?`, `{}`) to a RegExp. */
export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replaceAll('\\', '/').replace(/^\.\//, '')
  let source = ''

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]

    if (ch === '*') {
      if (normalized[i + 1] === '*') {
        i++
        if (normalized[i + 1] === '/') {
          i++
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
      continue
    }

    if (ch === '?') {
      source += '[^/]'
      continue
    }

    if ('\\^$.|+()[]'.includes(ch)) {
      source += '\\' + ch
      continue
    }

    source += ch
  }

  return new RegExp(`^${source}$`)
}

function normalizeRelative(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '')
}

/**
 * Discover files for one or more globs.
 *
 * Patterns without glob magic are treated as files, or as directories whose
 * `**\/*.vue` children are included.
 */
export function discoverFiles({
  cwd,
  patterns,
  excludes = [],
}: {
  cwd: string
  patterns: string[]
  excludes?: string[]
}): string[] {
  const ignore = new Set(DEFAULT_IGNORED_DIRS)
  const found = new Set<string>()

  const includeMatchers = patterns.flatMap((pattern) => expandBraces(normalizeRelative(pattern))).map(globToRegExp)
  const excludeMatchers = excludes
    .flatMap((pattern) => expandBraces(normalizeRelative(pattern)))
    .map(globToRegExp)

  const isExcluded = (relative: string): boolean => {
    const posix = relative.replaceAll('\\', '/')
    if (excludeMatchers.some((matcher) => matcher.test(posix))) return true
    return posix.split('/').some((part) => ignore.has(part))
  }

  const walk = (dir: string): void => {
    let entries: Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      const absolute = path.join(dir, entry.name)
      const relative = path.relative(cwd, absolute)
      const posixRelative = relative.replaceAll('\\', '/')

      if (entry.isDirectory()) {
        if (ignore.has(entry.name)) continue
        walk(absolute)
        continue
      }

      if (!entry.isFile()) continue
      if (isExcluded(relative)) continue
      if (includeMatchers.some((matcher) => matcher.test(posixRelative))) found.add(absolute)
    }
  }

  for (const pattern of patterns) {
    const cleaned = pattern.replaceAll('\\', '/')
    const absolute = path.resolve(cwd, cleaned)
    if (!hasGlobMagic(cleaned) && fs.existsSync(absolute)) {
      const stat = fs.statSync(absolute)
      if (stat.isFile()) {
        found.add(absolute)
        continue
      }
      if (stat.isDirectory()) {
        const relativeDir = path.relative(cwd, absolute).replaceAll('\\', '/')
        includeMatchers.push(globToRegExp(`${relativeDir}/**/*.vue`))
        walk(absolute)
        continue
      }
    }
    walk(cwd)
  }

  return [...found].sort((a, b) => a.localeCompare(b))
}

function hasGlobMagic(pattern: string): boolean {
  return ['*', '?', '{', '['].some((character) => pattern.includes(character))
}
