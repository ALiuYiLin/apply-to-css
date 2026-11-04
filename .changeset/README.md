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

## 发布流程（手动）

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

## 发布流程（GitHub Actions 自动，推荐）

仓库已配置 [`.github/workflows/release.yml`](../.github/workflows/release.yml)：

- 推送到 `master`（或在 Actions 页面手动触发 `Release`）后：
  - 存在带 release 的 changeset → 生成 / 更新 **Version Packages** PR（只改版本号与 CHANGELOG）；
  - 没有 changeset 但有未发布版本 → 先构建 `dist/`、跑 `pnpm test`，再打包并发布到 npm；
  - 两者都没有 → 什么都不做。
- 发布使用 [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)（OIDC），
  不需要在仓库里保存 `NPM_TOKEN`；通过 OIDC 发布时会自动附带 provenance 证明
  （公开仓库 + 公开包，本仓库满足条件）。
- 合并 **Version Packages** PR 即触发真正的发布，发布完成后会推送 git tag、
  创建 GitHub Release。

日常只需要：`pnpm changeset` → 提交并推送 → 等 CI 开 Version Packages PR → 合并即发布。

### 一次性配置

> 先把 `.github/workflows/release.yml` 提交并推送到 `master`：npm 校验的是仓库里
> 实际存在的工作流文件。推送后第一次运行只会判定为“无需发布”，不会真的发布。

**1. 先手动发布第一个版本**

npm 的 Trusted Publishing 目前不支持发布**包的第一个版本**
（[npm/cli#8544](https://github.com/npm/cli/issues/8544)），首次发布必须手动完成：

```bash
npm login --registry=https://registry.npmjs.org
pnpm test
pnpm release
# 确认已上架（0.1.0）
npm view @10coding/apply-to-css version
```

`pnpm release` 会在本地创建 git tag，可按需执行 `git push --tags`。

**2. 在 npmjs.com 配置 Trusted Publisher**

打开包的设置页（`https://www.npmjs.com/package/@10coding/apply-to-css` → Settings →
**Trusted publishing**），选择 **GitHub Actions** 并填写：

| 字段 | 值 |
| --- | --- |
| Organization or user | `ALiuYiLin` |
| Repository | `apply-to-css` |
| Workflow filename | `release.yml`（只填文件名，不带路径） |
| Environment name | 留空 |
| Allowed actions | 必须勾选 **`npm publish`** |

> `Allowed actions` 必须包含 `npm publish`：2026-09-03 之后新建的配置默认只允许
> `npm stage publish`（暂存发布需要人工 2FA 审批），而 Changesets 是直接发布，
> 不勾选会发布失败。

也可以用命令行配置（npm ≥ 11.10，需要 2FA 确认，包必须先存在）：

```bash
npm login --registry=https://registry.npmjs.org
npm trust github @10coding/apply-to-css \
  --repo ALiuYiLin/apply-to-css \
  --file release.yml \
  --yes
```

注意：

- 工作流文件名必须与 `.github/workflows/release.yml` 完全一致；以后重命名工作流文件，
  必须回来更新这里的配置，否则 OIDC 校验失败。
- 新配置必须在 2 天内完成第一次成功发布，否则配置失效、需要删除后重建；可以提前准备一个
  patch changeset 来验证整条链路。
- 如需发布前人工审批：先在 GitHub 建 Environment（如 `release`）并配置 Required reviewers，
  创建 Trusted Publisher 时把 Environment name 填成 `release`，同时在 `release.yml` 的
  `publish` job 上加 `environment: release`。注意已创建的信任配置不能修改、只能删除重建，
  所以最好一开始就决定是否使用 Environment。

**3. 打开仓库 Actions 的 PR 权限**

GitHub 仓库 → Settings → Actions → General → 勾选
**Allow GitHub Actions to create and approve pull requests**。
否则 `version` job 无法创建 Version Packages PR（报
`GitHub Actions is not permitted to create or approve pull requests`）。

### 排错

- `EOTP` / `401 Unauthorized` / `need auth`：Trusted Publisher 配置的仓库、工作流
  文件名或 Environment 对不上，或 `Allowed actions` 没勾 `npm publish`，或配置已过期。
- `Resource not accessible by integration`（version job）：没打开上面的
  “允许 GitHub Actions 创建和批准 PR”。
- npm `404`：包还不存在，先按“一次性配置 → 1”手动发布。
- 没有 provenance：需要“公开仓库 + 公开包 + OIDC 发布”三者同时满足；并且
  `packages/apply-to-css/package.json` 的 `repository` 地址要与 GitHub 仓库
  大小写一致（当前已正确）。
- 空 changeset（例如 `.changeset/release-tooling.md`）不包含任何 release，不会触发
  version；它会在下一次 `changeset version` 时被消耗。注意：如果只存在空 changeset
  且还有未发布版本，自动流程会判定为“无需操作”，这种情况下请手动发布。
- 想退回 token 方式：在 GitHub 仓库 Secrets 中加 `NPM_TOKEN`，把 `publish` job 改为
  `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`，并在 `setup-node` 中设置
  `registry-url: https://registry.npmjs.org`。npm 已不推荐长期 token（2FA bypass
  token 正在被废弃），仅作临时方案。

## 首次发布

`@10coding/apply-to-css` 当前的 `0.1.0` 还没有发布到 npm，而 Trusted Publishing
不能发布第一个版本，因此首次发布仍按上面的方式在本地执行：

```bash
pnpm test
pnpm release
```

发布成功并配置好 Trusted Publisher 之后，后续版本交给 GitHub Actions 自动发布
（每次发布前先 `pnpm changeset`）。

## 前置条件

- 登录 npmjs（注意不要连同本机镜像源一起登录）：

  ```bash
  npm login --registry=https://registry.npmjs.org
  ```

  手动发布会要求输入 2FA 动态码；CI 发布使用 OIDC，不需要 token。
- 作用域包需要公开发布；`packages/apply-to-css/package.json` 已配置
  `publishConfig.access: "public"` 和 `publishConfig.registry: "https://registry.npmjs.org/"`，
  因此即使本机 registry 指向镜像源，发布时也会走 npmjs。
- 发布前建议先跑 `pnpm test`，并确认工作区没有未提交的改动。

## 配置说明

- `baseBranch: "master"`：与当前主分支一致。
- `access: "public"`：`@10coding` 作用域默认按公开包发布。
- `privatePackages`：playground 和 workspace 根包不会被 version / tag。
- `updateInternalDependencies: "patch"`：workspace 内部依赖按 patch 级别联动。
