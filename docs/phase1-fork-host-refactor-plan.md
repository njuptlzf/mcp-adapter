# Phase 1 实施计划：fork-host 架构重构（universal-host 伪装 ExtensionAPI）

> 状态：计划定稿，待开 issue 后分步实施（对应 issue：fork 宿主重构）。
> 配套：[architecture-review.md](./architecture-review.md)、[phase0-feature-diff-checklist.md](../.planning/milestones/phase0-feature-diff-checklist.md)（已归档）。
> 目标兑现「fork 宿主、不 fork 引擎」：非 Pi host 伪装成 `ExtensionAPI`，让上游 `index.ts` 引擎一行不改跑起来，退休 `adapters/entry.ts` 并行引擎。

## 1. 现状核实（v2.27.0 merge 后实测）

### 1.1 存在两个 `createMcpAdapter`

| | 上游引擎 | fork 并行引擎 |
|---|---|---|
| 文件 | `index.ts` L1145 | `adapters/entry.ts` L60 |
| 签名 | `createMcpAdapter(options)` → 返回 `(pi: ExtensionAPI) => void` | `createMcpAdapter(agentapi, ctx, config, cache)` |
| 泛型 | `ExtensionAPI`（Pi） | `AgentAPI`（fork 抽象） |
| 消费方 | Pi 原生（`pi install` 走默认导出 `createMcpAdapter()`） | `bin/mcp-server.ts`、`scripts/deploy-verify.ts`、多个 `__tests__` |

`bin/mcp-server.ts` L43 现在导入的是**并行引擎**：`import { createMcpAdapter } from "../adapters/entry.ts";`

### 1.2 上游引擎实际用到的 `ExtensionAPI` 最小面（index.ts 证据）

| 面 | 证据行 | universal-host 处理 |
|---|---|---|
| `pi.events`（status 事件发射器） | L145, L497 | 本地 EventEmitter（或空实现） |
| `pi.registerTool(tool)` | L238, L882, L930 | 写 tools Map |
| `pi.setActiveTools(names[])` | L290, L319, L1121 | 维护 active 集合，ListTools 按它过滤 |
| `pi.getActiveTools?.()` | L268 | 返回 active 集合 |
| `pi.unregisterTool?.(name)` | L278 | `tools.delete(name)` |
| `pi.getAllTools()` | L377, L444 | 返回注册工具名列表 |
| `pi.registerCommand(name, {handler})` | L395, L643, L829 | no-op（MCP 无 slash 命令；保留以过类型） |
| `pi.registerFlag("mcp-config", cfg)` | L446 | no-op |
| `pi.on(event, handler)` | L551,592,615,641 | `on("session_start"\|"input"\|"session_shutdown"\|"tool_result")` |

`ExtensionContext`（传给 handler 的 `ctx`）用到：`ui.notify` / `ui.form` / `ui.custom` / `ui.setStatus?` / `ui.theme?`、`hasUI`、`cwd`、`signal`、`reload`（L695–703、L834–842）。

### 1.3 要「归 0 diff」的 index.ts 改动面

`index.ts` 目前相对上游的 diff 集中在这几处 `: any`/`as` 补丁：
`L238/L882/L930`(`pi.registerTool as (tool: unknown) => unknown`)、`L551/L691/L831`(`: any`)、`L641`(`: any`)。根源是 pi-* 发布物 `.d.ts` 断链 → `ExtensionAPI`/`ExtensionContext` 退化成 `any`，被迫显式标注。Phase 1 用 `types/pi-host-shims.d.ts` 补齐缺的面，使这些补丁可删。

## 2. 设计：`adapters/universal-host.ts`

新文件 `adapters/universal-host.ts`，`UniversalMcpHost implements ExtensionAPI`（现 `bin/mcp-server.ts` 内联的 `InlineMcpAdapter` 逻辑上移复用到此，而非 `AgentAPI`）：

- `tools: Map<string, ToolRegistration>`、`activeTools: Set<string>`、`handlers: Map<string, Set<fn>>`、`events`(EventEmitter)。
- 实现上表 9 个 `ExtensionAPI` 成员；`registerCommand`/`registerFlag` 存内但 MCP `ListTools` 不暴露（no-op 语义，记录）。
- 事件驱动方法：`fireSessionStart(ctx)`、`fireSessionShutdown()`、`fireInput()`、`fireToolResult(details)`（原 `InlineMcpAdapter.fire` 逻辑）。
- `attachChannel`/`sendMessage`/`exec` 保留供 `openMcpPanel`/`openMcpSetup` 的传染路径使用（MCP stdio 下 `sendMessage`→stderr，`exec`→保留）。
- 附 `makeUniversalContext()` 构造 `ExtensionContext`（含 `ui` 适配 forwarder 的 `notify`/`form`，`hasUI`、`cwd`、`signal`、`reload: no-op`）。

## 3. 迁移阶段（每相可用 `tsc --noEmit` + `npm test` + `node mcp-server.mjs --help` 验证）

### Phase 1.1 — 补齐类型 shim（不动运行时代码）
- `types/pi-host-shims.d.ts` 增补 `ExtensionAPI` 全量最小面、`ExtensionContext`/`ExtensionUIContext`、`ToolInfo`/`AgentToolUpdateCallback`。
- 验收：`tsc --noEmit` 绿；`git diff upstream/main -- index.ts` 减少（`L551/L641/L691/L831` 的 `: any` 可删）。

### Phase 1.2 — 新建 `adapters/universal-host.ts`
- 从 `bin/mcp-server.ts` 的 `InlineMcpAdapter` 平移逻辑，改 `implements ExtensionAPI`。
- 验收：单独文件 `tsc` 绿；无运行时代码改动。

### Phase 1.3 — 重接 `bin/mcp-server.ts`
- 导入改为上游 `import { createMcpAdapter } from "../index.ts"`（或 `import mcpAdapter from "../index.ts"`）。
- `createMcpAdapter({ config, configPath })(host)`；`host.fireSessionStart(makeUniversalContext())`；`session_shutdown`/`input`/`tool_result` 由 MCP 生命周期触发。
- `ListTools` 改为按 `host.activeTools` 过滤、`CallTool` 走 `host.tools`。
- forwarder 注入逻辑（Pitfall 1/4/5）保持不变。
- 验收：`node mcp-server.mjs --help` exit 0；`npm pack --dry-run` 仍含 bundle；对 `.mcp.json` 做端到端 `list-tools`/`call-tool` smoke。

### Phase 1.4 — 退休并行引擎
- 删 `adapters/entry.ts`；`interfaces/agent-api.ts`、`adapters/pi-adapter.ts`、`interfaces/agent-channel.ts`（及其受影响的 `adapters/protocol-elicitation-forwarder.ts` 的类型引用改指向新的 shim 或泛化）。
- `scripts/deploy-verify.ts` 改走上游引擎 + `UniversalMcpHost`。
- 12 个测试文件按「并行引擎语义 → 上游引擎语义」迁移或删除（见 §4 引用清单）；`AGENT_ADAPTERS` 注册表相关测试改测 `UniversalMcpHost`。
- 验收：`npm test` 绿；`grep -r "adapters/entry"` 与 `grep -r "interfaces/agent-api"` 为空。

### Phase 1.5 — index.ts 归 0 diff
- 删除 Phase 1.1 后可删的 `: any`/`as` 补丁。
- 验收：`git diff upstream/main -- index.ts` 为空（或仅剩 `config.ts` 等已知 fork 逻辑）。

### Phase 1.6 — 对照 26 项验收清单
- 逐项核对 [phase0-feature-diff-checklist.md](./phase0-feature-diff-checklist.md)：22 ✅ 走 active-set / 增量 re-sync / 事件驱动在 MCP 路径下可观察；4 🔵 记录「转发/降级/no-op」。
- 全过后归档 checklist、关闭本阶段。

## 4. 并行抽象引用清单（Phase 1.4 迁移范围）

生产：
- `bin/mcp-server.ts` → 重接
- `scripts/deploy-verify.ts` → 改上游引擎
- `adapters/protocol-elicitation-forwarder.ts` → 类型引用改 shim
- `adapters/entry.ts` / `interfaces/agent-api.ts` / `adapters/pi-adapter.ts` / `interfaces/agent-channel.ts` → 退休

测试（迁移或删除）：
`__tests__/entry.test.ts`、`capability-gate.test.ts`、`agent-adapters-registry.test.ts`、`adapter-contract.test.ts`、`integration.test.ts`、`mock-adapter.test.ts`、`pi-adapter.test.ts`、`protocol-elicitation-forwarder.test.ts`、`compatibility/legacy-pi-mock.test.ts`、`compatibility/non-pi-agent.test.ts`、`fixtures/mock-agent.ts`、`fixtures/mock-agent-api.ts`。

## 5. 风险与决策点

1. **`setActiveTools` 语义**：MCP `ListTools` 从「注册即暴露」改为「按 active 集合暴露」——这是 22 ✅ 项（C5/C6/D4）正确落地的关键，需端到端验证不会少暴露工具。
2. **`registerCommand`/`registerFlag` 的 no-op 边界**：MCP stdio 无命令面，`/mcp`、`/mcp-auth`、prompt 命令、`mcp-config` flag 全部变内在 no-op；需在 README/skill 文档化「MCP 客户端直接调工具、无命令」。
3. **`exec`/`sendMessage` 传染路径**：`openMcpPanel`/`openMcpSetup` 依赖宿主 exec/spawn 起动配置界面；MCP stdio 下应降级为返回文本指引（🔵 D 类），需确认无崩溃。
4. **测试面大迁移**：12 个测试文件的语义从「并行引擎」变「上游引擎」，是本阶段最大的机械工作量与回归风险源。
5. **0-diff 边界**：`config.ts`（29/12）是真 fork 逻辑，不追求归 0；只针对 `index.ts` 追平 upstream。

## 6. 关键发现（Phase 1.2 时核实，影响 Phase 1.3 重接与验收口径）

- **采样/引发与「哪个引擎」无关**：`entry.ts` 与 `index.ts` 都调用同一个 `init.ts` 的 `initializeMcp`，采样/引发配置都走 `manager.setSamplingConfig/setElicitationConfig`（init.ts L135–153）→ `sampling-handler.ts` / `server-manager.ts`。所以重接不会改变采样/引发行为，回归面只落在 A/B/C/D 注册与生命周期差异。
- **fork 的 `ProtocolSamplingForwarder`（D-11「纯转发」）在当前代码里是死脚手架**：`ctx.samplingProvider` 只在 `bin/mcp-server.ts` L393 被赋值，`sampling-handler.ts`/`server-manager.ts` 从不清读它；引擎的采样走 `@earendil-works/pi-ai` 的 `complete()` + `modelRegistry`（Pi 原生）。headless 的 MCP-stdio host 没有模型 → 采样本就不可用。这不是重接引入的回归，是 fork 既有的 gap，**另开 issue 跟进**（不在本阶段收口）。
- **引发转发是好的**：`ProtocolElicitationForwarder` 经 `ctx.ui.form` → `manager.setElicitationConfig({ ui })` 链路生效，重接时保留 `ctx.ui = { notify, form }` + `ctx.hasUI = true` 即可。
- **重接的另一关键差异**：上游引擎注册的工具 execute/render 签名是 Pi 原生的（期待 `ExtensionContext`），与并行引擎 `AgentAPI` 的 execute 签名不同；`bin/mcp-server.ts` 的 `CallTool`/`ListTools` handler 需改为按上游工具的签名调用（Phase 1.3 重点）。

## 7. 实施进度（跨 goal-round 状态）

| 阶段 | 状态 | 证据 |
|---|---|---|
| 1.2 `adapters/universal-host.ts` | ✅ | `tsc` 绿；auto-activate 与 `__tests__/index-lifecycle.test.ts` 的 `createStatusObservingPi` mock 语义一致 |
| 1.3 重接 `bin/mcp-server.ts` | ✅ | `tsc` 绿；`mcp-server.mjs` 7.2MB；`--help` exit 0；注册 `mcp`+`mcpScript`/命令/flag |
| 1.4 退休并行引擎 | ✅ | 删 5 源文件 + 11 测试；新增 `interfaces/host-types.ts`；`deploy-verify.ts` 走上游引擎；`integration.test.ts` 重写 |
| 1.5 `index.ts` 归 0 diff | ✅ | 删 4 处 `: any` + 删 4 个 `types/pi-*.d.ts` shim + `npm install` 对账；保留 3 处 `as`（RenderTheme 边界，非 shim 产物，见「Phase 1.5 结论」） |
| 1.6 26 项验收 + 归档 | ✅ | 26/26 验收（22 ✅ 三层测试证据 + 4 🔵 转发/降级）；新增 `universal-host-acceptance.test.ts`(6)；清单归档 `.planning/milestones/`；陈旧 docs（comparison/FAQ/test-plan）归档 `.planning/archive/`；`MAPPING.md` 重写为 UniversalHost→ExtensionAPI 映射 |

### 实施中解锁的语义

- `UniversalMcpHost.getAllTools()` 返回宿主自有工具（`mcp`/`mcpScript`）；`runMcpScript`/`executeCall` 的下游工具发现走 `state.toolMetadata`，`getPiTools` 不参与解析 —— 无副作用。
- `registerTool` 里 auto-add 到 activeTools（Pi「注册即激活」语义），否则 `syncProxyTool` 首调 `registerProxyTool` 后直接 return，`setActiveTools("mcp")` 永不执行，`ListTools` active 集合为空。
- 采样/引发与引擎无关（共用 `init.ts`），重接不回归采样行为；`ProtocolSamplingForwarder` 仍为死脚手架（另开 issue）。

### 全量测试基线对照（Phase 1.4 收尾时实测）

方法：`git worktree add mcp-adapter-baseline main`（`main` == 当前分支基底 `882fa37`，两阶段均未 commit），junction 复用同一份 `node_modules`，两边各跑 `npx vitest run`，按失败文件集合做 set-diff。

| 集合 | 结果 |
|---|---|
| 基线（纯净 main） | 30 failed / 95 passed（125 文件；112 失败用例） |
| 当前分支 | 19 failed / 97 passed（116 文件；92 失败用例） |
| **仅当前失败（本次引入）** | **0 ✅ 零回归** |
| 两边都失败（预存确定失败） | 19 个（完全相同集合） |
| 仅基线失败 | 10 个 |

- **19 个确定失败**属环境/平台类，与重构零接触：`config`(42)、`cli`(12)、`elicitation-sdk-integration`(10)、`server-manager-unix-socket`(4)、`prompts/init-elicitation/request-headers-command`、`mcp-auth-storage/commands-panel-auth-storage/onboarding-state/exclusive-config`、`mcp-references/proxy-modes-discovery/tool-registrar-structured-content/tool-result-renderer/interactive-visualizer-server/agent-dir-paths/agent-paths-integration/commands-onboarding`、`tool-registrar`。
- **仅基线失败的 10 个**：`integration.test.ts`（重写后修复其 2 个预存失败）+ 9 个 spawn/时序 flaky（`direct-tools-child-startup`、`mcp-server-e2e`、`namespace-tools`、`lifecycle-lazy-keep-alive-init`、`server-manager-reconnect/legacy-handshake/instructions/auth-cache-recovery`、`tests/smoke/calculator-smoke`）。它们的基线失败报文为 `taskkill 128` / `Command failed: node --import tsx` / `Hook timed out` / `did not offer pinned protocol version`；当前分支同一代码两次全量跑本身也从 26→19 failed 漂移，佐证为 flaky。

### Phase 1.5 结论（`: any` 已删、`as` 保留）

- **0-diff 基线**：应是上游 tag `v2.27.0^{}`（`dd380db1`），不是 `upstream/main`（已到 v2.28.0/v2.29.0，多了 event-based runtime registration `MCP_RUNTIME_REGISTER_EVENT`，属下次 upstream-merge 输入）。
- **根因是 fork 的 4 个类型 shim**（`types/pi-coding-agent.d.ts` 等）：把 `ExtensionAPI = any` 整体抹掉，导致 `pi.on(...)`/`registerCommand(...)` 回调参数无上下文类型（TS7006）→ 才需要 4 处 `: any`。它们本是 0.84.3 漂移期的补丁。
- **修复三步**：① `npm install` 对账（pi-coding-agent 0.84.3→0.84.1，装齐嵌套 pi-* 依赖；`package-lock.json` 约 156 行）→ 真实 pi-* 类型恢复；② **删 4 个 shim**（122 行）；③ **删 4 处 `: any`**。`tsc` 绿。
- **保留 3 处 `(pi.registerTool as (tool: unknown) => unknown)(...)`**：**这是上游原生代码，非 fork 补丁**。`git show dd380db:index.ts` 与 `upstream/main:index.ts` 均有 3 处，且上游 `tool-result-renderer.ts` 的 `RenderTheme.fg` 同为 `(name: string)` 松类型（靠 `as` 桥接 pi-* 泛型 `Static<TSchema>`）。保留即 0-diff；删除反而制造与上游的分叉（实测删掉对照上游同样 9 处 TS2322 rendder 失配——上游也没删，故无从「对齐」）。运行时等价（类型擦除）。
- **顺带修**：`oauth-public-api.test.ts` 的 `pi-mcp-adapter/oauth` → `@njuptlzf/mcp-adapter/oauth`（重命名后一直靠残留 self-symlink 掩盖，`npm install` prune 后暴露）。
- 验收：`tsc --noEmit` 绿；`build:public`/`build:mcp-server`（bundle 7.2→9.9MB，因装齐嵌套 pi-* 依赖）绿；`--help` exit 0；`index-lifecycle`(58)+`mcp-code`(22)+`integration`(4)+两 forwarder = **94 passed / 1 skipped**。

---

## 8. 遗留与后续（Phase 1.6 收尾时登记）

- ✅ **README.md 重写**：已按「fork 宿主 + `@njuptlzf/mcp-adapter`」重写——去除 AgentAPI/AGENT_ADAPTERS/PiAdapter/PiSamplingProvider 叙事；Quick Start 改为 `mcpAdapter(pi)` + `createMcpAdapter({ config })(pi)`；安装命令改 `pi install npm:@njuptlzf/mcp-adapter`；构建改 `npm run build:mcp-server`。残余 `pi-mcp-adapter init` 为 CLI bin 名（package.json `bin` 保留），命名 wart 见下。
- ✅ **3 处 `as (tool: unknown)` cast**（不适用，已撤销）：查实为上游 v2.27.0/v2.28.0 原生代码（`RenderTheme` 松类型桥接 pi-* 泛型），非 fork 补丁，保留即 0-diff。
- ✅ **脚本审计**：`check-import-region.ts`/`check-large-functions.ts` 保留（仍为 merge-conflict 早期告警），机制不变，仅把头注释/报错文案从「AgentAPI 抽象」reframe 为「core 上游管控，新增 pi- import = drift 信号」。
- **CLI bin 命名 wart**：package `bin` 仍叫 `pi-mcp-adapter`（→`cli.js`）与 `mcp-adapter`/`mcp-server`（→`mcp-server.mjs`）；重命名包后建议把 CLI bin 一并收口为 `mcp-adapter`，属 Stage 1 收尾。
- **upstream v2.28.0 merge**：`MCP_RUNTIME_REGISTER_EVENT` event-based runtime registration。
- **`interfaces/sampling.ts`**：保持死代码（`ProtocolSamplingForwarder` 死脚手架），单独 issue。