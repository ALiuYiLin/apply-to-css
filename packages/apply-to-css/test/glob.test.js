import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { discoverFiles } from '../src/glob.js'

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-to-css-glob-'))
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return dir
}

test('discoverFiles walks nested paths and normalizes separators', (t) => {
  const dir = tree({
    'a.vue': '<template />',
    'src/b.vue': '<template />',
    'src/deep/c.vue': '<template />',
    'src/deep/note.txt': 'x',
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const all = discoverFiles({ cwd: dir, patterns: ['**/*.vue'] })
  assert.deepEqual(
    all.map((file) => path.relative(dir, file).replaceAll('\\', '/')),
    ['a.vue', 'src/b.vue', 'src/deep/c.vue'],
  )

  const shallow = discoverFiles({ cwd: dir, patterns: ['src/*.vue'] })
  assert.deepEqual(
    shallow.map((file) => path.relative(dir, file).replaceAll('\\', '/')),
    ['src/b.vue'],
  )

  const excluded = discoverFiles({ cwd: dir, patterns: ['**/*.vue'], excludes: ['**/deep/**'] })
  assert.deepEqual(
    excluded.map((file) => path.relative(dir, file).replaceAll('\\', '/')),
    ['a.vue', 'src/b.vue'],
  )
})

test('discoverFiles accepts a directory positional', (t) => {
  const dir = tree({ 'src/a.vue': '<template />', 'src/deep/b.vue': '<template />' })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const found = discoverFiles({ cwd: dir, patterns: [path.join(dir, 'src')] })
  assert.deepEqual(
    found.map((file) => path.relative(dir, file).replaceAll('\\', '/')),
    ['src/a.vue', 'src/deep/b.vue'],
  )
})
