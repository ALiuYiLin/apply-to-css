# Changesets

这个目录用来记录发布说明（changeset）和版本变更。发布流程由
[`@changesets/cli`](https://github.com/changesets/changesets) 驱动。

## 日常开发

当一次改动需要体现在发布说明里时，在仓库根目录运行：

```bash
pnpm changeset
```

按提示选择要发布的包和改动级别（`patch` / `minor` / `major`），然后填写面向使用者的说明。
命令会生成一个 `.changeset/<随机名>.md` 文件，把它和代码一起提交。

查看当前待发布的变更：

```bash
pnpm changeset:status
```

如果改动不需要发布（例如纯文档或 CI 配置），创建空 changeset，避免 `changeset status` 报错：

```bash
pnpm changeset --empty
```

## 发布流程

```bash
# 1. 汇总 changeset，更新版本号和 CHANGELOG
pnpm version-packages

# 2. 检查改动，提交版本号与 CHANGELOG
git add .
git commit -m "chore: release packages"

# 3. 发布到 npm
pnpm release
```

`version-packages` 只会修改版本号和 changelog，不会提交或发布；`release` 会发布所有
registry 上尚不存在的版本，并创建 Git tag。

## 首次发布

`@10coding/apply-to-css` 当前的 `0.1.0` 还没有发布到 npm，因此首次发布不需要 changeset，
直接执行：

```bash
pnpm test
pnpm release
```

之后的每次发布都应先创建 changeset，再走上面的三步流程。

## 前置条件

- 登录 npmjs（注意不要连同本机镜像源一起登录）：

  ```bash
  npm login --registry=https://registry.npmjs.org
  ```

  或在 CI 中配置 `NPM_TOKEN`。
- 作用域包需要公开发布；`packages/apply-to-css/package.json` 已配置
  `publishConfig.access: "public"` 和 `publishConfig.registry: "https://registry.npmjs.org/"`，
  因此即使本机 registry 指向镜像源，发布时也会走 npmjs。
- 发布前建议先跑 `pnpm test`，并确认工作区没有未提交的改动。

## 配置说明

- `baseBranch: "master"`：与当前主分支一致。
- `access: "public"`：`@10coding` 作用域默认按公开包发布。
- `privatePackages`：playground 和 workspace 根包不会被 version / tag。
- `updateInternalDependencies: "patch"`：workspace 内部依赖按 patch 级别联动。
