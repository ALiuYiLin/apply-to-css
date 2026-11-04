import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
)

const BUILT_FILES = [
  'dist/bin.js',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/cli.js',
  'dist/transform.js',
]

function resolveFromPackage(file) {
  return fileURLToPath(new URL(`../${file}`, import.meta.url))
}

test('package manifest publishes the built dist artifacts', () => {
  // The installed executable is the unscoped command `apply-to-css`.
  // `npx @10coding/apply-to-css` also works: single-bin packages are resolved
  // by the package name, no need to name the bin after the scoped package.
  const binName = packageJson.name.replace(/^@[^/]+\//, '')
  assert.deepEqual(packageJson.bin, { [binName]: 'dist/bin.js' })
  assert.equal(packageJson.main, './dist/index.js')
  assert.equal(packageJson.types, './dist/index.d.ts')
  assert.deepEqual(packageJson.exports['.'], {
    types: './dist/index.d.ts',
    import: './dist/index.js',
    default: './dist/index.js',
  })
  assert.ok(packageJson.files.includes('dist'), 'npm files should include dist')
  assert.ok(!packageJson.files.includes('bin'), 'legacy bin/ directory should not be published')
})

test('build output exists for every published entry point', () => {
  for (const file of BUILT_FILES) {
    assert.ok(fs.existsSync(resolveFromPackage(file)), `${file} should exist — run \`pnpm build\``)
  }
})

test('built bin reports the package version', () => {
  const output = execFileSync(process.execPath, [resolveFromPackage('dist/bin.js'), '--version'], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  assert.equal(output.trim(), packageJson.version)
})
