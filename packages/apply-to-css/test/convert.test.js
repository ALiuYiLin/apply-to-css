import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import postcss from 'postcss'
import { convertFiles } from '../dist/index.js'
import { runCli } from '../dist/cli.js'
import { findStyleBlocks } from '../dist/sfc.js'
import { globToRegExp } from '../dist/glob.js'
import { createUnifiedDiff } from '../dist/diff.js'

const THEME = fs.readFileSync(new URL('./fixtures/theme.css', import.meta.url), 'utf8')

function makeProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-to-css-'))
  fs.writeFileSync(path.join(dir, 'theme.css'), THEME)
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

function sfc(style, { scoped = true } = {}) {
  return `<template>
  <div class="root" />
</template>

<script setup lang="ts">
const value = 1
</script>

<style${scoped ? ' scoped' : ''}>
@reference './theme.css';

${style}
</style>
`
}

function styleOf(vue) {
  return findStyleBlocks(vue)[0].content
}

function assertValidCss(css) {
  assert.doesNotThrow(() => postcss.parse(css))
}

test('expands @apply into plain declarations and removes @reference', async (t) => {
  const dir = makeProject({
    'Basic.vue': sfc(`.card {
  @apply flex items-center gap-2 rounded-lg border border-white/[0.09] bg-brand px-3 text-[12.5px] hover:bg-brand/50 max-lg:hidden;
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Basic.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  assert.equal(result.changedFiles, 1)
  assert.equal(result.applyCount, 1)

  const output = result.files[0].output
  assert.doesNotMatch(output, /@apply/)
  assert.doesNotMatch(output, /@reference/)
  assert.match(output, /display: flex;/)
  assert.match(output, /align-items: center;/)
  assert.match(output, /background-color: var\(--color-brand\);/)
  assert.match(output, /font-size: 12\.5px;/)
  assert.match(output, /\.card:hover \{/)
  assert.match(output, /@media \(hover: hover\) \{/)
  assert.match(output, /@media \(width < 64rem\) \{/)
  assertValidCss(styleOf(output))
})

test('handles variant-only @apply and removes the empty rule shell', async (t) => {
  const dir = makeProject({
    'Variant.vue': sfc(`.badge {
  @apply hover:text-destructive max-lg:hidden;
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Variant.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  const css = styleOf(result.files[0].output)
  assert.doesNotMatch(css, /\.badge \{\s*\}/)
  assert.match(css, /\.badge:hover \{/)
  assert.match(css, /color: var\(--color-destructive\);/)
  assert.match(css, /@media \(width < 64rem\) \{\n  \.badge \{/)
  assertValidCss(css)
})

test('is idempotent after writing', async (t) => {
  const dir = makeProject({ 'Once.vue': sfc('.once {\n  @apply flex;\n}') })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'Once.vue')

  const first = await convertFiles({ files: [file], cwd: dir, write: true })
  assert.equal(first.changedFiles, 1)

  const second = await convertFiles({ files: [file], cwd: dir, write: true })
  assert.equal(second.changedFiles, 0)
  assert.equal(second.applyCount, 0)
})

test('reports unknown utilities with the source location', async (t) => {
  const dir = makeProject({ 'Broken.vue': sfc('.broken {\n  @apply flex definitely-not-a-utility;\n}') })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'Broken.vue')

  const result = await convertFiles({ files: [file], cwd: dir })

  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0].message, /definitely-not-a-utility/)
  assert.equal(result.changedFiles, 0)
  assert.equal(fs.readFileSync(file, 'utf8'), sfc('.broken {\n  @apply flex definitely-not-a-utility;\n}'))
})

test('keeps @reference when other Tailwind directives are still present', async (t) => {
  const dir = makeProject({
    'Utility.vue': sfc(`@utility test-shadow {
  box-shadow: 0 1px 2px #0003;
}

.panel {
  @apply flex;
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Utility.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  const output = result.files[0].output
  assert.match(output, /@reference '\.\/theme\.css';/)
  assert.match(output, /@utility test-shadow/)
  assert.doesNotMatch(output, /@apply/)
})

test('can keep @reference explicitly', async (t) => {
  const dir = makeProject({ 'Keep.vue': sfc('.keep {\n  @apply flex;\n}') })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Keep.vue')],
    cwd: dir,
    removeReference: false,
    emitOutput: true,
  })

  assert.match(result.files[0].output, /@reference '\.\/theme\.css';/)
})

test('expands comma selectors and Vue deep selectors', async (t) => {
  const dir = makeProject({
    'Selectors.vue': sfc(`.card__title,
.card__subtitle {
  @apply truncate text-[13px] font-semibold hover:opacity-80;
}

:deep(.chart) .axis {
  @apply flex;
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Selectors.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  const css = styleOf(result.files[0].output)
  assert.match(css, /\.card__title,\n\.card__subtitle \{/)
  assert.match(css, /\.card__title:hover, \.card__subtitle:hover \{/)
  assert.match(css, /:deep\(\.chart\) \.axis \{/)
  assertValidCss(css)
})

test('supports nested source rules', async (t) => {
  const dir = makeProject({
    'Nested.vue': sfc(`.panel {
  .panel__title {
    @apply font-semibold;
  }
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Nested.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  const css = styleOf(result.files[0].output)
  assert.match(css, /font-weight: var\(--font-weight-semibold\);/)
  assertValidCss(css)
})

test('keeps variant output inside @layer components', async (t) => {
  const dir = makeProject({
    'Layer.vue': sfc(`@layer components {
.table-body {
  @apply [&_tr:last-child]:border-0;
}
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Layer.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  const css = styleOf(result.files[0].output)
  assert.match(css, /@layer components \{/)
  assert.match(css, /\.table-body tr:last-child \{/)
  assert.match(css, /border-width: 0px;/)
  assert.doesNotMatch(css, /\.table-body \{\s*\}/)
  assertValidCss(css)
})

test('preserves CRLF line endings', async (t) => {
  const dir = makeProject({})
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'Crlf.vue')
  const source = sfc('.crlf {\n  @apply flex;\n}').replaceAll('\n', '\r\n')
  fs.writeFileSync(file, source)

  const result = await convertFiles({ files: [file], cwd: dir, write: true })
  assert.equal(result.changedFiles, 1)

  const written = fs.readFileSync(file, 'utf8')
  assert.match(written, /\r\n/)
  assert.doesNotMatch(written, /(?<!\r)\n/)
})

test('converts every style block and leaves other content alone', async (t) => {
  const dir = makeProject({
    'Multi.vue': `<template>
  <div class="multi" />
</template>

<style scoped>
@reference './theme.css';

.multi {
  @apply flex;
}
</style>

<style>
@reference './theme.css';

.multi-global {
  @apply bg-brand;
}
</style>
`,
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Multi.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  assert.equal(result.applyCount, 2)
  const output = result.files[0].output
  assert.match(output, /\.multi \{\n  display: flex;\n\}/)
  assert.match(output, /\.multi-global \{\n  background-color: var\(--color-brand\);\n\}/)
  assert.match(output, /<template>\n  <div class="multi" \/>\n<\/template>/)
  assert.equal((output.match(/@reference/g) ?? []).length, 0)
})

test('uses the --css fallback when a block has no @reference', async (t) => {
  const dir = makeProject({
    'Fallback.vue': `<template><div /></template>
<style scoped>
.fallback {
  @apply flex;
}
</style>
`,
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Fallback.vue')],
    cwd: dir,
    css: path.join(dir, 'theme.css'),
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  assert.match(result.files[0].output, /display: flex;/)
})

test('preserves !important', async (t) => {
  const dir = makeProject({
    'Important.vue': sfc('.important {\n  @apply flex!;\n}'),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Important.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  assert.match(styleOf(result.files[0].output), /display: flex !important;/)
})

test('keeps generated variants inside a source @media', async (t) => {
  const dir = makeProject({
    'Media.vue': sfc(`@media (min-width: 768px) {
  .panel {
    @apply flex hover:text-destructive;
  }
}`),
  })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const result = await convertFiles({
    files: [path.join(dir, 'Media.vue')],
    cwd: dir,
    emitOutput: true,
  })

  assert.deepEqual(result.errors, [])
  const css = styleOf(result.files[0].output)
  const mediaStart = css.indexOf('@media (min-width: 768px)')
  const hoverStart = css.indexOf('.panel:hover')
  assert.ok(mediaStart !== -1)
  assert.ok(hoverStart > mediaStart)
  assertValidCss(css)
})

test('cli --check and --write work end to end', async (t) => {
  const dir = makeProject({ 'Cli.vue': sfc('.cli {\n  @apply flex;\n}') })
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const output = []
  const errors = []
  const io = {
    stdout: (line) => output.push(line),
    stderr: (line) => errors.push(line),
  }

  const checkCode = await runCli(['--cwd', dir, '--check'], io)
  assert.equal(checkCode, 1)
  assert.deepEqual(errors, [])

  const writeCode = await runCli(['--cwd', dir, '--write'], io)
  assert.equal(writeCode, 0)

  const cleanCode = await runCli(['--cwd', dir, '--check'], io)
  assert.equal(cleanCode, 0)
  assert.match(fs.readFileSync(path.join(dir, 'Cli.vue'), 'utf8'), /display: flex;/)
})

test('globToRegExp handles the documented subset', () => {
  assert.ok(globToRegExp('src/**/*.vue').test('src/a/b/C.vue'))
  assert.ok(globToRegExp('src/**/*.vue').test('src/C.vue'))
  assert.ok(!globToRegExp('src/*.vue').test('src/a/C.vue'))
})

test('createUnifiedDiff reports changed lines', () => {
  const diff = createUnifiedDiff('a\nb\nc\n', 'a\nB\nc\n', { from: 'a/x', to: 'b/x' })
  assert.match(diff, /^--- a\/x/m)
  assert.match(diff, /^-b$/m)
  assert.match(diff, /^\+B$/m)
})
