# apply-to-css playground

一个可以真实运行的 **Vite + Vue 3 + TypeScript + Tailwind CSS v4** 示例项目，用来展示和试验
[`@10coding/apply-to-css`](../packages/apply-to-css)：

- 所有组件的 `<style scoped>` 都通过 `@reference` 引入 Tailwind 主题；
- 组件样式使用 `@apply`，覆盖普通工具类、`hover:`、`focus-visible:`、`active:`、`disabled:`、
  `dark:`、`max-lg:`、`group-hover:`、`[&_tr]`、`:deep()` 等常见写法；
- 页面自身就是功能展示：可以切换深浅色、搜索成员、触发按钮状态、查看响应式布局；
- 内置命令可以直接预览 / 检查 / 写回转换结果。

## 快速开始

在 workspace 根目录安装依赖并启动：

```bash
pnpm install
pnpm playground
```

或者只运行 playground 包：

```bash
pnpm --filter @10coding/apply-to-css-playground dev
```

生产构建与类型检查：

```bash
pnpm playground:build
# 等价于 vue-tsc --noEmit && vite build
```

默认地址为 Vite 输出的 `http://localhost:5173`。

## 页面内容

| 区块 | 使用的 Tailwind 写法 | 展示内容 |
| --- | --- | --- |
| Hero / Header / 背景 | 普通工具类、渐变、`hover:`、`focus-visible:`、`dark:`、`:deep()` | 站点头部、代码预览卡片、统计信息 |
| 特性卡片 | `group-hover:`、渐变 | 工具的三个核心卖点 |
| 按钮与状态 | `hover:`、`active:`、`disabled:`、`focus-visible:` | 可点击的计数器、模拟加载、禁用按钮 |
| 变体实验台 | `focus:`、`lg:` 响应式、data 属性选择器 | 输入框、复选框、变体卡片、响应式提示 |
| 成员列表 | `max-md:`、`max-lg:`、`[&_tbody_tr:last-child]` | 可搜索的表格、状态徽章、窄屏隐藏列 |
| 转换对比 | 静态代码示例 | `@apply` / `@reference` 输入与纯 CSS 输出 |
| 三步接入 | 普通工具类 | 预览、检查、写回的 CLI 用法 |

## 运行转换实验

以下命令均在 workspace 根目录执行：

```bash
# 预览 diff（默认只读）
pnpm playground:diff

# CI 检查：源码仍含 @apply 时退出码为 1
pnpm playground:check

# 写回：会修改 playground/src 下的 .vue 文件
pnpm playground:convert
```

也可以直接调用包：

```bash
pnpm --filter @10coding/apply-to-css-playground exec apply-to-css --cwd . --diff
pnpm --filter @10coding/apply-to-css-playground exec apply-to-css --cwd . --write
```

### 写回之后

`demo:convert` / `--write` 会把组件里的 `@apply` 展开、移除不再需要的 `@reference`。这一步是
**真的修改源码**。转换之后可以继续构建，验证输出仍然是可用的普通 CSS：

```bash
pnpm playground:build
```

如果只是想恢复示例源码，使用 Git 撤销 `playground/src` 的改动即可：

```bash
git checkout -- playground/src
```

> 这个仓库默认把 playground 当作“转换前”的示例；因此提交的状态应保留 `@apply` / `@reference`，
> 不要把 `demo:convert` 的产物直接提交。

## 转换后仍然可用的原因

展开后的颜色、间距、圆角等仍引用 Tailwind 主题变量（例如 `--surface-1`、`--spacing`、
`--radius-xl`）。`src/style.css` 通过 `@theme inline` 把这些变量映射到 `:root` / `.dark`
上的运行时变量，所以：

- 转换只移除 `@apply` 与 `@reference`，不把主题变量内联成魔法值；
- 深色模式、主题切换不受影响；
- 如果删掉全局主题 CSS，转换结果会失去这些变量，这也是工具 README 中说明的边界。

## 目录结构

```text
playground/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.vue
    ├── main.ts
    ├── style.css          # Tailwind 入口、设计 tokens、深浅色主题
    ├── types.ts
    └── components/
        ├── TheHeader.vue
        ├── HeroSection.vue
        ├── FeatureGrid.vue
        ├── FeatureCard.vue
        ├── ActionButtons.vue
        ├── VariantLab.vue
        ├── MemberTable.vue
        ├── CodeCompare.vue
        ├── UsageSection.vue
        └── SiteFooter.vue
```
