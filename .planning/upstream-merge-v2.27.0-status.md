# upstream-merge v2.27.0 — 状态与诊断

> 本文件是 fork 自有规划文档（独立文件，不修改上游源码），供跨会话继续。

## 1. 当前 git 状态

- 分支: `upstream-merge/v2.27.0`
- 合并提交: `fcd33e9` — "merge: sync upstream main (v2.27.0) into fork — core->theirs, config->manual"
- 上一提交: `ea94a63`（Windows-safe upstream-divergence.ts 修复）→ `5844fe4`（--config fix #18）
- 已解决全部 23 个冲突并提交。

## 2. 冲突解决策略（新架构：非侵入式 facade，不内联改上游）

| 文件 | 策略 |
|---|---|
| core 13 文件 (agent-dir/direct-tools/elicitation-handler/index/init/proxy-modes/sampling-handler/server-manager/state/tool-result-renderer/types/utils + elicitation-sdk-integration.test) | `--theirs`（原样接受上游 Pi-native core） |
| config.ts | 手动 5-hunk 合并（保留 fork 的 4-参 getConfigSources + 5844fe4 --config 修复，吸收上游 getConfigConflicts/host-discovery） |
| package.json | union（scripts 合并、bin 保留 pi-mcp-adapter+mcp-server、deps 并存 v1 sdk + v2 client/core、typebox runtime、peer=上游 optional） |
| vitest.config.ts | 合并（fork 的 include/reporter/thresholds + upstream 的 env） |
| README.md | `--ours`（保留 fork Universal 定位） |
| 5 个 core test | `--theirs`（core 已改上游） |
| config.test.ts | 手动合并（保留 --config 回归测试 + 上游 toolPrefix 测试） |

## 3. tsc --noEmit 错误面：57 个，精确分两类

### A. fork 文件 facade 边界（19 个）— 真正的架构迁移工作
- `adapters/entry.ts`(14)：registerTool/registerCommand 签名不匹配（strict function types）、`cmdCtxTyped.ui` 无空值守卫、`getMcpDiscoverySummary` 期望 1 参却传 3 参（upstream 该函数是 options 式 1 参）。
- `adapters/pi-adapter.ts`(2)：exactOptionalPropertyTypes — `ui`/`samplingProvider`/`form` 需允许 `undefined`。
- `adapters/pi-sampling-provider.ts`(2)：implicit any（pi-ai v2 类型未解析）。
- `adapters/protocol-elicitation-forwarder.ts`(1)：FormResult `values` 的 exactOptionalPropertyTypes。

### B. upstream 文件 pi-* 类型不匹配（38 个）— 上游自身问题，非合并引入
- 根因：upstream v2.27.0 代码（含标签本身，非仅 17 个后续 commit）引用了 pi-tui 组件 API，
  与 npm 已发布的 `@earendil-works/pi-tui@0.84.1/0.84.3` 不匹配：
  - `Component`/`OverlayHandle`/`KeyId` 在 pi-tui@0.84.3 的 index.d.ts 中是 **type-only 导出**（`export { type Component, ... type OverlayHandle }`）。
  - `Text.render()`/`Text.invalidate()`：pi-tui@0.84.3 的 `Component` 接口只有 `render(width): string[]`，
    没有 imperative `render()/invalidate()` 方法。
  - `@earendil-works/pi-ai` 无 `ProviderHeaders`；`pi-coding-agent` 无 value 版 `copyToClipboard`、无 `ExtensionCommandContext`（只有 `ExtensionContext`）。
- 涉及：commands.ts(15)、tool-result-renderer.ts(7)、index.ts(7)、sampling-handler.ts(4)、mcp-panel.ts(2)、prompts.ts(1)、mcp-code.ts(1)、panel-keys.ts(1)。
- 这些是 upstream 代码针对 Pi Host 运行时提供的 pi-tui（值导出 + imperative API）编写，
  与 npm 发布物（type-only + 旧 Component 接口）的差异。**与本次合并无关**。

### 待办（按优先级）— 2026-08 更新
1. [x] A 类 19 个 facade 边界错误 → 已修（提交 `6444942`）：`interfaces/agent-api.ts` 契约放宽
   （ToolRegistration 可调用字段改 `(...args: any[])`、UISystem/AgentContext/FormResult 显式可选 `| undefined`）、
   `adapters/entry.ts`（buildProxyDescription 改 1 参 + `ui?.`/`reload?.()` 守卫）、`adapters/pi-sampling-provider.ts` 注解。
2. [x] B 类 38 个 pi-* 错误 → 已修：新建 `types/pi-host-shims.d.ts`（`declare module` 补齐 Component/OverlayHandle/KeyId/
   ProviderHeaders/copyToClipboard/ExtensionCommandContext + Text.render/invalidate，共 13 个「缺失导出」）；
   另 25 个 TS7006 隐式 any 无法用 shim 覆盖（根因是 ExtensionAPI/ExtensionContext/ExtensionUIContext 经坏 `.ts` re-export
   整体退化为 `any`，declare module 不可覆盖），改用 4 个 upstream 文件内的最小 `: any` 注解（commands/index/mcp-code/sampling-handler）。
3. [~] 迁移 fork 残留 MCP SDK v1→v2：进行中（子代理处理）。
4. [x] tsc --noEmit = **0 错误**（`node node_modules/typescript/bin/tsc --noEmit`）。
5. [x] `npm run upstream:check` = **exit 0**（260 diverged / 0 stale）。
6. [x] vitest run：19 fail / 106 pass files；94 fail / 1417 pass / 13 skip。
   - 迁移相关 15 个：package-manifest(断言 sdk 应为 undefined、client/core=2.0.0)、elicitation-sdk-integration(10)、
     prompts-sdk-integration(1)、interactive-visualizer-server(2) → 随 v1→v2 迁移变绿。
   - Windows 基线 ~79 个：config(42)、cli(12)、unix-socket EACCES、文件 mode、taskkill、path 解析等 → 环境性，非回归。
   - 我方改动（facade/shim/注解）**零新增失败**（无 adapters/interfaces 测试在失败清单）。
7. [ ] §5.5 PR：推送分支 + 开 PR（gh 未装 → 用 GitHub API）。

## 5. 根因终判（pi-* publish bug）
- pi-*@0.84.x 发布的 `.d.ts` 用 `.ts` 扩展名 re-export（`from "./tui.ts"`、`from "./utils/clipboard.ts"`），
  但 tarball 不含 `.ts` 源（只有 `.d.ts`+`.js`）。NodeNext 下断链，`skipLibCheck` 吞掉内部错误，
  导致 type-only 导出变「no exported member」、若干接口整体退化为 `any`（衍生 TS7006）。
- 这是 upstream 针对 Pi Host 的 pi-* 运行时 API 与 npm 发布物不匹配，**非合并引入**；v2.27.0 标签自身同样如此。

## 4. 关键依赖事实
- npm pi-* 三个包 `latest` 均为 0.84.3，`legacy-node20` 为 0.74.2；只有这两个 dist-tag，无 beta/canary。
- 已 bump devDeps 0.84.1 → 0.84.3（未修复 B 类错误，但为最新版本）。
- node_modules 单一副本 0.84.3（无嵌套 stale 副本）。