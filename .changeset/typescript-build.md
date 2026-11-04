---
"@10coding/apply-to-css": patch
---

源码重构为 TypeScript，构建产物输出到 `dist/`（JavaScript + `.d.ts` 类型声明）。`bin` 名改为与包名一致（`@10coding/apply-to-css`），`bin`、`exports`、`types` 均指向构建后的 `dist/`，发布前由 `prepack` 自动构建；安装后命令仍是 `apply-to-css`，也支持 `npx @10coding/apply-to-css` 直接运行。编程接口保持不变。
