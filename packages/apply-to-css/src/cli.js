import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { convertFiles } from './index.js'
import { discoverFiles } from './glob.js'
import { createUnifiedDiff } from './diff.js'

const OPTIONS = {
  write: { type: 'boolean', short: 'w' },
  check: { type: 'boolean', short: 'c' },
  diff: { type: 'boolean', short: 'd' },
  css: { type: 'string' },
  exclude: { type: 'string', multiple: true },
  'keep-reference': { type: 'boolean' },
  cwd: { type: 'string' },
  json: { type: 'boolean' },
  verbose: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
}

/**
 * @param {string[]} argv
 * @param {{ stdout?: (line: string) => void, stderr?: (line: string) => void }} [io]
 * @returns {Promise<number>} exit code
 */
export async function runCli(argv, io = {}) {
  const stdout = io.stdout ?? ((line) => process.stdout.write(`${line}\n`))
  const stderr = io.stderr ?? ((line) => process.stderr.write(`${line}\n`))

  let parsed
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS })
  } catch (error) {
    stderr(`apply-to-css: ${error.message}`)
    stderr('Run `apply-to-css --help` for usage.')
    return 2
  }

  const { values, positionals } = parsed

  if (values.help) {
    stdout(helpText())
    return 0
  }

  if (values.version) {
    stdout(readVersion())
    return 0
  }

  if (values.write && values.check) {
    stderr('apply-to-css: --write and --check cannot be used together')
    return 2
  }

  const cwd = path.resolve(values.cwd ?? process.cwd())
  const patterns = positionals.length > 0 ? positionals : ['**/*.vue']
  const excludes = values.exclude ?? []

  const files = discoverFiles({ cwd, patterns, excludes })
  if (files.length === 0) {
    stderr(`apply-to-css: no files matched ${patterns.map((pattern) => `"${pattern}"`).join(', ')} in ${cwd}`)
    return 1
  }

  /** @type {Map<string, string>} */
  let originals = new Map()
  if (values.diff) {
    for (const file of files) originals.set(file, fs.readFileSync(file, 'utf8'))
  }

  let result
  try {
    result = await convertFiles({
      files,
      cwd,
      css: values.css,
      write: Boolean(values.write),
      removeReference: !values['keep-reference'],
      emitOutput: Boolean(values.diff),
    })
  } catch (error) {
    stderr(`apply-to-css: ${error.message}`)
    return 1
  }

  if (values.json) {
    stdout(
      JSON.stringify(
        {
          changedFiles: result.changedFiles,
          applyCount: result.applyCount,
          declarationCount: result.declarationCount ?? 0,
          generatedCount: result.generatedCount ?? 0,
          files: result.files.map((file) => ({
            file: path.relative(cwd, file.file).replaceAll('\\', '/'),
            changed: file.changed,
            applyCount: file.applyCount,
            declarationCount: file.declarationCount,
            generatedCount: file.generatedCount,
            referenceRemoved: file.referenceRemoved,
          })),
          warnings: result.warnings,
          errors: result.errors,
        },
        null,
        2,
      ),
    )
  } else {
    for (const warning of result.warnings) stderr(`warning: ${warning}`)

    for (const error of result.errors) {
      stderr(`error: ${relative(cwd, error.file)}${error.line ? `:${error.line}` : ''} ${error.message}`)
    }

    const changed = result.files.filter((file) => file.changed)

    if (values.diff) {
      for (const file of changed) {
        const diff = createUnifiedDiff(originals.get(file.file) ?? '', file.output ?? '', {
          from: `a/${relative(cwd, file.file)}`,
          to: `b/${relative(cwd, file.file)}`,
        })
        if (diff) stdout(diff.trimEnd())
      }
    }

    if (values.verbose || (!values.diff && !values.json)) {
      for (const file of changed) {
        stdout(
          `changed  ${relative(cwd, file.file)}  ` +
            `(${file.applyCount} @apply -> ${file.declarationCount} declarations` +
            `${file.generatedCount ? `, ${file.generatedCount} variant rules` : ''})`,
        )
      }
    }

    const totalDeclarations = result.declarationCount ?? changed.reduce((sum, file) => sum + file.declarationCount, 0)

    if (result.errors.length > 0) {
      stderr('')
      stderr(`Failed: ${result.errors.length} error(s), ${result.changedFiles} file(s) changed.`)
    } else if (result.changedFiles === 0) {
      stdout(`Scanned ${files.length} file(s); nothing to convert.`)
    } else if (values.write) {
      stdout(
        `Converted ${result.changedFiles} of ${files.length} file(s): ` +
          `${result.applyCount} @apply -> ${totalDeclarations} declarations.`,
      )
    } else if (values.check) {
      stdout(
        `Check failed: ${result.changedFiles} of ${files.length} file(s) still contain @apply ` +
          `(${result.applyCount} rule(s)).`,
      )
    } else {
      stdout(
        `Scanned ${files.length} file(s); ${result.changedFiles} need conversion ` +
          `(${result.applyCount} @apply, ${totalDeclarations} declarations).`,
      )
      stdout('Dry run: pass --write to update files.')
    }
  }

  if (result.errors.length > 0) return 1
  if (values.check && result.changedFiles > 0) return 1
  return 0
}

function relative(cwd, file) {
  const value = path.relative(cwd, file)
  return (value.startsWith('..') ? file : value).replaceAll('\\', '/')
}

function readVersion() {
  const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  return packageJson.version
}

function helpText() {
  return `apply-to-css ${readVersion()}

将 Vue 单文件组件 <style> 中的 Tailwind @apply 规则展开为普通 CSS 声明。
变体（hover:、max-lg: 等）会展开成独立的普通规则，不依赖 CSS 嵌套。

用法:
  apply-to-css [globs...] [options]

  globs 缺省为 "**/*.vue"（自动忽略 node_modules、dist 等目录）。
  也可以通过 --css 指定兜底的 Tailwind 入口；组件内写了
  "@reference '...'" 时优先使用它。

选项:
  -w, --write            写回 .vue 文件（默认只预览）
  -c, --check            检查模式：仍有文件需要转换时退出码为 1
  -d, --diff             打印 unified diff
      --css <file>       兜底 Tailwind 入口（未写 @reference 时使用）
      --exclude <glob>   额外排除的 glob（可重复）
      --keep-reference   保留 @reference 指令
      --cwd <dir>        工作目录（默认当前目录）
      --json             以 JSON 输出结果
  -v, --verbose          输出每个文件的变化明细
  -h, --help             显示帮助
      --version          显示版本

示例:
  apply-to-css src --diff
  apply-to-css "src/**/*.vue" --write
  apply-to-css --check --css src/style.css`
}
