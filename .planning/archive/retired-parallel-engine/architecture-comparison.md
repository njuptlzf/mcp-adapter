# mcp-adapter 架构改造：从 Pi-only 到 For Every Agent

> 对比原仓库 [nicobailon/pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) 与 fork [njuptlzf/mcp-adapter](https://github.com/njuptlzf/mcp-adapter)

---

## 一句话

原仓库的每一行代码都直接调用 `pi.registerTool` / `pi.on` / `ctx.ui.notify`。Fork 引入了一层通用接口抽象，让任何 agent 只要实现 8 个方法就能使用 mcp-adapter 的全部功能。

---

## 原仓库的耦合问题

```
┌─────────────────────────────────────────────────────┐
│              pi-mcp-adapter (original)               │
│                                                     │
│  index.ts ──→ pi.registerTool()                     │
│  init.ts  ──→ pi.registerTool(), pi.sendMessage()   │
│  utils.ts ──→ pi.exec()                             │
│  state.ts ──→ ExtensionContext, ExtensionUIContext  │
│  config.ts──→ ~/.pi/agent/mcp.json (hardcoded)     │
│  commands.ts→ ctx.ui.notify()                       │
│                                                     │
│  Every file imports from @earendil-works/pi-*       │
│  Every function signature ties to Pi types          │
└─────────────────────────────────────────────────────┘
```

核心问题是 **类型耦合扩散到了每个文件**。要让 Claude Code、Cursor、Qoder 等 agent 也能用，需要把所有 `pi.xxx` 调用替换成 `agent.xxx`，但不同 agent 的 API 签名各不相同。

---

## Fork 的解决方案：三层架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    mcp-adapter (fork)                             │
│                                                                  │
│  ┌─────────────────────────────────────┐                        │
│  │        interfaces/agent-api.ts       │  ← 通用接口层           │
│  │  AgentAPI, AgentContext, UISystem   │    任何 agent 实现这    │
│  │  (8 methods, pure contracts)        │    3 个接口即可接入     │
│  └──────────────┬──────────────────────┘                        │
│                 │                                                │
│  ┌──────────────┴──────────────────────┐                        │
│  │         adapters/pi-adapter.ts       │  ← Adapter 层          │
│  │  PiAdapter implements AgentAPI      │    Pi 专属，隔离在     │
│  │  adaptPiContext(), adaptPiUI()      │    单一文件中          │
│  └──────────────┬──────────────────────┘                        │
│                 │                                                │
│  ┌──────────────┴──────────────────────┐                        │
│  │         Core Logic (unchanged)       │  ← 核心逻辑层           │
│  │  init.ts, proxy-modes.ts,           │    只依赖 AgentAPI /   │
│  │  server-manager.ts, config.ts ...   │    AgentContext 接口   │
│  │  (all use AgentAPI, not ExtensionAPI)│                       │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  ┌─────────────────────────────────────┐                        │
│  │    interfaces/agent-paths.ts         │  ← 路径抽象层          │
│  │  AgentPathResolver contract         │    每个 agent 提供     │
│  │  createPiResolver() factory         │    自己的路径逻辑      │
│  └─────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 改造的 4 个阶段

### Phase 1: 通用接口定义

**文件**: `interfaces/agent-api.ts`

定义了 3 个纯契约接口，总共 8 个方法：

```typescript
// 任何 agent 只需要实现这 8 个方法
interface AgentAPI {
  registerTool(tool: ToolRegistration): void;
  registerCommand(name: string, config: CommandConfig): void;
  registerFlag(name: string, config: FlagConfig): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  getAllTools(): ToolInfo[];
  getFlag(name: string): string | undefined;
  sendMessage(message: unknown, options?: unknown): void;
  exec(command: string, args: string[]): Promise<unknown>;
}
```

同时提供了 `PiAdapter` — 把这 8 个方法桥接到 Pi 的 `ExtensionAPI`：

```typescript
// adapters/pi-adapter.ts — 仅此一个文件知道 Pi 的存在
class PiAdapter implements AgentAPI {
  constructor(private readonly pi: ExtensionAPI) {}
  registerTool(tool) { this.pi.registerTool(tool); }  // 直接透传
  on(event, handler) { this.pi.on(event, handler); }
  // ... 其余 6 个方法同理
}
```

### Phase 2: 路径抽象

**文件**: `interfaces/agent-paths.ts`

原仓库全局配置路径硬编码为 `~/.pi/agent/mcp.json`。Fork 引入 `AgentPathResolver` 合约：

```typescript
interface AgentPathResolver {
  agentId: AgentId;                           // "pi" | "claude" | "cursor" | ...
  globalConfigPath(): string;                 // 每个 agent 返回自己的路径
  projectConfigName?(): string;               // 项目级配置文件名
}

// Pi 的实现（向后兼容）
createPiResolver() → { agentId: "pi", globalConfigPath: () => "~/.pi/agent/mcp.json" }

// Claude 的实现（示例）
createClaudeResolver() → { agentId: "claude", globalConfigPath: () => "~/.claude/mcp.json" }
```

### Phase 3: 核心逻辑全部迁移到通用接口

这是最大的一步。所有核心文件不再依赖 Pi 类型：

| 文件 | 改前依赖 | 改后依赖 |
|------|---------|---------|
| `init.ts` | `ExtensionAPI`, `ExtensionContext` | `AgentAPI`, `AgentContext` |
| `utils.ts` | `pi.exec()` | `agent.exec()` |
| `commands.ts` | `ctx.ui.notify()` | `ctx.ui?.notify()` |
| `state.ts` | `ExtensionUIContext` | `UISystem` |
| `lifecycle.ts` | Pi lifecycle types | Generic lifecycle types |
| `config.ts` | Hardcoded Pi paths | `AgentPathResolver` |

入口点 `index.ts` 的改动最小 — 只在 `session_start` 时创建 adapter：

```typescript
// index.ts - 唯一的 Pi 感知点
pi.on("session_start", async (_event, ctx) => {
  agentapi = new PiAdapter(pi);        // ← 仅此处创建 Pi 桥接
  const agentctx = adaptPiContext(ctx); // ← 转换上下文
  await initializeMcp(agentapi, agentctx); // ← 之后全部用通用接口
});
```

### Phase 4: 测试验证

MockAgent 证明了 "任何 agent 都可以接入"：

```typescript
// tests/fixtures/mock-agent.ts — 30 行，纯内存实现
class MockAgent implements AgentAPI {
  readonly tools = new Map<string, ToolRegistration>();
  registerTool(tool) { this.tools.set(tool.name, tool); }
  // ... 其余 7 个方法同样简洁
}
```

350+ 测试通过，2 个预存失败与改造无关。

---

## 与原始架构的对比流程图

### 原仓库：Pi 类型渗透到每个文件

```
                     @earendil-works/pi-coding-agent
                    ┌─────────────────────────────┐
                    │  ExtensionAPI               │
                    │  ExtensionContext            │
                    │  ExtensionUIContext          │
                    └──────────┬──────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │ index.ts │        │ init.ts  │        │ utils.ts │
    │ pi.register│       │ pi.send  │        │ pi.exec  │
    │ Tool()    │       │ Message()│        │ ()       │
    └──────────┘        └──────────┘        └──────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌──────────┐        ┌──────────┐        ┌──────────┐
    │commands.ts│       │ state.ts │        │ config.ts│
    │ ctx.ui.   │       │ Extension│        │ ~/.pi/   │
    │ notify()  │       │ UIContext│        │ agent/   │
    └──────────┘        └──────────┘        └──────────┘

    每个文件都直接 import Pi 类型 → 换 agent 需要改所有文件
```

### Fork：接口隔离，Pi 仅在一处

```
                    任何 Agent (Pi / Claude / Cursor / Qoder / ...)
                              │
                              │ implements
                              ▼
              ┌───────────────────────────────┐
              │     interfaces/agent-api.ts    │
              │  AgentAPI (8 methods)          │
              │  AgentContext                  │
              │  UISystem                      │
              └──────────────┬────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ adapters/        │          │ tests/fixtures/   │
    │ pi-adapter.ts    │          │ mock-agent.ts     │
    │ (Pi 专属，1 文件)│          │ (测试用，30 行)   │
    └──────────────────┘          └──────────────────┘
              │
              │ AgentAPI instance
              ▼
    ┌─────────────────────────────────────────┐
    │            Core Logic                    │
    │  init.ts    ← 只依赖 AgentAPI          │
    │  utils.ts   ← agent.exec()             │
    │  commands.ts← ctx.ui?.notify()         │
    │  state.ts   ← UISystem                 │
    │  config.ts  ← AgentPathResolver        │
    │  proxy-modes.ts, server-manager.ts ... │
    └─────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │       interfaces/agent-paths.ts          │
    │  createPiResolver()     → ~/.pi/agent/  │
    │  createClaudeResolver() → ~/.claude/    │
    │  createQoderResolver()  → ~/.qoder/     │
    └─────────────────────────────────────────┘

    接入新 agent 只需：实现 AgentAPI + 提供 AgentPathResolver
```

---

## 关键权衡

| 维度 | 原仓库 | Fork | 权衡 |
|------|--------|------|------|
| **类型安全** | Pi 类型精确匹配，编译期检查 | `unknown` 类型，运行时断言 | 牺牲编译期安全换跨 agent 兼容 |
| **依赖耦合** | Pi 包是 hard dependency | Pi 包是 optional peerDependency | 非 Pi 用户可以 `npm install` 无需装 Pi |
| **文件改动面** | 换 agent 要改 10+ 文件 | 换 agent 只需写 1 个 adapter 文件 | 维护成本从 O(n) 降到 O(1) |
| **上游合并** | — | Adapter 层隔离，core logic 不变 | 可以继续从上游 cherry-pick 功能改进 |
| **测试复杂度** | 需要真实 Pi 环境 | MockAgent 可独立测试全部逻辑 | 测试不再依赖特定 agent 运行时 |
| **API 表面积** | 暴露 Pi 内部类型 | 暴露 3 个通用接口 + 8 个方法 | 新 agent 开发者学习成本极低 |

### 为什么 `unknown` 是可以接受的

`AgentAPI.sendMessage(message: unknown, options?: unknown)` 看起来丢掉了类型安全。但实际上：

1. 不同 agent 的 message 类型完全不同（Pi 是 `ExtensionMessage`，Claude 是 `ClaudeMessage`），无法用联合类型覆盖
2. `sendMessage` 在 core logic 中只有 3 个调用点，运行时类型错误会立即暴露
3. Adapter 层做了 cast，出错边界清晰（要么是 adapter 写错了，要么是调用方传了错的类型）

这是 "宽接口、严实现" 的策略 — 接口层面接受任何输入，adapter 层面确保正确转换。

---

## 新 Agent 接入只需两步

以接入 Qoder 为例：

**Step 1**: 实现 `AgentAPI`（约 40 行）

```typescript
class QoderAdapter implements AgentAPI {
  constructor(private qoder: QoderAPI) {}
  registerTool(tool) { this.qoder.registerTool(tool); }
  // ... 其余 7 个方法，全部是透传
}
```

**Step 2**: 提供 `AgentPathResolver`（约 5 行）

```typescript
const qoderResolver: AgentPathResolver = {
  agentId: "qoder",
  globalConfigPath: () => resolve(os.homedir(), ".qoder", "mcp.json"),
  projectConfigName: () => ".mcp.json",
};
```

然后调用 `initializeMcp(new QoderAdapter(qoder), qoderContext, qoderResolver)`，全部 MCP 功能立即可用。

---

## 改造进度

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | AgentAPI / UISystem 接口 + PiAdapter | ✅ 完成 |
| Phase 2 | AgentPathResolver + config.ts 重连 | ✅ 完成 |
| Phase 3 | 全部核心逻辑迁移到通用接口 | ✅ 完成 |
| Phase 4 | 测试覆盖（MockAgent + 兼容性） | ✅ 完成 |

4 个阶段全部完成，350+ 测试通过，Pi 向后兼容完整保留。
