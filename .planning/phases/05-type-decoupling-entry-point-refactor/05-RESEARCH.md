# Phase 5: Type Decoupling & Entry Point Refactor - Research

**Researched:** 2026-06-15
**Domain:** TypeScript universal adapter decoupling, adapter pattern, backward-compatible entry point refactor
**Confidence:** HIGH

## Summary

Phase 5 的核心目标是在不破坏 Pi 用户现有行为的前提下，把 6 个源码文件中残留的 Pi 专用类型依赖全部解耦，并引入一个 agent-agnostic 的入口函数 `createMcpAdapter`。研究结果表明，当前代码已经具备良好的分层基础：Phase 1–3 已经把 `AgentAPI` / `AgentContext` / `UISystem` 接口抽象出来，并实现了 `PiAdapter` 与 `adaptPiContext` 作为 Pi 侧的转换边界 [VERIFIED: codebase analysis]。因此，Phase 5 的主要工作是把 `proxy-modes.ts`、`direct-tools.ts`、`tool-result-renderer.ts`、`sampling-handler.ts`、`elicitation-handler.ts`、`index.ts` 中直接引用 `@earendil-works/pi-coding-agent` / `@earendil-works/pi-ai` / `@earendil-works/pi-tui` 的类型替换为通用类型或局部类型，并把 `index.ts` 改为围绕 `adapters/entry.ts` 的薄 wrapper。

关键发现：当前仓库在没有安装 `@earendil-works/pi-coding-agent` 时无法通过 TypeScript 编译 [VERIFIED: `npx tsc --noEmit`]。这意味着非 Pi 环境（如 CI、下游 fork、其他 agent 集成）根本无法消费这些源码。Phase 5 完成后，`tsc --noEmit` 应当不再依赖 `pi-coding-agent` 的类型包，仅 `adapters/pi-adapter.ts` 保留对 Pi 包的可选类型引用（该文件天然只在 Pi 侧使用）。

**Primary recommendation:** 采用“边界适配器 + 核心局部类型”策略：核心文件只依赖 `interfaces/agent-api.ts` 与本地 `McpToolResult` / `SamplingProvider` / `RenderOutput` 抽象；Pi 特有实现全部收敛到 `adapters/pi-adapter.ts`、`adapters/pi-sampling-provider.ts`、`adapters/pi-renderer.ts` 等边界文件；`index.ts` 仅负责 Pi 早期配置加载与 wrapper 委托。

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The new universal entry point lives in `adapters/entry.ts`.
- **D-02:** The exported function is named `createMcpAdapter`.
- **D-03:** Signature: `createMcpAdapter(agentapi: AgentAPI, ctx: AgentContext, config: McpConfig, cache: MetadataCache): void`.
- **D-04:** `createMcpAdapter` returns `void`. Lifecycle cleanup remains tied to session events / graceful shutdown, matching the current `index.ts` behavior.
- **D-05:** Configuration and metadata cache are loaded by the caller and passed in; `createMcpAdapter` does not perform its own I/O to load config or cache.
- **D-06:** `index.ts` becomes a thin Pi-specific wrapper: construct `PiAdapter`, convert `ExtensionContext` to `AgentContext` via `adaptPiContext`, then delegate to `createMcpAdapter`.
- **D-07:** Existing exports `mcpAdapter` (default) and `piMcpAdapter` (alias) remain behaviorally identical for Pi users; no breaking changes to Pi consumers.

### the agent's Discretion
- Exact internal file organization and helper placement within `adapters/entry.ts` (e.g., whether to split state management into a separate local module) is left to the planner/executor, provided the public API matches D-02/D-03.
- Specific type-replacement strategies for Pi-coupled types (`AgentToolResult`, `AgentToolUpdateCallback`, `ExtensionContext`, `ExtensionUIContext`, `ToolInfo`, `Model`, `complete`, `AssistantMessage`, pi-tui `Text`) should follow `DECOUPLE-01` through `DECOUPLE-07` and maintain backward compatibility. Where multiple equivalent approaches exist, the agent may choose the one that minimizes source-file edits and upstream-merge conflict surface, consistent with `UPSTREAM-03`/`UPSTREAM-04`.
- Whether to extend `UISystem` with an optional `confirm` method or to map elicitation confirmation onto `notify`/`form` in the Pi adapter is left to the implementation agent, as long as the generic interface does not become Pi-specific.

### Deferred Ideas (OUT OF SCOPE)
- Phase 6 will implement a non-Pi adapter (e.g., `QoderAdapter`) that consumes `createMcpAdapter`; the exact second agent is not decided here.
- Phase 7 will rebuild `skills/mcp-adapter-test` to verify `createMcpAdapter` across multiple adapters.
- Phase 8 will maintain the upstream-merge manifest and skill; Phase 5 implementation should prefer adapter/wrapper patterns to minimize source edits, per `UPSTREAM-04`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECOUPLE-01 | Replace `AgentToolResult` imports in proxy-modes.ts, direct-tools.ts, tool-result-renderer.ts with generic types from interfaces/agent-api.ts | 定义本地 `McpToolResult<T>` 类型，形状与 Pi `AgentToolResult` 相同但不再引用 Pi 包；`ToolInfo` 已存在于 `interfaces/agent-api.ts` [VERIFIED: codebase analysis] |
| DECOUPLE-02 | Replace `ExtensionUIContext` imports in sampling-handler.ts, elicitation-handler.ts with generic `UISystem` from interfaces/agent-api.ts | `UISystem` 已定义 `notify`/`setStatus`/`form`/`custom`/`theme`；采样确认可通过可选 `confirm` 或映射到 `form` 实现 [VERIFIED: codebase analysis] |
| DECOUPLE-03 | Replace `ExtensionContext` import in direct-tools.ts with generic `AgentContext` | `createDirectToolExecutor` 的 `ctx` 参数在实现中未被使用，可直接替换为 `AgentContext` 或 `unknown` [VERIFIED: codebase analysis] |
| DECOUPLE-04 | Replace `ToolInfo` import in proxy-modes.ts and index.ts with generic `ToolInfo` from interfaces/agent-api.ts | `interfaces/agent-api.ts` 已定义 `{ name: string; [key: string]: unknown }` 的 `ToolInfo` [VERIFIED: codebase analysis] |
| DECOUPLE-05 | Replace `Model`, `complete`, `AssistantMessage` etc. in sampling-handler.ts with agent-agnostic abstractions (or extract to Pi-specific sampling wrapper) | 推荐新增 `interfaces/sampling.ts` 定义 `SamplingProvider`，Pi 实现在 `adapters/pi-sampling-provider.ts`；`AgentContext.model` / `modelRegistry` 保持 `unknown` [VERIFIED: codebase analysis + WebSearch] |
| DECOUPLE-06 | Replace `@earendil-works/pi-tui` Text import in tool-result-renderer.ts with generic rendering interface | 推荐定义 `RenderOutput = { text: string }` 或 `string`，Pi 侧在 `adapters/pi-renderer.ts` 转回 `Text`；`RenderTheme` 已通用 [VERIFIED: codebase analysis] |
| DECOUPLE-07 | Replace `PI_CODING_AGENT_DIR` in agent-dir.ts with `AgentPathResolver` usage | `AgentPathResolver` 已在 `interfaces/agent-paths.ts` 定义；`agent-dir.ts` 当前是 Pi 默认解析器的实现，可保留为默认 Pi 行为并添加通用 env 名 `MCP_AGENT_DIR`，同时回退 `PI_CODING_AGENT_DIR` [VERIFIED: codebase analysis] |
| ENTRY-01 | Create agent-agnostic entry point accepting `AgentAPI` instead of `ExtensionAPI` | `adapters/entry.ts` 实现 `createMcpAdapter`，完成注册、事件绑定、生命周期委托 [VERIFIED: codebase analysis] |
| ENTRY-02 | Refactor existing `mcpAdapter(pi: ExtensionAPI)` in index.ts as Pi-specific wrapper around new entry point | `index.ts` 负责 argv 解析、`PiAdapter` 构造、`adaptPiContext`、调用 `createMcpAdapter` [VERIFIED: codebase analysis] |
| ENTRY-03 | Maintain 100% backward compatibility — Pi users see zero behavior change | 保留默认导出与别名；核心逻辑不变，仅迁移类型与入口 [VERIFIED: codebase analysis] |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool registration & lifecycle | Core entry (`adapters/entry.ts`) | Pi wrapper (`index.ts`) | `createMcpAdapter` 接收通用 `AgentAPI` 完成所有注册；Pi 侧只做转换 |
| Pi API adaptation | `adapters/pi-adapter.ts` | — | 这是 Pi 类型进入核心前的唯一边界 |
| Pi AI sampling | `adapters/pi-sampling-provider.ts` | `sampling-handler.ts` (orchestrator) | Pi 特有的 `complete` / `ModelRegistry` 只能由 Pi 实现提供 |
| Pi TUI rendering | `adapters/pi-renderer.ts` | `tool-result-renderer.ts` | `Text` 类只在 Pi 渲染层使用 |
| Elicitation UI | `elicitation-handler.ts` (generic) | `adapters/pi-adapter.ts` (form/notify bridge) | 通用 handler 使用 `UISystem.form` / `UISystem.notify` |
| Path resolution | `interfaces/agent-paths.ts` + resolver | `agent-dir.ts` (Pi default) | 各 agent 提供自己的 `AgentPathResolver`，Pi 默认保留 |
| Backward-compat public API | `index.ts` | package.json exports | 默认导出 `mcpAdapter` 与别名 `piMcpAdapter` 不变 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type checking | 项目已锁定 devDependency [VERIFIED: `npx tsc --version`] |
| Vitest | 3.2.6 | Unit / integration tests | 项目已使用 [VERIFIED: `npx vitest --version`] |
| `@modelcontextprotocol/sdk` | ^1.25.1 | MCP protocol types | 采样/请求类型已经通用 [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@earendil-works/pi-coding-agent` | ^0.74.0 (optional peer) | Pi 运行时类型 | 仅 `adapters/pi-adapter.ts` 与 `index.ts` 引用 [VERIFIED: package.json] |
| `@earendil-works/pi-ai` | ^0.74.0 (optional) | Pi LLM completion | 仅 Pi sampling provider 实现 [VERIFIED: package.json] |
| `@earendil-works/pi-tui` | ^0.74.0 (optional) | Pi TUI Text | 仅 Pi renderer 包装器 [VERIFIED: package.json] |

**Installation:** 本阶段不引入新 npm 包；仅重组现有类型依赖。

**Version verification:**
```bash
npm view typescript version   # 5.9.3 at research time
npm view vitest version       # 3.2.6 at research time
```

## Package Legitimacy Audit

> 本阶段不安装新的外部包；所有依赖均为项目已有。无需新增包合法性审查。

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Pi Extension Host                            │
│  ┌──────────────┐   ┌─────────────────┐   ┌─────────────────────┐  │
│  │ Pi Extension │──▶│   index.ts      │──▶│   PiAdapter         │  │
│  │   (pi: ExtAPI)│   │ (thin wrapper)  │   │ adaptPiContext      │  │
│  └──────────────┘   └─────────────────┘   └──────────┬────────────┘  │
└──────────────────────────────────────────────────────┼───────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         adapters/entry.ts                            │
│              createMcpAdapter(agentapi, ctx, config, cache)          │
│   • register direct tools    • register proxy tool                   │
│   • register commands/flag   • wire session_start / session_shutdown │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌─────────────────┐   ┌─────────────────┐
│  proxy-modes  │    │  sampling-handler│   │elicitation-handler│
│  direct-tools │    │ (uses SamplingProvider)│  (uses UISystem)  │
│tool-result-   │    └─────────────────┘   └─────────────────┘
│   renderer    │
└───────────────┘
        │
        ▼
┌────────────────────────────────────────────┐
│  Pi-specific bridges (adapters/pi-*)       │
│  • pi-sampling-provider.ts → complete()    │
│  • pi-renderer.ts → new Text(...)          │
└────────────────────────────────────────────┘
```

### Recommended Project Structure

```
.
├── adapters/
│   ├── entry.ts                 # createMcpAdapter (agent-agnostic)
│   ├── pi-adapter.ts            # PiAdapter + adaptPiContext (existing)
│   ├── pi-sampling-provider.ts  # Pi completion provider
│   └── pi-renderer.ts           # Pi Text wrapper
├── interfaces/
│   ├── agent-api.ts             # AgentAPI / AgentContext / UISystem / ToolInfo
│   ├── agent-paths.ts           # AgentPathResolver (existing)
│   └── sampling.ts              # NEW: SamplingProvider / SamplingModel abstractions
├── proxy-modes.ts               # 改用本地 McpToolResult / ToolInfo
├── direct-tools.ts              # 改用 AgentContext / 本地 McpToolResult
├── tool-result-renderer.ts      # 改用 RenderOutput / 本地 McpToolResult
├── sampling-handler.ts          # 改用 SamplingProvider / UISystem
├── elicitation-handler.ts       # 改用 UISystem / FormConfig
├── agent-dir.ts                 # 保留 Pi 默认 resolver，支持通用 env
└── index.ts                     # Pi 专用 wrapper
```

### Pattern 1: Local Generic Result Type
**What:** 在核心文件定义与 Pi `AgentToolResult` 结构等价但不引用 Pi 包的 `McpToolResult<T>`。
**When to use:** 当 Pi 类型仅用于结构标注，且核心逻辑只读取/构造这些结构时。
**Example:**
```typescript
// Source: local abstraction derived from proxy-modes.ts / direct-tools.ts usage
export interface McpToolResult<T = Record<string, unknown>> {
  content: Array<{ type: "text"; text: string } | { type: "image"; mimeType: string }>;
  details?: T;
}
```

### Pattern 2: Boundary Provider Interface
**What:** 把 Pi AI 采样能力抽象成 `SamplingProvider`，Pi 侧实现注入。
**When to use:** 当某能力深度依赖 Pi 生态、但核心流程只需要“调用 + 返回结果”时。
**Example:**
```typescript
// Source: interfaces/sampling.ts (recommended)
export interface SamplingProvider {
  resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined>;
  complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse>;
}
```

### Pattern 3: Adapter Renderer Bridge
**What:** 核心 renderer 输出通用 `RenderOutput`，Pi 侧再转成 `Text`。
**When to use:** 当返回值类型是 Pi TUI 特有、其他 agent 无法/不需要构造时。
**Example:**
```typescript
// Source: adapters/pi-renderer.ts (recommended)
export function wrapPiRenderer<T extends (...args: unknown[]) => string>(fn: T) {
  return (...args: Parameters<T>) => new Text(fn(...args), 0, 0);
}
```

### Anti-Patterns to Avoid
- **在通用接口上添加 Pi 特有可选字段：** 不要把 `ExtensionUIContext` 的成员直接搬到 `UISystem`，而应通过 Pi adapter 在运行时桥接 [CITED: CONTEXT.md D-07 discretion]。
- **在核心文件中保留 Pi import：** `proxy-modes.ts`、`direct-tools.ts`、`tool-result-renderer.ts`、`sampling-handler.ts`、`elicitation-handler.ts` 完成后不应再 import `@earendil-works/pi-coding-agent` / `pi-ai` / `pi-tui`。
- **让 `createMcpAdapter` 加载配置/缓存：** 违反 D-05；应由 Pi wrapper 或其他 adapter 传入。
- **直接修改 Pi 默认导出签名：** `mcpAdapter(pi: ExtensionAPI)` 必须保留，内部委托即可 [VERIFIED: codebase analysis]。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pi `AgentToolResult` shape replication | 不要自己发明不兼容的结构 | 本地 `McpToolResult<T>`，结构与 Pi 兼容 | Pi 已定义 `{ content, details }`；自定义结构会导致 Pi renderer 不兼容 |
| Pi LLM completion protocol | 不要写通用 LLM client | 仅抽象 `SamplingProvider` 接口，Pi 侧注入 `complete` | 认证、模型选择、停止原因、usage 等差异很大，不值得在核心中重新实现 |
| Pi TUI `Text` rendering | 不要让每个 agent 都实现 Text | 核心返回 string / RenderOutput，Pi 侧包成 Text | `Text` 是 Pi 渲染原语，其他 agent 没有等价物 |
| Form schema conversion | 不要为每个 agent 复制 convertMcpSchemaTo*Form | 核心使用 `FormConfig` / `FormResult`，Pi adapter 做字段映射 | `elicitation-handler.ts` 里的 schema→field 逻辑是协议转换，与 UI 框架无关 |

**Key insight:** 本阶段的“通用化”不是把所有 Pi 功能都重新实现一遍，而是把 Pi 实现推到边界，核心只保留最小契约。

## Runtime State Inventory

> 本阶段属于重构/解耦，不涉及字符串重命名，但需确认运行时会否因入口点改变而残留旧状态。

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 无：Pi 类型仅在编译期使用；MCP cache / OAuth token 路径由 `AgentPathResolver` / `agent-dir.ts` 决定，不会因为类型解耦而变更 key | 无需数据迁移 |
| Live service config | 无：`mcpAdapter` 作为 Pi extension 的入口由 Pi extension host 在加载期调用；Phase 5 不改变其签名，host 无需重新注册 | 无需变更 |
| OS-registered state | 无：没有 systemd/launchd/Task Scheduler 注册项依赖 Pi 类型或入口函数名 | 无需变更 |
| Secrets/env vars | `PI_CODING_AGENT_DIR` 环境变量决定 Pi 默认路径。DECOUPLE-07 可引入 `MCP_AGENT_DIR` 作为通用名，同时保留 `PI_CODING_AGENT_DIR` 作为 backward-compat fallback | 代码读取逻辑变更；不需要用户重新设置 |
| Build artifacts / installed packages | `node_modules` 中 `@earendil-works/pi-coding-agent` 未安装（导致当前 tsc 失败），但 `pi-ai` / `pi-tui` 已安装 [VERIFIED: `ls node_modules/@earendil-works`]。解耦后核心文件不再依赖 `pi-coding-agent` 类型 | 无需重装；Pi 包仍为 optional peer/optionalDependencies |

**Nothing found in category:** 已逐项确认。

## Common Pitfalls

### Pitfall 1: `AgentToolResult` 的 `content` 类型过宽导致 Pi renderer 不兼容
**What goes wrong:** 如果把 `content` 从 `Array<{ type: "text"; text: string } | { type: "image"; mimeType: string }>` 改成 `unknown[]`，Pi 的 `renderMcpToolResult` 以及既有测试会失败。
**Why it happens:** Pi 对 content block 有明确结构预期； loosening types 会破坏运行时行为。
**How to avoid:** 本地 `McpToolResult` 的 `content` 形状与现有 `McpContent` 保持一致 [VERIFIED: types.ts]。
**Warning signs:** `tool-result-renderer.test.ts` 中 `blockToLines` 与 `formatMcpToolResultLines` 的断言开始失败。

### Pitfall 2: `createMcpAdapter` 悄悄改变了生命周期回调的注册时机
**What goes wrong:** 原 `index.ts` 在模块加载时就注册了 `session_start` / `session_shutdown` 事件与命令/flag。如果 `createMcpAdapter` 改成异步或延迟注册，Pi 的会话事件可能错过。
**Why it happens:** Pi extension host 可能在调用 `mcpAdapter(pi)` 后立即触发事件。
**How to avoid:** `createMcpAdapter` 保持同步返回 `void`，在函数体内立即调用 `agentapi.on()`、`agentapi.registerCommand()`、`agentapi.registerFlag()`、`agentapi.registerTool()` [VERIFIED: index.ts 当前行为]。
**Warning signs:** `index-lifecycle.test.ts` 中事件处理器数量或注册顺序断言失败。

### Pitfall 3: Sampling provider 抽象导致 Pi 模型选择行为改变
**What goes wrong:** 抽象后的 `resolveModel` 如果不完全复刻 `resolveSamplingModel` 的候选顺序（hints → current → available），Pi 采样会选错模型。
**Why it happens:** 候选优先级、去重逻辑、`getApiKeyAndHeaders` 错误回退都藏在当前 `sampling-handler.ts` 中。
**How to avoid:** Pi sampling provider 的初始实现应直接搬移现有逻辑，并在测试中保留现有模型选择用例 [VERIFIED: sampling-handler.test.ts]。
**Warning signs:** `sampling-handler.test.ts` 中模型选择相关断言失败。

### Pitfall 4: `UISystem` 缺少 `confirm` 导致非 Pi agent 无法支持采样
**What goes wrong:** 如果采样 handler 仍要求 `ui.confirm()`，而通用 `UISystem` 没有该方法，非 Pi agent 即使提供 `form` 也无法通过。
**Why it happens:** `confirm` 是 Pi UI 的扩展能力。
**How to avoid:** 推荐把 `confirm` 实现为 `form({ fields: [], submitLabel, secondaryLabel, cancelLabel })` 的通用回退；同时在 `UISystem` 上加可选 `confirm?` 方法供 Pi 直接使用 [CITED: CONTEXT.md discretion]。
**Warning signs:** 非 Pi mock adapter 调用采样 handler 时抛出 `confirm is not a function`。

### Pitfall 5: 上游合并时 source 文件改动过大
**What goes wrong:** 如果在 `proxy-modes.ts`、`direct-tools.ts` 等文件中大量重写业务逻辑，后续 merge upstream bugfix 会产生冲突。
**Why it happens:** Phase 8 目标是最小化 source 改动 [CITED: REQUIREMENTS.md UPSTREAM-04]。
**How to avoid:** 只做 import / type 签名级别的改动，把 Pi 特有逻辑抽到 `adapters/` 新文件；业务逻辑尽量原封不动 [CITED: CONTEXT.md code_context]。
**Warning signs:** `UPSTREAM-CHANGES.md` 中 source 文件条目过多或包含大量 rationale。

## Code Examples

### Local `McpToolResult` replacement
```typescript
// Source: derived from proxy-modes.ts usage
export interface McpToolResult<T = Record<string, unknown>> {
  content: Array<McpTextContent | McpImageContent>;
  details?: T;
}

export interface McpTextContent { type: "text"; text: string; }
export interface McpImageContent { type: "image"; mimeType: string; }
```

### Generic sampling provider interface
```typescript
// Source: recommended interfaces/sampling.ts
import type { CreateMessageRequest, CreateMessageResult, ModelPreferences } from "@modelcontextprotocol/sdk/types.js";

export interface SamplingModel {
  provider: string;
  id: string;
  name?: string;
}

export interface SamplingRequest {
  systemPrompt?: string;
  messages: SamplingMessage[];
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface SamplingMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
}

export interface SamplingResponse {
  text: string;
  model: string;
  stopReason: string;
}

export interface SamplingProvider {
  resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined>;
  complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse>;
  confirm?(title: string, message: string): Promise<boolean>;
}
```

### Pi renderer bridge
```typescript
// Source: recommended adapters/pi-renderer.ts
import { Text } from "@earendil-works/pi-tui";

export type RenderOutput = string;

export function piRenderWrapper<T extends (...args: unknown[]) => RenderOutput>(fn: T) {
  return (...args: Parameters<T>) => new Text(fn(...args), 0, 0);
}
```

### Entry point wrapper sketch
```typescript
// Source: recommended adapters/entry.ts shape
import type { AgentAPI, AgentContext } from "../interfaces/agent-api.ts";
import type { McpConfig } from "../types.ts";
import type { MetadataCache } from "../metadata-cache.ts";

export function createMcpAdapter(
  agentapi: AgentAPI,
  ctx: AgentContext,
  config: McpConfig,
  cache: MetadataCache,
): void {
  // register flag, commands, direct tools, proxy tool
  // wire session_start / session_shutdown via agentapi.on()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 核心源码直接 import `@earendil-works/pi-coding-agent` 类型 | 核心源码只使用 `interfaces/agent-api.ts` 与本地类型；Pi 类型仅存在于 adapter 边界 | Phase 5 | 非 Pi 环境与 CI 可以通过类型检查；上游合并冲突面减小 |
| `index.ts` 既做 Pi 入口又做全部注册逻辑 | `index.ts` 仅做 Pi 适配与委托，`adapters/entry.ts` 做通用注册 | Phase 5 | 未来 agent 可直接复用 `createMcpAdapter` |
| `sampling-handler.ts` 直接调用 `pi-ai.complete` | `sampling-handler.ts` 依赖注入的 `SamplingProvider` | Phase 5 | Pi AI 模型/认证逻辑可替换，测试更容易 mock |
| `tool-result-renderer.ts` 直接返回 `pi-tui.Text` | 核心返回 `RenderOutput`，Pi 侧包成 `Text` | Phase 5 | 其他 agent 可以按自己的 UI 渲染结果 |

**Deprecated/outdated:**
- 在核心文件中使用 `AgentToolResult` / `ExtensionUIContext` / `ExtensionContext`：应由本地 `McpToolResult` / `UISystem` / `AgentContext` 取代。
- 在核心中直接构造 `pi-tui.Text`：应由 Pi renderer bridge 处理。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pi 的 `AgentToolResult` 结构可安全地用本地 `{ content, details? }` 替代，且 Pi renderer 能继续工作 | Standard Stack / Don't Hand-Roll | 如果 content block 形状不兼容，Pi 渲染会失败； mitigation：保持与 `McpContent` 一致 |
| A2 | `createDirectToolExecutor` 的 `onUpdate` 与 `ctx` 参数在实现中未被使用，可泛化 | DECOUPLE-03 | 如果上游或 Pi 未来依赖这些参数，需要重新评估；当前代码确实未使用 [VERIFIED: codebase analysis] |
| A3 | `UISystem` 增加可选 `confirm` 方法不会破坏现有非 Pi adapter 合约 | DECOUPLE-02 | 因为是可选方法，现有实现无需改动；若选择映射到 `form`，则无需新增 confirm |
| A4 | `MCP_AGENT_DIR` 作为通用 env 名可被接受，同时保留 `PI_CODING_AGENT_DIR` fallback | DECOUPLE-07 | 如果用户只设置了老变量，fallback 保证兼容 |

**If this table is empty:** N/A — 本阶段存在若干低风险的实现选择型假设。

## Open Questions (RESOLVED)

1. **Sampling provider 的接口粒度**
   - What we know: 需要把 `complete`、`resolveModel`、`confirm` 抽象出来，Pi 侧实现。
   - What's unclear: `resolveModel` 是否应返回 Pi `Model<Api>` 的通用子集，还是完全隐藏 Pi 类型？
   - Recommendation: 返回完全隐藏 Pi 类型的 `SamplingModel`（仅 provider/id/name），Pi provider 内部持有 Pi `Model` 引用，避免把 `Api` 泛型泄漏到核心。
   - **RESOLVED:** `SamplingProvider` returns `SamplingModel` (plain object with provider/id/name); Pi implementation internally maps to Pi `Model<Api>`.

2. **Renderer 抽象层级**
   - What we know: `renderMcpToolResult` 与 `renderMcpProxyToolCall` 当前返回 `Text`。
   - What's unclear: 是否应让核心 renderer 返回 `string`，还是返回 `{ text: string }` 以便未来扩展 ANSI/样式元数据？
   - Recommendation: 先返回 `string` 以最小化改动；如需样式元数据，后续可在 Pi renderer bridge 中扩展，不影响核心。
   - **RESOLVED:** Core renderer functions return `string`; Pi-specific `adapters/pi-renderer.ts` wraps the string into `pi-tui.Text`.

3. **`agent-dir.ts` 的通用化边界**
   - What we know: `getAgentPath` 被 `createPiResolver` 用作 Pi 默认路径源。
   - What's unclear: 是否需要为 `agent-dir.ts` 引入 `AgentPathResolver` 参数，还是保持其为 Pi 默认实现、由其他 agent 提供自己的 resolver？
   - Recommendation: 保持 `agent-dir.ts` 为 Pi 默认实现，仅把 env 变量名扩展为 `MCP_AGENT_DIR` + `PI_CODING_AGENT_DIR` fallback；非 Pi agent 通过 `interfaces/agent-paths.ts` 提供自己的 resolver。
   - **RESOLVED:** `agent-dir.ts` keeps its current Pi-default implementation and adds `MCP_AGENT_DIR` env variable with `PI_CODING_AGENT_DIR` fallback. Non-Pi agents implement their own `AgentPathResolver` via `interfaces/agent-paths.ts`.

4. **测试覆盖范围**
   - What we know: 现有测试对 `sampling-handler.ts` 和 `elicitation-handler.ts` 依赖 Pi 类型/函数有 mock。
   - What's unclear: 是否需要在 Phase 5 新增 `createMcpAdapter` 的集成测试，还是留给 Phase 7？
   - Recommendation: Phase 5 至少新增 `__tests__/entry.test.ts` 验证通用入口注册行为；更完整的跨 agent 测试留给 Phase 7。
   - **RESOLVED:** Phase 5 adds `__tests__/entry.test.ts` to verify `createMcpAdapter` registration behavior. Cross-agent per-adapter verification remains in Phase 7.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime / tests | ✓ | v24.12.0 | — |
| npm | Package manager | ✓ | 11.6.2 | — |
| TypeScript | Type check | ✓ | 5.9.3 | — |
| Vitest | Test runner | ✓ | 3.2.6 | — |
| `@earendil-works/pi-coding-agent` | Pi adapter / index wrapper | ✗ | — | 核心代码不再依赖；测试可用 mock 或 skip |
| `@earendil-works/pi-ai` | Pi sampling provider | ✓ | ^0.74.0 installed | 仅 Pi provider 实现需要 |
| `@earendil-works/pi-tui` | Pi renderer bridge | ✓ | ^0.74.0 installed | 仅 Pi renderer 包装需要 |

**Missing dependencies with no fallback:**
- `@earendil-works/pi-coding-agent`：当前导致 `npx tsc --noEmit` 失败；Phase 5 目标就是消除核心代码对该包的类型依赖。

**Missing dependencies with fallback:**
- 无。

## Validation Architecture

> `workflow.nyquist_validation` 未在 `.planning/config.json` 中显式关闭，按启用处理。

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.6 |
| Config file | `package.json` scripts + `vitest.config.*`（若存在） |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECOUPLE-01 | Core files no longer import Pi `AgentToolResult`; `McpToolResult` works | unit | `npx vitest run proxy-modes direct-tools tool-result-renderer` | ❌ 需新增/更新 |
| DECOUPLE-02 | `sampling-handler.ts` / `elicitation-handler.ts` use `UISystem` | unit | `npx vitest run sampling-handler elicitation-handler` | ❌ 需更新 |
| DECOUPLE-03 | `direct-tools.ts` no longer imports `ExtensionContext` | unit | `npx tsc --noEmit` | ❌ 需更新 |
| DECOUPLE-04 | `proxy-modes.ts` / `index.ts` use generic `ToolInfo` | unit | `npx tsc --noEmit` | ❌ 需更新 |
| DECOUPLE-05 | Pi AI types isolated in Pi sampling provider | unit | `npx vitest run sampling-handler pi-sampling-provider` | ❌ 需新增 |
| DECOUPLE-06 | `tool-result-renderer.ts` no longer imports `pi-tui.Text` | unit | `npx tsc --noEmit` | ❌ 需更新 |
| DECOUPLE-07 | `agent-dir.ts` supports resolver / generic env | unit | `npx vitest run agent-dir-paths` | ❌ 需更新 |
| ENTRY-01 | `createMcpAdapter` exists in `adapters/entry.ts` and registers tools/commands/flags/events | unit/integration | `npx vitest run entry` | ❌ 需新增 |
| ENTRY-02 | `index.ts` delegates to `createMcpAdapter` | integration | `npx vitest run index-lifecycle` | ❌ 需更新 |
| ENTRY-03 | Pi default export and alias behavior unchanged | integration | `npx vitest run index-lifecycle pi-adapter` | ❌ 需更新 |

### Sampling Rate
- **Per task commit:** `npm test`（跳过交互式可视化测试，因 dist 缺失）
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** `npx tsc --noEmit` 通过 + 全量测试绿 + 核心文件无 Pi import

### Wave 0 Gaps
- [ ] `__tests__/entry.test.ts` — 覆盖 ENTRY-01
- [ ] `__tests__/pi-wrapper.test.ts` 或扩展 `index-lifecycle.test.ts` — 覆盖 ENTRY-02/03
- [ ] `interfaces/sampling.ts` + `adapters/pi-sampling-provider.ts` — 覆盖 DECOUPLE-05
- [ ] `adapters/pi-renderer.ts` — 覆盖 DECOUPLE-06
- [ ] 更新 `__tests__/sampling-handler.test.ts` 使用 `SamplingProvider` mock
- [ ] 更新 `__tests__/elicitation-handler.test.ts` 使用 `UISystem` 类型
- [ ] `npx tsc --noEmit` 绿态基线（Phase 5 完成后不应再依赖 `pi-coding-agent`）

## Security Domain

> `security_enforcement` 未关闭，默认启用。本阶段为类型与入口重构，不引入新攻击面，但需保留既有输入验证与授权确认控制。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 无变更；OAuth 流程保留在 `mcp-auth-flow.ts` |
| V3 Session Management | no | 无变更；生命周期由 `McpLifecycleManager` 管理 |
| V4 Access Control | no | 无变更；sampling autoApprove / elicitation autoOpenUrls 配置保留 |
| V5 Input Validation | yes | 保留现有 JSON Schema 校验（`coerceAndValidateFormValues`）与工具参数校验；类型解耦不应削弱运行时校验 [VERIFIED: elicitation-handler.ts] |
| V6 Cryptography | no | 无变更；token / key 处理保留 |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sampling / elicitation 绕过确认 | Elevation of privilege | 保持 `autoApprove` / `autoOpenUrls` 默认关闭；`SamplingProvider.confirm` 与 `UISystem.form` 必须可用时才允许交互式操作 [VERIFIED: sampling-handler.ts, elicitation-handler.ts] |
| 工具结果渲染注入 | Tampering | `tool-result-renderer.ts` 仅输出文本与已知 image mimeType，不执行用户输入 [VERIFIED: tool-result-renderer.ts] |
| 路径遍历通过配置覆盖 | Tampering | `resolveAgentGlobalConfigPath` 对 `overridePath` 使用 `resolve()`；`agent-dir.ts` 仅拼接 home/agent 段 [VERIFIED: interfaces/agent-paths.ts] |

## Upstream Merge Conflict Considerations

根据 `UPSTREAM-03` / `UPSTREAM-04`，Phase 5 的实现应遵循以下规则以最小化与上游 `https://github.com/nicobailon/pi-mcp-adapter` 的合并冲突 [CITED: REQUIREMENTS.md UPSTREAM-03/04]：

1. **新增文件优先于修改源文件**
   - 把 Pi 特有逻辑抽到 `adapters/pi-sampling-provider.ts`、`adapters/pi-renderer.ts`、`interfaces/sampling.ts` 等新文件。
   - `adapters/`、`interfaces/` 下的新文件属于“always keep ours”，不会与上游冲突。

2. **源文件修改限制在类型/import 层面**
   - `proxy-modes.ts`、`direct-tools.ts`、`tool-result-renderer.ts`、`sampling-handler.ts`、`elicitation-handler.ts`、`index.ts` 的修改应尽量只做 import 替换与类型签名调整，保留原有函数体与业务逻辑。
   - 这符合 GitNexus 影响分析结果：`executeCall`、`createDirectToolExecutor`、`handleSamplingRequest`、`handleElicitationRequest` 的上游调用路径分别集中在 `index.ts` 与 `server-manager.ts`，业务逻辑改动会增加冲突风险 [VERIFIED: gitnexus impact analysis]。

3. **保留 Pi 默认导出作为兼容层**
   - `index.ts` 继续导出 `mcpAdapter` 与 `piMcpAdapter`，内部委托给 `createMcpAdapter`。上游若修改 `index.ts` 中的注册细节，我们可以在 wrapper 层合并时保留双方行为。

4. **不要在核心文件中引入 Pi 特定可选字段**
   - 避免为了“方便”而在 `AgentContext` 或 `UISystem` 上增加 Pi 类型字段；这会把上游合并时的类型冲突引入核心接口。

5. **后续 `UPSTREAM-CHANGES.md` 应记录**
   - 每个被修改的 source 文件（import/类型层面）及其解耦理由。
   - 新增 adapter/wrapper 文件与上游无冲突，可一句话带过。

## Sources

### Primary (HIGH confidence)
- `interfaces/agent-api.ts` — `AgentAPI` / `AgentContext` / `UISystem` / `ToolInfo` 契约 [VERIFIED: codebase analysis]
- `adapters/pi-adapter.ts` — `PiAdapter` / `adaptPiContext` 参考实现 [VERIFIED: codebase analysis]
- `proxy-modes.ts`, `direct-tools.ts`, `tool-result-renderer.ts`, `sampling-handler.ts`, `elicitation-handler.ts`, `index.ts`, `agent-dir.ts` — 待解耦源码 [VERIFIED: codebase analysis]
- `__tests__/sampling-handler.test.ts`, `__tests__/elicitation-handler.test.ts`, `__tests__/index-lifecycle.test.ts`, `__tests__/adapter-contract.test.ts` — 测试契约 [VERIFIED: codebase analysis]
- GitNexus impact analysis for `mcpAdapter`, `executeCall`, `createDirectToolExecutor`, `handleSamplingRequest`, `handleElicitationRequest`, `renderMcpToolResult`, `getAgentDir` [VERIFIED: gitnexus impact analysis]

### Secondary (MEDIUM confidence)
- Refactoring.Guru — Adapter pattern decouples external library dependencies [CITED: refactoring.guru/design-patterns/adapter/typescript/example]
- CodeSignal — Facade/Adapter patterns for backward compatibility in TypeScript [CITED: codesignal.com/learn/courses/backward-compatibility-in-software-development-with-typescript]

### Tertiary (LOW confidence)
- General web search on TypeScript decoupling, LLM sampling abstraction, terminal UI abstraction [ASSUMED / websearch only]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部来自项目内 package.json 与已运行版本命令。
- Architecture: HIGH — 基于直接阅读核心源码、测试文件、PiAdapter 实现，以及 GitNexus 影响分析。
- Pitfalls: HIGH — 主要来自当前源码结构、测试断言与 Phase 1–3 已锁定接口设计。

**Research date:** 2026-06-15
**Valid until:** 30 days for stable TypeScript/adapter patterns; immediate relevance for this phase.

## RESEARCH COMPLETE
