---
"@10coding/apply-to-css": patch
---

源码重构为 TypeScript，构建产物输出到 `dist/`（JavaScript + `.d.ts` 类型声明）。`bin`、`exports`、`types` 均指向构建后的 `dist/`（安装后命令为 `apply-to-css`，也可用 `npx @10coding/apply-to-css`），`prepare` 会在安装 / 打包 / 发布前自动构建；编程接口保持不变。
