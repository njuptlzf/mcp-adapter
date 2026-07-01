# Phase 11: Skill Unification & Post-Phase-10 Fixes — CONTEXT

**Created:** 2026-06-26
**Source:** /gstack-openclaw-investigate 深度调查
**Predecessor:** Phase 10 (StoreAdapter Base Class & Agent Self-Reporting Paths)

---

## Problem Statement

Phase 10 解决了代码层的 StoreAdapter 基类抽取和 PATH-01/PATH-02（AgentContext.mcpConfigPath 自报告路径），但遗留了三个层面的问题：

1. **Critical Bug**: `bin/kilo-mcp-server.ts` 调用 `loadMcpConfig()` 时未传递 Kilo resolver，静默回退到 `DEFAULT_AGENT_RESOLVER = createPiResolver()`，导致 `~/.kilo/mcp.json` 被忽略。

2. **Phase 10 遗漏**: 三个核心 skill 的 SKILL.md 从未同步 PATH-01/PATH-02 设计，仍然硬编码引用 `skills/mcp-adapter-test/references/agent-paths/<id>.md`，而非从 `AGENT_ADAPTERS[i].resolverFactory()` 动态获取。

3. **Capability-gate 缺失**: 三个 skill 对接 agent 时不检查 `capabilities`，用户无法预知该 agent 能提供什么/不能提供什么。

4. **Skill 割裂**: `deploy-mcp-adapter` / `generate-mcp-config` / `mcp-adapter-test` 互相引用对方路径，存在隐性循环依赖，用户无法判断"对接一个 agent 该调用哪个 skill"。

---

## Investigation Findings (Evidence)

### F1: kilo-mcp-server resolver bug

`bin/kilo-mcp-server.ts:115`:
```typescript
const config = loadMcpConfig(args.configPath);
// → internal: getConfigSources(..., DEFAULT_AGENT_RESOLVER = createPiResolver(), ...)
// → userPath = ~/.pi/agent/mcp.json  ❌ WRONG for Kilo
// → ~/.kilo/mcp.json is NEVER consulted
```

**现场验证**:
```
Pi-global consulted:   /root/.pi/agent/mcp.json    ❌ MISSING
Kilo-global IGNORED:   /root/.kilo/mcp.json         ✅ EXISTS (5 servers)
Shared-global:          /root/.config/mcp/mcp.json   ✅ EXISTS
```

**严重性**: 用户若将 MCP server 只配置在 `~/.kilo/mcp.json` 中，mcp-adapter 无法代理它们。当前因 `~/.config/mcp/mcp.json` 和 `.mcp.json` 的兜底作用，功能未完全失效，但语义错误明确。

**修复方向**: 传递 `createKiloResolver().globalConfigPath()` 作为 `loadMcpConfig` 的第三参数。

### F2: Three skills cross-reference analysis

| 引用方向 | deploy-mcp-adapter | generate-mcp-config | mcp-adapter-test |
|----------|-------------------|---------------------|-----------------|
| 引用 agent-paths | Phase 0.2, 1.1, 2, 3, 4.2 | Step 1/2 | Phase 4 Step 1 |
| 引用其他 skill | "run generate-mcp-config first" (Phase 1.1) | — | Step 5d (deploy-verify) |
| 用户触发词 | 部署/安装/接入 | 生成配置/创建mcp.json | 测试/验证 |
| 自然工作流顺序 | ② (需先有 config) | ① (先生成 config) | ③ (部署后验证) |

**用户困惑根源**: 三个 skill 的 description 没有注明调用顺序，触发词互相重叠。一个"我想对接 agent X"的意图无法映射到单一 skill。

### F3: Capability-gate gap

`AGENT_ADAPTERS` 中每个 descriptor 有 `capabilities: { ui, sampling, renderer }`，但三个 skill 在对接阶段均未消费这些字段：
- `deploy-mcp-adapter` Phase 0 列出 agent 但不展示 capability 差异
- `generate-mcp-config` Step 1 假设所有 agent 支持相同功能
- `mcp-adapter-test` 有 Capability Gate 但仅用于测试分类，不用于准入判断

### F4: Qoder vs Kilo implementation divergence (not a bug, architectural constraint)

| 维度 | Qoder | Kilo |
|------|-------|------|
| 集成方式 | In-process SDK bridge | Out-of-process MCP stdio server |
| 入口 bin | `qoder-mcp-bridge` | `kilo-mcp-server` |
| session 注入 | SessionStart hook | Kilo 内置 MCP client 自动发现 |
| 双向通道 | `AgentChannel → Query.streamInput` | `AgentChannel → stderr` (单向) |
| capabilities | `{ui:false, sampling:true, renderer:false}` | `{ui:false, sampling:false, renderer:false}` |

**根因**: Qoder 公开了 `@qoder-ai/qoder-agent-sdk`（in-process 绑定），Kilo 不公开 TypeScript SDK（只能走 MCP stdio）。这是 SDK 可达性决定的架构约束，不是代码 bug。但 README 和 skills 未向用户解释这个差异。

---

## Design Decisions (to be locked)

### DEC-01: Skill 整合策略 — 单一统一入口

**Decision**: 将三个 skill 合并为一个 `mcp-adapter` skill，内部分 Phase 组织。

**Rationale**:
- 三个 skill 的职责是自然工作流的三个阶段：Generate → Deploy → Verify
- 合并后消除循环依赖：不再有 "deploy 说先去用 generate" 的引用
- 单一入口降低用户认知负担：`/mcp-adapter` 即可完成全部对接
- 与 `AGENT_ADAPTERS` 注册表驱动的设计理念一致

**Structure**:
```
skills/mcp-adapter/
├── SKILL.md                    # 统一入口 + Phase 1-3 工作流
├── references/
│   ├── generate.md             # Phase 1: 配置生成（原 generate-mcp-config 内容）
│   ├── deploy.md               # Phase 2: 部署（原 deploy-mcp-adapter 内容）
│   ├── verify.md               # Phase 3: 验证（原 mcp-adapter-test 内容）
│   ├── resolver.md             # 统一路径解析（取代 agent-paths/<id>.md）
│   └── deploy-examples.md      # 部署代码模板（保留）
```

**Migration**: 原三个 skill 目录标记为 deprecated，保留 2 个版本周期后删除。

### DEC-02: Resolver 动态化 — 消除 agent-paths 硬编码

**Decision**: 所有路径引用从静态 `agent-paths/<id>.md` 迁移到 `AGENT_ADAPTERS[i].resolverFactory()` 动态获取。

**Affected locations**:
- `deploy-mcp-adapter` → `mcp-adapter` Phase 1.1: 改为调用 `resolverFactory().globalConfigPath()`
- `generate-mcp-config` → `mcp-adapter` Phase 2: 改为从 registry 动态生成路径表
- `mcp-adapter-test` → `mcp-adapter` Phase 3 Step 0: Capability Gate 改为读取 `AGENT_ADAPTERS[i].capabilities`

**Path resolver contract** (unchanged from Phase 10 PATH-01):
```
AGENT_ADAPTERS[i].resolverFactory() → { agentId, globalConfigPath(), projectConfigName?() }
AGENT_ADAPTERS[i].capabilities → { ui?, sampling?, renderer? }
```

### DEC-03: Capability-gate 准入检查

**Decision**: 在 skill 对接 agent 时消费 `capabilities` 字段，透明展示而非静默降级。

**Behavior**:
```typescript
// 每个 Phase 入口处:
const caps = descriptor.capabilities ?? {};
if (!caps.ui && !caps.sampling && !caps.renderer) {
  // 该 agent 仅支持基础 mcp proxy → 提示用户
}
// 否则: 展示可用功能列表 + 不可用功能警告
```

**不终止**（所有 `AGENT_ADAPTERS` 中的 agent 都支持 MCP proxy），但**必须展示**。

### DEC-04: 修复 kilo-mcp-server resolver

**Decision**: `bin/kilo-mcp-server.ts` 显式传递 `createKiloResolver().globalConfigPath()`。

**代码变更**（1 行）:
```typescript
// Before:
const config = loadMcpConfig(args.configPath);
// After:
import { createKiloResolver } from "../interfaces/agent-paths.ts";
const kiloResolver = createKiloResolver();
const config = loadMcpConfig(args.configPath, process.cwd(), kiloResolver.globalConfigPath());
```

或利用 PATH-01（更优雅）:
```typescript
const ctx: AgentContext = adaptKiloContext({ 
  cwd: process.cwd(), hasUI: false,
  mcpConfigPath: kiloResolver.globalConfigPath()  // PATH-01 self-reporting
});
```

### DEC-05: upstream-merge 兼容

**Decision**: 新 skill 目录 `skills/mcp-adapter/` 标记为 `fork-only/ours`。原三个 skill 目录保留（标记 deprecated）以维持 upstream-divergence 稳定性。

---

## Affected Files

| File | Change | Impact |
|------|--------|--------|
| `bin/kilo-mcp-server.ts` | 修复 resolver 传递 | 🔴 Critical bug fix |
| `skills/mcp-adapter/SKILL.md` | **NEW** 统一入口 | 核心交付物 |
| `skills/mcp-adapter/references/*.md` | **NEW** 5 个 reference 文件 | 核心交付物 |
| `skills/deploy-mcp-adapter/SKILL.md` | 顶部添加 deprecated 声明 | 向后兼容 |
| `skills/generate-mcp-config/SKILL.md` | 顶部添加 deprecated 声明 | 向后兼容 |
| `skills/mcp-adapter-test/SKILL.md` | 顶部添加 deprecated 声明 | 向后兼容 |
| `interfaces/agent-api.ts` | 无需修改 | registry 已完备 |
| `skills/upstream-merge/references/special-cases.md` | +4 entries | fork-only tracking |
| `README.md` | 更新 Agent 支持矩阵解释 Qoder/Kilo 差异 | 文档改进 |

**Net**: ~6 files created, ~7 files modified.

---

## Verification Strategy

1. `npx tsc --noEmit` — 零类型错误
2. `npm test` — 590+ 测试全通过
3. `npm run verify:deploy -- --agent kilo` — Kilo resolver 修复后验证通过
4. `npm run upstream:check` — exit 0，新 entries 已注册
5. Parametric contract tests: 22/22 (kilo/pi/qoder)
6. Manual: 在 Kilo session 中确认 `mcp({})` 能列出 `~/.kilo/mcp.json` 中的 server

---

## References

- `.planning/phases/10-store-adapter-refactor/CONTEXT.md` — Phase 10 设计决策
- `skills/deploy-mcp-adapter/SKILL.md` (360 lines)
- `skills/generate-mcp-config/SKILL.md` (299 lines)
- `skills/mcp-adapter-test/SKILL.md` (412 lines)
- `interfaces/agent-api.ts` — AGENT_ADAPTERS 注册表
- `interfaces/agent-paths.ts` — AgentPathResolver + createKiloResolver
- `bin/kilo-mcp-server.ts` — 受影响文件
- `config.ts:190-230` — loadMcpConfig / getConfigSources
