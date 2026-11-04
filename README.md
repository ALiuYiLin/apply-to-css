# @10coding/apply-to-css

把 Vue 单文件组件 `<style>` 里的 Tailwind `@apply` 规则展开成普通 CSS 声明，并移除只在编译期需要的 `@reference` 指令。

这是一个独立工具包：只需要 `.vue` 文件和 Tailwind v4 的 CSS 入口，不依赖调用方项目的任何源码或构建配置。

## 转换效果

输入：

```vue
<style scoped>
@reference '../../style.css';

.card {
  @apply flex items-center gap-2 rounded-lg bg-surface-1 px-3 text-[12.5px] text-ink-2 hover:bg-surface-3 max-lg:hidden;
}
</style>
```

输出：

```css
.card {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2);
  border-radius: var(--radius-lg);
  background-color: var(--surface-1);
  padding-inline: calc(var(--spacing) * 3);
  font-size: 12.5px;
  color: var(--ink-2);
}

@media (hover: hover) {
  .card:hover {
    background-color: var(--surface-3);
  }
}
@media (width < 64rem) {
  .card {
    display: none;
  }
}
```

要点：

- 普通声明按原位置写入，保持与已有声明的层叠顺序。
- `hover:`、`focus-visible:`、`max-lg:`、`[&_tr]:` 等变体展开为独立的普通规则 / `@media` / `@supports`，**不依赖 CSS 嵌套**，可以安全用于 Vue `<style scoped>`（Vue 的 scoped 插件会在伪类、伪元素之前正确插入 `[data-v-*]`）。
- 只包含变体的规则（例如 `.badge { @apply hover:bg-red-500; }`）会删除空壳 `.badge {}`，变体规则保留。
- `@reference` 在样式块不再需要 Tailwind 时自动移除；如果块里还有 `@utility`、`theme()` 等 Tailwind 语法则保留。
- Tailwind 通过 `@property` 注册的运行时变量（`--tw-*`）初始值会作为 `var()` 的 fallback 内联，减少对全局 `@property` 的依赖。

## 环境要求

- Node.js >= 20
- Tailwind CSS v4（包内已声明 `tailwindcss` 依赖）
- 组件内使用 `@reference`，或通过 `--css` 指定 Tailwind 入口
- 仅处理 `lang` 为 `css` / `postcss`（或不写 `lang`）的 `<style>`；SCSS/Less 等会跳过并给出警告

## 使用

在 workspace 根目录安装依赖：

```bash
pnpm install
```

然后通过根目录脚本运行（`--cwd` 指向目标 Vue 项目）：

```bash
# 查看会发生的改动
pnpm apply-to-css --cwd ../your-vue-project --diff

# 写回
pnpm apply-to-css --cwd ../your-vue-project --write

# 检查（CI）
pnpm apply-to-css --cwd ../your-vue-project --check
```

也可以直接调用包的入口：

```bash
node packages/apply-to-css/bin/apply-to-css.js --cwd ../your-vue-project --diff
pnpm --filter @10coding/apply-to-css exec apply-to-css --help
```

默认扫描 `--cwd`（或当前目录）下的 `**/*.vue`，并忽略 `node_modules`、`dist`、`.nuxt` 等目录。默认只预览，不会修改文件。

如果希望在任何项目中直接使用命令，可以在包目录执行一次全局链接：

```bash
cd packages/apply-to-css
pnpm link --global

# 之后在目标项目目录中
apply-to-css --diff
apply-to-css "src/**/*.vue" --write
apply-to-css --check
apply-to-css --css src/style.css --check
apply-to-css --exclude "src/legacy/**" --write
```

### 选项

| 选项 | 说明 |
| --- | --- |
| `-w, --write` | 写回 `.vue` 文件；不加时只预览 |
| `-c, --check` | 检查模式：仍有文件需要转换时退出码为 1 |
| `-d, --diff` | 打印 unified diff |
| `--css <file>` | 兜底 Tailwind CSS 入口（没有 `@reference` 时使用） |
| `--exclude <glob>` | 额外排除的 glob，可重复 |
| `--keep-reference` | 即使不再需要也保留 `@reference` |
| `--cwd <dir>` | 工作目录，默认当前目录 |
| `--json` | 以 JSON 输出结果，便于接入其他脚本 |
| `-v, --verbose` | 输出每个文件的转换明细 |
| `-h, --help` | 显示帮助 |
| `--version` | 显示版本 |

### 退出码

- `0`：成功（`--check` 且无需转换时也是 `0`）
- `1`：转换出错，或 `--check` 发现仍有文件需要转换
- `2`：命令行参数错误

## Playground

仓库里的 [`playground/`](playground) 是一个可直接运行的 Vite + Vue 3 + TypeScript + Tailwind CSS v4 示例项目，用来展示与试验 `@apply` / `@reference` 的转换：

```bash
pnpm playground          # 启动开发服务器
pnpm playground:build    # vue-tsc + vite build
pnpm playground:diff     # 预览需要转换的文件
pnpm playground:check    # CI 检查（示例源码默认未转换，退出码为 1）
pnpm playground:convert  # 写回 playground/src
```

示例组件覆盖普通工具类、`hover:` / `focus-visible:` / `disabled:` / `dark:`、`max-lg:`、`group-hover:`、`[&_tbody_tr]`、`:deep()` 等写法。详情见 [`playground/README.md`](playground/README.md)。

## 工作原理

1. 读取每个 `.vue` 的 `<style>` 块，收集其中的 `@apply` 和 `@reference`。
2. 用 Tailwind 的 programmatic compiler 编译 `@reference` 指向的主题（或 `--css`），并追加唯一的 probe 规则：

   ```css
   .__apply_to_css_probe_xxx { @apply <原参数>; }
   ```

3. 从编译结果中读回 probe 展开出的声明和嵌套变体，再把它们转换为普通规则写回原选择器。
4. 用 PostCSS 重写样式块，删除空壳规则和不再需要的 `@reference`。

同一个主题下所有 `@apply` 参数会去重后一次编译；只有出错时才二分定位具体规则。

## 编程接口

```js
import { convertFiles } from '@10coding/apply-to-css'

const result = await convertFiles({
  files: ['/abs/path/src/App.vue'],
  cwd: process.cwd(),
  css: 'src/style.css', // 可选，兜底主题
  write: false, // true 时写回文件
  removeReference: true,
  emitOutput: true, // 结果里带上转换后的源码
})

console.log(result.changedFiles, result.applyCount)
console.log(result.errors)
```

返回结构：

```ts
{
  files: Array<{
    file: string
    changed: boolean
    applyCount: number
    declarationCount: number
    generatedCount: number
    referenceRemoved: boolean
    output?: string
    warnings: string[]
  }>
  changedFiles: number
  applyCount: number
  declarationCount: number
  generatedCount: number
  warnings: string[]
  errors: Array<{ file: string, line?: number, message: string }>
}
```

## 已知边界

- **主题变量仍需存在。** 展开后的颜色、间距、圆角等仍会引用项目主题里的 CSS 变量（如 `--surface-1`、`--ink-2`、`--spacing`）。本工具只消除 `@apply` / `@reference`，不会把主题变量也内联成魔法值，否则会破坏明暗主题切换。请不要同时删除全局 Tailwind 主题。
- **动画关键帧仍来自全局。** Tailwind 的 `@keyframes`（以及 `--animate-*`）留在全局样式里，不会被复制进每个组件，避免 Vue scoped 对 keyframes 重命名后动画名对不上。
- **不处理 SCSS / Less / Stylus。** 这些块即使包含 `@apply` 也会跳过并警告。
- **组件内自定义的 `@utility` 无法被 `@apply`。** 和 `@reference` 的语义一致，工具只把主题入口交给 Tailwind 编译器；如果某个 `@utility` 只定义在组件自己的 `<style>` 里，又在同一块里被 `@apply`，请把它移到主题入口。
- **格式会变化。** 输出由 PostCSS 重新序列化，空白/换行可能与手写风格略有差异；建议先看 `--diff` 再 `--write`。

## 开发

```bash
pnpm test
```

测试使用 Node 内置 `node:test`，覆盖普通展开、变体、空壳规则、`@layer`、逗号选择器、`:deep()`、CRLF、错误定位、CLI 退出码等场景。

## 发布

版本与 changelog 由 [Changesets](https://github.com/changesets/changesets) 管理，配置在
[`.changeset/config.json`](.changeset/config.json)。仓库开发环境需要 Node 22.11+（Changesets 3 的要求）；
工具包本身仍支持 Node 20+。

```bash
# 为本次改动创建 changeset
pnpm changeset

# 查看待发布的变更
pnpm changeset:status

# 汇总 changeset：更新版本号与 CHANGELOG
pnpm version-packages

# 发布到 npm（会创建 Git tag）
pnpm release
```

`@10coding/apply-to-css` 的 `0.1.0` 尚未发布到 npm，首次发布可以直接执行 `pnpm test && pnpm release`；
之后的每次发布都应先添加 changeset。发布前需要登录 npmjs（`npm login --registry=https://registry.npmjs.org`）
或配置 `NPM_TOKEN`。包已通过 `publishConfig` 设为公开并固定发布到 npmjs。更完整的说明见
[`.changeset/README.md`](.changeset/README.md)。
