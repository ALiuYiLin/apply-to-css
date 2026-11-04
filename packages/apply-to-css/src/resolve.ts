import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const STYLE_CONDITIONS = ['style', 'css', 'sass', 'import', 'default', 'require']
const TOOL_ROOT = fileURLToPath(new URL('..', import.meta.url))

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

/** Read a UTF-8 text file, stripping a BOM if present. */
export function readTextFile(file: string): string {
  return stripBom(fs.readFileSync(file, 'utf8'))
}

/** Walk up from `from` looking for `<dir>/node_modules/<pkgName>`. */
export function findPackageDir(pkgName: string, from: string): string | null {
  let dir = path.resolve(from)
  if (!isDirectory(dir)) dir = path.dirname(dir)

  while (true) {
    const candidate = path.join(dir, 'node_modules', pkgName)
    if (isDirectory(candidate)) return candidate

    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function isDirectory(value: string): boolean {
  try {
    return fs.statSync(value).isDirectory()
  } catch {
    return false
  }
}

function isFile(value: string): boolean {
  try {
    return fs.statSync(value).isFile()
  } catch {
    return false
  }
}

function pickExport(value: unknown, conditions: readonly string[] = STYLE_CONDITIONS): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = pickExport(item, conditions)
      if (picked) return picked
    }
    return null
  }
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  for (const condition of conditions) {
    if (condition in record) {
      const picked = pickExport(record[condition], conditions)
      if (picked) return picked
    }
  }
  return null
}

function resolveExportTarget(pkg: Record<string, unknown>, subpath: string): string | null {
  const exportsField = pkg.exports
  if (!exportsField) return null

  const key = subpath ? `./${subpath}` : '.'
  const isSubpathMap =
    typeof exportsField === 'object' &&
    exportsField !== null &&
    !Array.isArray(exportsField) &&
    Object.keys(exportsField).some((entry) => entry.startsWith('.'))

  if (isSubpathMap) {
    const target = (exportsField as Record<string, unknown>)[key]
    return target ? pickExport(target) : null
  }

  // Root-only exports object (conditions map).
  return subpath ? null : pickExport(exportsField)
}

function resolveAsFile(candidate: string): string | null {
  if (isFile(candidate)) return candidate
  if (!path.extname(candidate) && isFile(`${candidate}.css`)) return `${candidate}.css`
  if (isDirectory(candidate)) {
    for (const index of ['index.css', 'style.css', 'index.js', 'index.mjs']) {
      const file = path.join(candidate, index)
      if (isFile(file)) return file
    }
  }
  return null
}

/**
 * Resolve a CSS import id (as passed to Tailwind's `loadStylesheet`) to a file.
 *
 * Supports relative paths and package ids such as `tailwindcss` or
 * `tw-animate-css`, preferring the `style`/`css` export conditions.
 */
export function resolveStylesheetFile(
  id: string,
  base: string,
  { fallbackToToolRoot = false }: { fallbackToToolRoot?: boolean } = {},
): string {
  const clean = id.trim().replace(/^url\(\s*/, '').replace(/\s*\)$/, '').replace(/^['"]|['"]$/g, '')

  if (clean.startsWith('.') || path.isAbsolute(clean)) {
    const candidate = path.resolve(base, clean)
    const resolved = resolveAsFile(candidate)
    if (!resolved) throw new Error(`Cannot resolve stylesheet "${id}" from ${base}`)
    return resolved
  }

  const pkgName = clean.startsWith('@') ? clean.split('/').slice(0, 2).join('/') : clean.split('/')[0]
  const subpath = clean.slice(pkgName.length).replace(/^\//, '')
  const pkgDir =
    findPackageDir(pkgName, base) ?? (fallbackToToolRoot ? findPackageDir(pkgName, TOOL_ROOT) : null)
  if (!pkgDir) throw new Error(`Cannot resolve package "${pkgName}" from ${base}`)

  let pkg: Record<string, unknown> = {}
  const pkgJsonPath = path.join(pkgDir, 'package.json')
  if (isFile(pkgJsonPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>
    } catch {
      pkg = {}
    }
  }

  const exported = resolveExportTarget(pkg, subpath)
  const candidates: string[] = []

  if (exported) candidates.push(path.join(pkgDir, exported))
  if (subpath) candidates.push(path.join(pkgDir, subpath))
  if (!subpath) {
    for (const field of ['style', 'css', 'sass']) {
      const value = pkg[field]
      if (typeof value === 'string') candidates.push(path.join(pkgDir, value))
    }
    candidates.push(path.join(pkgDir, 'index.css'))
    if (typeof pkg.main === 'string') candidates.push(path.join(pkgDir, pkg.main))
  }

  for (const candidate of candidates) {
    const resolved = resolveAsFile(candidate)
    if (resolved) return resolved
  }

  throw new Error(`Cannot resolve stylesheet "${id}" from ${base} (looked in ${pkgDir})`)
}

/** Resolve a JS/TS module (used for Tailwind `@plugin`/`@config`). */
export function resolveModuleFile(id: string, base: string): string {
  const require = createRequire(path.join(path.resolve(base), '__apply_to_css__.cjs'))
  try {
    return require.resolve(id)
  } catch {
    // Fall through to manual package resolution for style-only exports.
  }

  const pkgName = id.startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0]
  const pkgDir =
    findPackageDir(pkgName, base) ?? findPackageDir(pkgName, TOOL_ROOT)
  if (!pkgDir) throw new Error(`Cannot resolve module "${id}" from ${base}`)

  const subpath = id.slice(pkgName.length).replace(/^\//, '')
  if (subpath) {
    const file = path.join(pkgDir, subpath)
    if (isFile(file)) return file
  }

  for (const field of ['module', 'main']) {
    const pkgJson = path.join(pkgDir, 'package.json')
    if (!isFile(pkgJson)) continue
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as Record<string, unknown>
      if (typeof pkg[field] === 'string') {
        const file = path.join(pkgDir, pkg[field])
        if (isFile(file)) return file
      }
    } catch {
      // ignore broken package.json
    }
  }

  throw new Error(`Cannot resolve module "${id}" from ${base}`)
}
