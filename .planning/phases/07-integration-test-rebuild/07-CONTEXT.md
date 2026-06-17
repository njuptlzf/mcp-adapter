# Phase 7: Integration Test Rebuild - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

将 `skills/mcp-adapter-test/` skill 从"Pi-only 验证流程"重构为"for every agent"——任何已注册 `AgentAPI` 适配器(Pi / Qoder / 未来 Claude / Cursor 等)都能在同一套流程里被自动发现、Capability Gate 判定、跑通 MockAgent 兼容性(分层矩阵)、token benchmark(注明 baseline-bound)、per-adapter 契约验证、E2E。同时把 `README.md` 重写为"Pi is a first-class supported adapter + every agent is welcome"的产品价值定位,并将 `tests/reports/mcp-adapter-test-report.md` 统一为 matrix 报告格式。FIX-01 同步处置 2 个 pre-existing `interactive-visualizer-server.test.ts` 失败(添加 prebuild 步骤)。本次重构同步考虑与 Phase 8 (UPSTREAM-04) 的兼容性,SKILL.md 采用"主文件 + per-agent references"结构,降低未来 upstream merge 的冲突面。

不在 Phase 7 范围:
- 引入 Claude / Cursor 等新 adapter 的实现(它们是 Phase 7 之后独立的 phase)
- 调整 Section 5/5B 目标阈值(94% / 56% 是 baseline-bound,不是 regression)
- 改 Phase 8 已经在 ROADMAP.md 中定义的"Upstream Merge"工作流
</domain>

<decisions>
## Implementation Decisions

### Capability Gate 抽象化 (TEST-01, TEST-02)
- **D-01:** Capability Gate **使用 AgentAPI 抽象层检测**——`await adapter.getAllTools()` 返回的 tool name 集合,根据是否存在 `'mcp'` / `^<server>_` 决定走 Path A / B / C。Pi / Qoder / 未来 adapter 都不需要修改 source,只需实现 `getAllTools()` 方法。
- **D-02:** Gate 输出统一为表格:`Agent | Adapter | Path | Tools | Resolved`;遇到 Path C 明确标注 "mcp-adapter NOT loaded as extension in this environment",符合 `__tests__/qoder-adapter-integration.test.ts` 既有事实。
- **D-03:** Gate 步骤从 SKILL.md Phase 4 Step 3 抽出为**独立"Capability Gate"step**,在 Phase 4 之前执行(skill 现行 §122-138 顺序仍保留但位置前置);任何 agent 都遵循同一 Gate 流程。

### Per-Adapter 契约验证框架 (TEST-04)
- **D-04:** 框架采用 **Parametric 模式**——`__tests__/adapter-contract.test.ts` 接受 `describe.each([['pi', () => new PiAdapter(...)], ['qoder', () => new QoderAdapter(...)]])` 形式的 adapter 工厂列表,所有 8 个 `AgentAPI` 方法的契约用例对每个 adapter 实例动态展开。**一个文件覆盖所有 adapter**,避免 per-adapter 文件的 L-7 类型 grep 不一致问题。
- **D-05:** 8 个契约方法清单:`registerTool` / `registerCommand` / `registerFlag` / `on` / `getAllTools` / `getFlag` / `sendMessage` / `exec`;每个方法至少 2 个用例(基本调用 + 错误/边界条件)。
- **D-06:** 测试运行层:**8 个 AgentAPI 契约用例 × N 个 adapter**(默认 CI 跑 Pi+Qoder = 16 个,加新 adapter 自动展开),**40 个 server 用例仅在 MockAgentAPI 上跑 1 遍**(server-agnostic 验证不需 per-adapter 重复)。`AGENT_API_FULL_MATRIX=1` 环境变量可选开启"全 N×44" 矩阵,默认 CI 走分层轻量模式。

### Adapter 自动发现机制 (TEST-03 + 后续可扩展)
- **D-07:** Phase 7 引入**静态注册表**——`interfaces/agent-api.ts` 内 `export const AGENT_ADAPTERS: AgentAdapterDescriptor[]` 数组,新 adapter 只需 import 并 `push` 一个 descriptor(`{ id, factory, displayName, envHints, capabilities }`),test runner / Capability Gate / README 矩阵 / 报告 matrix 自动发现。`createPiResolver` / `createQoderResolver` 模式后,descriptor 同时包含 path resolver 信息。
- **D-08:** 现有 Pi-specific MockAgent **彻底替换为通用 MockAgentAPI**——`__tests__/fixtures/mock-agent-api.ts` 实现所有 8 个 AgentAPI 方法的可控 mock(返回 `Map` / `Set` / `vi.fn()`,无 Pi 任何引用);**旧 `mock-agent.ts` 移至 `__tests__/compatibility/legacy-pi-mock.test.ts` 并标记 deprecated**,保留供对照而不影响主测试。
- **D-09:** 现有 `__tests__/adapter-contract.test.ts`(Phase 1) 文件重写,以 `AGENT_ADAPTERS.map(a => a.factory)` 作为 describe.each 入参;旧 44 case 重构为分层:40 server 用例 → MockAgentAPI 下,8 AgentAPI 用例 → `describe.each(AGENT_ADAPTERS)` 下。

### SKILL.md Agent-Agnostic 化 (TEST-05)
- **D-10:** `skills/mcp-adapter-test/SKILL.md` 改为**主文件 + per-agent references** 结构——主文件变 short parametric(描述每个 Phase / Step 的"做什么"语义),agent-specific 的"怎么调用"细节放 `skills/mcp-adapter-test/references/agent-paths/pi.md` / `qoder.md` / `_template.md`。新加 adapter 时创建对应 `references/agent-paths/<agent>.md` 即可,主 SKILL.md 不修改。
- **D-11:** 主 SKILL.md 中的"Phase 4" 改为 "**Phase 4: Per-Path Verification**",表格描述每个 Path 的"检查什么"语义,移除 agent 专属措辞(Path A 的 `mcp({})` 调用示例归入 references/agent-paths/pi.md 的"Path A 调用样例"小节)。Phase 8 UPSTREAM-04 兼容性:主 SKILL.md 变 short,upstream merge 时冲突面缩窄。

### Section 5/5B 目标说明 (S-2 经验)
- **D-12:** Section 5/5B 阈值保留(≥95% / ≥65%),但 SKILL.md 在对应 Phase 加 "🟡 baseline-bound" 说明——94% / 56% 的实际值由 agent-agnostic proxy serializer (`adapters/tool-registrar.ts`) 与 demo-server fixture 决定,**与 adapter 无关**;所有 adapter (Pi / Qoder) 实测值相同,这是 fixture 边界,不是 regression。
- **D-13:** 验证报告的"Target Miss" 状态文案改为 "🟡 baseline-bound (fixture-determined, identical across adapters)",允许其与 "🟢 Pass" 并存,避免误读。

### Pre-existing Test 失败处置 (S-3 经验 / FIX-01)
- **D-14:** FIX-01 方案为**添加 prebuild 步骤**——`package.json` 加 `"test:prebuild": "tsc -p examples/interactive-visualizer && node examples/interactive-visualizer/scripts/build.mjs"`,`"test": "npm run test:prebuild && vitest run"`。同时 `vitest.config.ts` 的 `globalSetup` 监听 `dist/` 缺失时自动 build,避免开发者忘记。
- **D-15:** 完成后,`__tests__/interactive-visualizer-server.test.ts` 维持现有 2 个用例,运行时不再失败;`06-UAT.md` "Known Issues" 中此条移至"Resolved"。

### 报告格式统一化
- **D-16:** `tests/reports/mcp-adapter-test-report.md` 改为 **Matrix 报告统一格式**——顶部表格显示 `agent × section` 的 pass count,以下逐 section 详情(每个 section 内仍按 agent 分子表)。Phase 6 生成的 `qoder-adapter-test-report.md` 弃用,合并到主报告的 Qoder 列。
- **D-17:** 报告输出**Markdown 单格式**(人读)+ **JSON 旁路输出**(`tests/reports/mcp-adapter-test-report.json`,供 CI / dashboard 解析);JSON 由 vitest setup 钩子自动产出,不需新增脚本。

### README 重写定位 (DOC-01, DOC-02, DOC-03)
- **D-18:** README.md 走 **Pi-first-class + Matrix 副线**——Hero 写"Universal MCP Adapter" + "Pi is a first-class supported adapter (not legacy) + every agent is welcome";Hero 后紧跟 **Supported Agents 矩阵**(表格列: Agent | Status | Default config path | Path resolver | Sampling | Renderer | Verified at),目前 Pi + Qoder 两行,新 adapter 加行即可;**Verification 章节**链接主测试报告并展示最新 matrix 摘要。
- **D-19:** Quick Start 给出**两套入口点代码对比**——左 `mcpAdapter(pi)` (Pi 直接调用,向后兼容),右 `createMcpAdapter(adapter, ctx, config, cache)` (通用入口,任何 AgentAPI 适配器);DOC-03 满足。
- **D-20:** README 中 "Universal" 措辞替换 "Agent-agnostic"——避免暗示 Pi 不是 first-class;Pi 适配器与 Qoder 适配器在 README 中**视觉对称**。

### Phase 8 兼容性预留 (UPSTREAM-04)
- **D-21:** Phase 7 重构**主动为 Phase 8 做准备**——SKILL.md 拆分为"主文件 + per-agent references" (D-10/D-11),Phase 8 UPSTREAM-04 ("Minimize source file modifications during Phase 5-6 by preferring adapter/wrapper patterns") 的工作面已经在 Phase 7 落地;`adapters/` 目录结构稳定,UPSTREAM-01 写变化清单时可直接复用 D-11 拆分的粒度。

### the agent's Discretion
- `AGENT_ADAPTERS` 注册表的 TypeScript 类型细节(`AgentAdapterDescriptor` 字段、envHints 形式)由实现者定夺
- `globalSetup` 的 build 触发逻辑具体形态(监听文件 vs 一次性 build)由实现者权衡
- 报告 JSON schema 字段集由实现者按需扩展

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Interfaces (Phase 1-6 产出)
- `interfaces/agent-api.ts` — `AgentAPI` / `AgentContext` / `UISystem` / `ToolInfo` 接口定义;**Phase 7 在此文件新增 `AGENT_ADAPTERS` 静态注册表**
- `interfaces/agent-paths.ts` — `AgentPathResolver` 契约;`createPiResolver` / `createQoderResolver` / `AgentId` 联合类型
- `interfaces/sampling.ts` — `SamplingProvider` / `SamplingModel` / `SamplingRequest` 接口
- `adapters/entry.ts` — `createMcpAdapter` 通用入口(目标调用方)
- `adapters/pi-adapter.ts` — `PiAdapter` 参考实现(行为参照)
- `adapters/qoder-adapter.ts` — `QoderAdapter` 第二适配器实现(行为参照)

### Phase 5 Output
- `adapters/pi-sampling-provider.ts` — `PiSamplingProvider` 参考
- `adapters/pi-renderer.ts` — `piRenderWrapper` 参考
- `adapters/qoder-sampling-provider.ts` — `QoderSamplingProvider` 参考

### Phase 6 报告与 LEARNINGS
- `.planning/phases/06-second-agent-adapter/06-LEARNINGS.md` §3.3 P-5/P-6/P-7 (Phase 7 adapter 集成的模式参考)
- `.planning/phases/06-second-agent-adapter/06-LEARNINGS.md` §4.4 S-4 (Capability Gate agent-agnostic 化的直接论据)
- `.planning/phases/06-second-agent-adapter/06-LEARNINGS.md` §4.2 S-2 (Section 5/5B baseline-bound 来源)
- `.planning/phases/06-second-agent-adapter/06-LEARNINGS.md` §4.3 S-3 (FIX-01 prebuild 必要性)
- `tests/reports/qoder-adapter-test-report.md` (Phase 6 既有报告,D-16 弃用并合并到主报告)

### 测试基础设施
- `__tests__/adapter-contract.test.ts` (Phase 1 既有,D-09 重写)
- `__tests__/qoder-adapter.test.ts` (Phase 6,8×N 矩阵的 per-agent 维度)
- `__tests__/qoder-adapter-integration.test.ts` (Phase 6 P-6,QODER_INTEGRATION=1 模式)
- `__tests__/mock-agent.ts` (D-08 弃用,移至 legacy)
- `__tests__/fixtures/` (D-08 新增 `mock-agent-api.ts`)
- `tests/compatibility/` (Section 4 兼容层)
- `tests/smoke/` (Section 6 E2E)
- `tests/token-benchmark/` (Section 5/5B)
- `tests/reports/` (matrix 报告输出目录)

### 当前 SKILL.md 与文档
- `skills/mcp-adapter-test/SKILL.md` §30-180 (Phase 1-4 现行流程,D-10/D-11 重构对象)
- `skills/mcp-adapter-test/references/mcp-config.md` (.mcp.json 配置)
- `skills/mcp-adapter-test/references/smoke-calls.md` (per-server smoke 调用样例)
- `docs/mcp-adapter-test-plan.md` (Phase 4 总体测试规划)
- `docs/mcp-adapter-token-savings.md` (Section 5/5B 目标定义)
- `examples/interactive-visualizer/scripts/build.mjs` (D-14 prebuild 目标脚本)
- `examples/interactive-visualizer/tsconfig.json` (D-14 prebuild 目标配置)

### Project Docs
- `.planning/ROADMAP.md` — Phase 7 目标 (TEST-01..05 + DOC-01..03)
- `.planning/REQUIREMENTS.md` — TEST-01..05 / DOC-01..03 需求定义
- `.planning/PROJECT.md` §"Current Milestone v2.0" — 价值定位(Universal + Pi 兼容)
- `MAPPING.md` — AgentAPI 接口映射文档(D-19 README 引用)
- `README.md` (D-18/D-19/D-20 全部重写对象)

### 上下游 phase 对齐
- `.planning/phases/08-upstream-merge-conflict-resolution/` (Phase 8 路径,D-21 兼容预留)
- `.planning/REQUIREMENTS.md` §"UPSTREAM" — UPSTREAM-01..04 (Phase 8 范围,D-21 直接对应 UPSTREAM-04)
- `.planning/ROADMAP.md` §"Phase 8" (Phase 8 目标背景)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`interfaces/agent-api.ts`** — 已 export `AgentAPI` / `AgentContext` / `UISystem`;`getAllTools` 已是契约方法之一(D-01 直接使用)
- **`adapters/entry.ts`** `createMcpAdapter()` — 接受 `AgentAPI` 与 `AgentContext` 的通用入口,Capability Gate 验证 (D-04/D-06) 可直接调用此函数 + 检查其注册的 `mcp` proxy tool
- **`adapters/qoder-adapter.ts`** — 现成第二适配器实现,D-04 describe.each 的现成入参;D-07 `AGENT_ADAPTERS` 数组的 `qoder` descriptor 直接取自此文件
- **`adapters/pi-adapter.ts`** — Pi 适配器实现,D-04 describe.each 的入参
- **`__tests__/qoder-adapter-integration.test.ts`** lines 110-130 — `QODER_INTEGRATION=1` env-gated 模式可直接迁移为 D-06 的 `AGENT_API_FULL_MATRIX=1`
- **`adapters/tool-registrar.ts`** — AgentAPI 无关的 proxy serializer,Section 5/5B baseline-bound 的事实来源(D-12/D-13 注释添加处)
- **`tests/reports/`** — 既有报告输出目录,D-16 改文件名为 `mcp-adapter-test-report.md` 不需新建目录

### Established Patterns
- **P-1 (Storage-bridging adapter)** — Phase 6 LEARNINGS §3.1;`QoderAdapter` 的 Maps + companion methods 模式,Phase 7 D-04 describe.each 复用此模式
- **P-5 (Agent-agnostic integration test wiring)** — Phase 6 LEARNINGS §3.2;`createMcpAdapter` + 适配器 fake 模式,Phase 7 D-04 per-adapter contract test 沿用
- **P-6 (QODER_INTEGRATION=1 env-gated full smoke)** — Phase 6 LEARNINGS §3.2;直接映射到 D-06 `AGENT_API_FULL_MATRIX=1`
- **P-7 (waitForConnection via externally-observable proxy-tool registration)** — Phase 6 LEARNINGS §3.2;Phase 7 D-01 Capability Gate 直接检测 `mcp` tool 在 `adapter.tools` 中的注册
- **Adapter Pattern** — Pi/Qoder 隔离在 `adapters/`,通用核心保持纯净;D-21 Phase 8 兼容预留直接受益

### Integration Points
- **`adapters/entry.ts:130-380`** — `createMcpAdapter` 调用 8 个 AgentAPI 方法,D-05 8 个契约方法清单的来源
- **`interfaces/agent-api.ts:130-180`** — `getAllTools` 方法签名已定义,D-01 Capability Gate 直接调用
- **`tests/smoke/e2e-all-servers.test.ts`** — Section 6 E2E 主测试,Phase 6 P-5/P-6 的实现已经为 D-06 分层打好基础
- **`vitest.config.ts`** — Phase 6 已配 per-source-file 80/60 coverage 阈值,D-14 `globalSetup` 钩子添加位置

</code_context>

<specifics>
## Specific Ideas

- 用户强调 D-18 "Pi-first-class" 措辞——README 中 Pi 不能处于"legacy / 兼容模式"的隐含定位;Pi 与 Qoder 视觉对称(并排矩阵),Pi 同时作为默认快速入门示例(Pi 路径代码先于 Qoder 路径)
- D-21 兼容预留动机:用户希望 Phase 7 推进过程中**主动考虑 Phase 8 的工作**——SKILL.md 拆分粒度直接对应 UPSTREAM-01 文件清单的可维护性
- D-12/D-13 baseline-bound 标注不只是在 SKILL.md 出现,也在验证报告的"Target Miss" 行出现,跨文档一致性
- D-08 完全替换 MockAgent 时,旧 44 case 的 8 个 AgentAPI 契约用例的逐字内容**保留**(只是来源 mock 改为 MockAgentAPI),保证 Phase 1 既有测试 100% 覆盖率不变
- D-14 build 步骤不在 `package.json` 的 `prepare` / `prepublish` 钩子中(避免影响 npm publish 流程),只在 `test` 与 `test:prebuild` 脚本中
- D-19 Quick Start 两套代码对比放在 README "Getting Started" 章节下,P-examples 紧跟 Q-examples,中间用 `---` 分隔

</specifics>

<deferred>
## Deferred Ideas

- **Claude / Cursor 等新 adapter 的实现** — 后续独立 phase;Phase 7 仅准备 AGENT_ADAPTERS 注册表的扩展点(D-07)
- **Section 5/5B 目标阈值调整** — 94% / 56% 是 baseline-bound(D-12),调整目标会降低产品质量门槛
- **i18n / 多语言 README** — Phase 7 不涉及,仅写英文 README
- **JSON Schema 自动生成报告 schema** — D-17 JSON 输出为手写 schema,自动生成工具链待评估
- **Web dashboard for matrix report** — JSON 旁路输出供未来 dashboard 使用,Phase 7 不实现
- **3rd-party AgentAPI 适配器自动 npm 包发布** — 后续独立工作

</deferred>

---

*Phase: 7-Integration Test Rebuild*
*Context gathered: 2026-06-17 via interactive discuss-phase (13 decisions captured, 8 areas explored)*
