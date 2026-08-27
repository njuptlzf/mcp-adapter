# package.json repackage 改造计划（独立发布 @njuptlzf/mcp-adapter）

> 状态：已定稿（决策点已确认）；`chore/repackage-scoped-package` 分支已按本计划落地并验证。
> 关联：architecture-review.md、phase0-feature-diff-checklist.md。

## 目标

把 fork 从「贴着上游 `pi-mcp-adapter` 的占位包」改成可独立发布的 npm 包，为后续「fork 宿主」重构 PR 提供事实基础与发布通道。

背景：
- [docs/architecture-review.md](docs/architecture-review.md)（架构方向）
- [docs/phase0-feature-diff-checklist.md](docs/phase0-feature-diff-checklist.md)（26 项 feature 验收）
- [docs/package-repackage-plan.md](docs/package-repackage-plan.md)（本计划全文）

## 命名现状（实测）

| npm 名 | 状态 |
|---|---|
| `pi-mcp-adapter` | 上游占用（latest 2.27.0） |
| `mcp-adapter` | 无关第三方占用（v1.0.0） |
| `@njuptlzf/mcp-adapter` | ✅ 可用 |

## 变更清单

### A. 本次点名必改（4 项）

1. `name` → `@njuptlzf/mcp-adapter`（scoped，避开上游与第三方）
2. `bin.mcp-server` → `mcp-server.mjs`（预构建 bundle，让 `npx` 零安装成立）+ 新增 `bin.mcp-adapter` 别名（`npx @njuptlzf/mcp-adapter` 无二义入口）
3. 删除悬空自依赖 `pi-mcp-adapter@^2.10.0`（全文无任何 import）
4. `repository`/`author` 指向 fork，并用 `contributors` 保留上游署名（MIT 合规）

### B. 必要配套（否则 A 无法落地）

5. `files` += `mcp-server.mjs`
6. `scripts` += `build:mcp-server`（自建 `scripts/build-mcp-server.mjs`，见下方「构建修正」）
7. `scripts` += `prepublishOnly`（publish 前自动生成 bundle）
8. `devDependencies` += `esbuild`（`^0.28.0`，与 `tsx`/`vite` 的传递依赖去重，避免双版本）

### C. 建议一并（fork 身份）

9. `version` `2.27.0` → `2.27.0-0.0.1`（自定义：**前缀永远跟随上游，后缀是 fork 改动版本**；发布时 `npm publish --tag latest` 强制顶到 latest）
10. `description` 更新为 Universal 定位
11. 新增 `bugs` / `homepage`

### D. 落地新增（本计划执行时补充）

12. 新增 `scripts/build-mcp-server.mjs`（见「构建修正」）
13. `.gitignore` += `/mcp-server.mjs`（bundle 不入仓，prepublish 生成）

## 待确认决策点（已确认）

1. ~~version 用 3.1.0 还是别的 semver？~~ → **`2.27.0-0.0.1`**（前缀跟上游 2.27.0 + 后缀 fork 版本，发布时 `--tag latest`）。
2. ~~author 填真实姓名/组织？~~ → 暂用 **`njuptlzf`**。
3. ~~contributors 保留 Nico Bailon？~~ → **保留**（MIT 署名合规）。
4. ~~mcp-server.mjs 是否入仓？~~ → **不入仓**，CI/`prepublishOnly` 生成（并 gitignore）。

## 构建修正（实测发现）

issue 草稿里最初的 `build:mcp-server` 一行为
`esbuild bin/mcp-server.ts --bundle --platform=node --format=esm --outfile=mcp-server.mjs`，
**实际产出的是坏包**：`cross-spawn` 等 CommonJS 依赖在运行时做 `require("child_process")`，
纯 `--format=esm` 输出无法满足，`node mcp-server.mjs --help` 直接
`Error: Dynamic require of "child_process" is not supported`。

因此落地为自建构建脚本 `scripts/build-mcp-server.mjs`，做三件事：

1. `banner.js` 注入 `import { createRequire as __bannerRequire } from 'node:module'; const require = __bannerRequire(import.meta.url);`，让 ESM bundle 内仍可 `require` 内建模块；
2. `minify: true`（bundle 约 7.2MB，未压缩约 14MB）；
3. 把入口继承的 `#!/usr/bin/env npx tsx` shebang 改成 `#!/usr/bin/env node`（否则 Unix 下 npx 安装后会错误地经过 tsx 启动）。

验证：`node mcp-server.mjs --help` 正常打印 Usage（exit 0）。

## diff 草稿（package.json）

```diff
--- a/package.json
+++ b/package.json
@@ -1,7 +1,7 @@
 {
-  "name": "pi-mcp-adapter",
-  "version": "2.27.0",
-  "description": "MCP (Model Context Protocol) adapter extension for Pi coding agent",
+  "name": "@njuptlzf/mcp-adapter",
+  "version": "2.27.0-0.0.1",
+  "description": "Universal MCP (Model Context Protocol) adapter — Pi as a first-class host, plus any MCP-compatible coding agent via the universal mcp-server entry",
   "type": "module",
   "types": "./index.ts",
   "exports": {
@@ -32,13 +32,17 @@
     }
   },
   "license": "MIT",
-  "author": "Nico Bailon",
+  "author": "njuptlzf",
+  "contributors": [
+    "Nico Bailon"
+  ],
   "engines": {
     "node": ">=20"
   },
   "bin": {
     "pi-mcp-adapter": "cli.js",
-    "mcp-server": "bin/mcp-server.ts"
+    "mcp-adapter": "mcp-server.mjs",
+    "mcp-server": "mcp-server.mjs"
   },
   "scripts": {
     "test": "npm run test:prebuild && vitest run",
@@ -50,7 +54,9 @@
     "check:large-functions": "tsx scripts/check-large-functions.ts",
     "check:import-region": "tsx scripts/check-import-region.ts --base origin/main",
     "build:public": "tsc -p tsconfig.public.json",
+    "build:mcp-server": "node scripts/build-mcp-server.mjs",
     "prepare": "npm run build:public",
+    "prepublishOnly": "npm run build:mcp-server",
     "typecheck": "tsc --noEmit",
     "test:vitest": "vitest run",
     "test:public-exports": "npm run build:public && node --test public-exports.test.mjs",
@@ -60,8 +66,12 @@
   },
   "repository": {
     "type": "git",
-    "url": "git+https://github.com/nicobailon/pi-mcp-adapter.git"
+    "url": "git+https://github.com/njuptlzf/mcp-adapter.git"
+  },
+  "bugs": {
+    "url": "https://github.com/njuptlzf/mcp-adapter/issues"
   },
+  "homepage": "https://github.com/njuptlzf/mcp-adapter#readme",
   "keywords": [
     "pi-package",
     "pi",
@@ -157,9 +167,10 @@
     "skills",
     "README.md",
     "CHANGELOG.md",
 "MAPPING.md",
     "LICENSE",
-    "dist"
+    "dist",
+    "mcp-server.mjs"
   ],
   "dependencies": {
     "@modelcontextprotocol/client": "2.0.0",
@@ -171,7 +182,6 @@
     "ajv-formats": "^3.0.1",
     "cross-spawn": "^7.0.6",
     "open": "^10.2.0",
-    "pi-mcp-adapter": "^2.10.0",
     "recheck": "^4.5.0",
     "smol-toml": "^1.6.1",
     "strip-json-comments": "^5.0.3",
@@ -205,6 +215,7 @@
     "@types/node": "20.19.43",
     "@types/open": "^6.2.1",
     "@vitest/coverage-v8": "^3.2.6",
+    "esbuild": "^0.28.0",
     "tiktoken": "^1.0.22",
     "tsx": "^4.21.0",
     "typebox": "1.3.3",
```

## 验收标准（PR 落地后）

- [x] `npm pack --dry-run` 产物包含 `mcp-server.mjs`，且不含 `pi-mcp-adapter` 自依赖
- [x] `node mcp-server.mjs --help` 能拉起 `mcp-server`（exit 0）
- [ ] `npx -y @njuptlzf/mcp-adapter` 能拉起 `mcp-server`（需先实际 publish 后本地安装验证）
- [ ] `pi install npm:@njuptlzf/mcp-adapter` 可用（`pi.extensions` 字段生效）
- [x] `npm run build:mcp-server` 可复现产出 `mcp-server.mjs`
- [x] package-manifest 相关测试仍绿（已移除自依赖）

## 后续（不在本 PR）

- `release.yml`：tag → esbuild 打包 + GitHub Release asset + `npm publish --access public --tag latest`
- `pi.video` 仍指向 upstream raw 资源，需检查是否替换
- `MAPPING.md` 列首无缩进的格式小问题可顺手修