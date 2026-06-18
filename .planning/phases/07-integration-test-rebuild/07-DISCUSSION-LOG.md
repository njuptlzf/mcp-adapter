# Phase 7: Integration Test Rebuild - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 7-integration-test-rebuild
**Areas discussed:** Capability Gate / Per-Adapter Framework / Mock Replacement / README Positioning / Section 4 Matrix / Pre-existing Failures / Section 5-5B Targets / SKILL.md Abstraction / Adapter Discovery / Report Format / Plan Count / Upstream Coordination / Build Integration

---

## Capability Gate (TEST-01, TEST-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter API 抽象检测 | `await adapter.getAllTools()` 跨所有 adapter 统一问询;Pi/Qoder/未来 adapter 只需实现 `getAllTools()` | ✓ |
| Manifest 声明 | 在 `package.json` / `.mcp-adapter.json` 声明运行时支持的 adapter,Gate 读 manifest | |
| API + Manifest 组合 | API 抽象为主,manifest 作为 fallback | |

**User's choice:** Adapter API 抽象检测
**Notes:** 与 Phase 6 LEARNINGS §4.4 S-4 一致——"mcp proxy tool registered" 是唯一的 Capability Gate 信号;通过 `getAllTools()` 实现单一 API 抽象跨所有 adapter。

## Per-Adapter 验证框架 (TEST-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Parametric | `__tests__/adapter-contract.test.ts` + `describe.each([['pi', () => ...], ['qoder', () => ...]])`,一个文件覆盖所有 adapter | ✓ |
| Per-adapter 文件 | Pi / Qoder 各建 `__tests__/<agent>-contract.test.ts`,文本重复 | |
| 共享套件 + 调用 | Base contract test 在 `__tests__/contracts/agent-api.contract.ts`,每个 adapter 调 `runAgentApiContractSuite(MyAdapter)` | |

**User's choice:** Parametric
**Notes:** Phase 6 LEARNINGS §2 L-7 经验(grep 不一致)使 per-adapter 文件方案风险高;共享套件方案对动态发现机制不友好;Parametric 简单且直接表达"for every agent"。

## Pi Mock 替换 (TEST-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 彻底替换 + legacy 保留 | `MockAgentAPI` 在 `__tests__/fixtures/mock-agent-api.ts`,旧 `mock-agent.ts` 移至 legacy 标记 deprecated | ✓ |
| 保留 Pi mock + per-adapter mock | 每个 adapter 拥有自己的 mock,逻辑重复 | |
| 部分抽象 | 只抽象 `getAllTools`,其他 `as any` 跳过 | |

**User's choice:** 彻底替换 + legacy 保留
**Notes:** 旧 44 case 的 8 个 AgentAPI 契约用例的逐字内容保留(只是 mock 来源改为 MockAgentAPI),保证 Phase 1 既有测试 100% 覆盖率不变。

## README 定位 (DOC-01, DOC-02, DOC-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Pi-first-class + matrix | Hero "Pi is a first-class supported adapter (not legacy)",矩阵列出 Pi+Qoder 视觉对称 | ✓ |
| Universal-first | Hero "Works with Pi and any AgentAPI-compliant agent",不主推 Qoder | |
| Agent 平等列表 | 列出所有支持 agent 平等对待 | |

**User's choice:** Pi-first-class + matrix
**Notes:** 用户强调 Pi 不能处于"legacy / 兼容模式"的隐含定位;Pi 与 Qoder 视觉对称(并排矩阵),Pi 同时作为默认快速入门示例(Pi 路径代码先于 Qoder 路径);"Universal" 措辞替换 "Agent-agnostic" 以避免暗示 Pi 不是 first-class。

## Section 4 矩阵运行

| Option | Description | Selected |
|--------|-------------|----------|
| 8×N + 40×1 分层 | 8 个 AgentAPI 契约用例 × N adapter;40 server 用例 MockAgentAPI 跑 1 遍;`AGENT_API_FULL_MATRIX=1` 开启 N×44 全量 | ✓ |
| 44×N 全量 | 所有 44 个用例 × N 个 adapter,CI 代价高 | |
| 仅 Pi 跑 44 | 全部只在 Pi 上跑一次,Qoder 由 Phase 6 P-6 integration test 覆盖 | |

**User's choice:** 8×N + 40×1 分层
**Notes:** 默认 CI 走轻量模式(Pi+Qoder 16+40=56 cases),`AGENT_API_FULL_MATRIX=1` 开启全量矩阵;新 adapter 加入自动展开 N 维度。

## Pre-existing Test 失败 (FIX-01 / S-3 经验)

| Option | Description | Selected |
|--------|-------------|----------|
| Add build step | `package.json` 加 `test:prebuild` 脚本 + `vitest.config.ts` globalSetup 自动 build | ✓ |
| Skip when dist/ absent | 测试开头加 `fs.existsSync` 跳过 | |
| Remove obsolete test | 删除 `__tests__/interactive-visualizer-server.test.ts` | |

**User's choice:** Add build step
**Notes:** 一次解决,避免 'pre-existing failures' 持续增加;build 步骤不放在 `prepare` / `prepublish` 钩子中(避免影响 npm publish 流程)。

## Section 5/5B 目标说明 (S-2 经验)

| Option | Description | Selected |
|--------|-------------|----------|
| 保留原目标 + 注明 baseline-bound | SKILL.md 在 Phase 2/3 加 "🟡 baseline-bound" 注释,验证报告 "Target Miss" 状态文案改为 "🟡 baseline-bound (fixture-determined, identical across adapters)" | ✓ |
| 降低目标阈值 | ≥95% → ≥90%,≥65% → ≥50% | |
| 补充 fixture 提高目标 | 重写 fixture,工作量大 | |

**User's choice:** 保留原目标 + 注明 baseline-bound
**Notes:** 94% / 56% 的实际值由 agent-agnostic proxy serializer (`adapters/tool-registrar.ts`) 与 demo-server fixture 决定,与 adapter 无关;所有 adapter 实测值相同,这是 fixture 边界,不是 regression。

## SKILL.md Agent-Agnostic 化 (TEST-05)

| Option | Description | Selected |
|--------|-------------|----------|
| 主文件 + per-agent references | 主 SKILL.md 变 short parametric,agent-specific 细节放 `references/agent-paths/<agent>.md` | ✓ |
| 单文件全 agent 文本 | 主 SKILL.md 重写为完整 agent-agnostic 文本(不引用子文件) | |
| 最小改动 | 不改 SKILL.md,仅在 references/ 下加 `agent-agnostic-flow.md` | |

**User's choice:** 主文件 + per-agent references
**Notes:** 与 Phase 8 UPSTREAM-04 兼容——主 SKILL.md 变 short,upstream merge 时冲突面缩窄;新加 adapter 时创建对应 `references/agent-paths/<agent>.md` 即可,主 SKILL.md 不修改。

## Adapter 发现机制 (跨 phase 可扩展性)

| Option | Description | Selected |
|--------|-------------|----------|
| 静态注册表 | `interfaces/agent-api.ts` 内 `AGENT_ADAPTERS: AgentAdapterDescriptor[]` 数组,新 adapter `push` descriptor 即可 | ✓ |
| 动态扫描 | Test runner 扫描 `adapters/*-adapter.ts` 动态加载 | |
| 显式 import | 测试代码中显式 import + 注册 | |

**User's choice:** 静态注册表
**Notes:** descriptor 同时包含 path resolver 信息,与 `createPiResolver` / `createQoderResolver` 模式一致;test runner / Capability Gate / README 矩阵 / 报告 matrix 自动发现。

## 报告格式 (跨多 agent 验证)

| Option | Description | Selected |
|--------|-------------|----------|
| Matrix report 统一 | 顶部表格 `agent × section` pass count,以下逐 section 详情(每 section 内按 agent 分子表);Phase 6 `qoder-adapter-test-report.md` 弃用并合并 | ✓ |
| 汇总 + per-adapter 独立文件 | 主报告汇总,详细逐 adapter 报告独立 | |
| JSON + Markdown 双格式 | Markdown 人读 + JSON 供 CI / dashboard | |

**User's choice:** Matrix report 统一
**Notes:** 同时增加 JSON 旁路输出 `tests/reports/mcp-adapter-test-report.json` 供 CI / dashboard 解析;JSON 由 vitest setup 钩子自动产出。

## Plan 数量 (用于 plan-phase 参考)

| Option | Description | Selected |
|--------|-------------|----------|
| 4 plans 按领域 | (1) MockAgentAPI 抽象 + adapter-contract parametric 框架; (2) Capability Gate 抽象化(per-agent references); (3) prebuild 修复 + Section 5/5B 标注; (4) README 重写 + 报告 matrix 化 | ✓ |
| 1 plan 集成 | 一个 plan 跨多个领域,验证压力大 | |
| 7+ plans 细粒度 | 每个领域独立 plan,回退粒度 | |

**User's choice:** 4 plans 按领域
**Notes:** 与 Phase 6 (5 plans) 类似,适合 TEST + DOC 双领域的 phase;可被 wave-based 并行。

## Phase 8 兼容性预留 (UPSTREAM-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 8/UPSTREAM-04 准备 | SKILL.md 拆分粒度直接对应 UPSTREAM-01 文件清单的可维护性;`adapters/` 目录结构稳定 | ✓ |
| Phase 7 独立,不预留 | Phase 7 独立做,待 Phase 8 执行时再调整 | |

**User's choice:** Phase 8/UPSTREAM-04 准备
**Notes:** 用户希望 Phase 7 推进过程中**主动考虑 Phase 8 的工作**——SKILL.md 拆分粒度直接对应 UPSTREAM-01 文件清单的可维护性。

## Build 步骤集成 (FIX-01)

| Option | Description | Selected |
|--------|-------------|----------|
| package.json + vitest globalSetup | `package.json` 加 `test:prebuild` 与 `test` 脚本;`vitest.config.ts` globalSetup 监听 dist/ 缺失时自动 build | ✓ |
| 仅 vitest globalSetup | `vitest.config.ts` globalSetup 直接调用 build 脚本,不修改 package.json | |
| 仅文档提示 | 不在 CI 集成,仅修改文档提醒 | |

**User's choice:** package.json + vitest globalSetup
**Notes:** build 步骤不放在 `prepare` / `prepublish` 钩子中(避免影响 npm publish 流程);globalSetup 监听 dist/ 自动 build 避免开发者忘记。

---

## the agent's Discretion

- `AGENT_ADAPTERS` 注册表的 TypeScript 类型细节(`AgentAdapterDescriptor` 字段、envHints 形式)由实现者定夺
- `globalSetup` 的 build 触发逻辑具体形态(监听文件 vs 一次性 build)由实现者权衡
- 报告 JSON schema 字段集由实现者按需扩展

## Deferred Ideas

- Claude / Cursor 等新 adapter 的实现 — 后续独立 phase
- Section 5/5B 目标阈值调整 — 94% / 56% 是 baseline-bound,调整目标会降低产品质量门槛
- i18n / 多语言 README — Phase 7 不涉及,仅写英文 README
- JSON Schema 自动生成报告 schema — 自动生成工具链待评估
- Web dashboard for matrix report — JSON 旁路输出供未来 dashboard 使用,Phase 7 不实现
- 3rd-party AgentAPI 适配器自动 npm 包发布 — 后续独立工作
