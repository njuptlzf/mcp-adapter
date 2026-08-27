# mcp-adapter FAQ

> 本文档收录 mcp-adapter 架构设计中的常见问题、取舍分析和流程对比。
> 新的 FAQ 可以追加到对应章节末尾。

---

## 目录

- [架构演化](#架构演化)
  - [Q1: 原始 pi-mcp-adapter 和当前 for-every-agent mcp-adapter 的流程有什么区别？](#q1-原始-pi-mcp-adapter-和当前-for-every-agent-mcp-adapter-的流程有什么区别)
  - [Q2: AgentAPI 接口是一开始就有的吗？](#q2-agentapi-接口是一开始就有的吗)
- [适配器设计](#适配器设计)
  - [Q3: 为什么每个 agent 需要单独的适配器？有了 Skill，启动脚本不应该都一样吗？](#q3-为什么每个-agent-需要单独的适配器有了-skill启动脚本不应该都一样吗)
  - [Q4: Skill 和 Adapter 的职责边界是什么？](#q4-skill-和-adapter-的职责边界是什么)
  - [Q5: 新增一个 Agent 需要改哪些代码？](#q5-新增一个-agent-需要改哪些代码)
- [取舍分析](#取舍分析)
  - [Q6: 适配器之间的代码重复是必须的吗？为什么不提取基类？](#q6-适配器之间的代码重复是必须的吗为什么不提取基类)
  - [Q7: unknown 类型是否牺牲了类型安全？](#q7-unknown-类型是否牺牲了类型安全)
- [部署与运行时](#部署与运行时)
  - [Q8: 不同 Agent 的部署方式有什么差异？](#q8-不同-agent-的部署方式有什么差异)
  - [Q9: 向后兼容是如何保证的？](#q9-向后兼容是如何保证的)
- [如何贡献新 FAQ](#如何贡献新-faq)

---

## 架构演化

### Q1: 原始 pi-mcp-adapter 和当前 for-every-agent mcp-adapter 的流程有什么区别？

**原始 pi-mcp-adapter**（上游 `nicobailon/pi-mcp-adapter`）是 Pi 专用单体架构，所有逻辑直接耦合 Pi 的 `ExtensionAPI`，没有抽象层。

**当前 mcp-adapter**（fork `njuptlzf/mcp-adapter`）引入了 `AgentAPI` 抽象层，任何 agent 只需实现 8 个方法即可接入，核心逻辑完全 agent-agnostic。

#### 图 1：原始 pi-mcp-adapter 流程（Pi-only，无 AgentAPI）

```mermaid
graph TB
    subgraph Pi运行时
        PI_RUNTIME[Pi Agent Runtime]
        EXT_API["ExtensionAPI<br/>Pi 原生插件 API<br/>registerTool / registerCommand<br/>registerFlag / on / getAllTools<br/>getFlag / sendMessage / exec"]
    end

    subgraph "pi-mcp-adapter 单体（所有逻辑内联）"
        INDEX_TS["index.ts<br/>mcpAdapter(pi: ExtensionAPI)<br/>唯一入口，Pi 专用"]
        INLINE_REG["内联注册逻辑<br/>直接调用 pi.registerTool 等<br/>• mcp proxy tool<br/>• /mcp 命令<br/>• /mcp-auth 命令<br/>• mcp-config flag<br/>• session_start / session_shutdown"]
        INLINE_LIFECYCLE["内联生命周期<br/>• initializeMcp<br/>• updateStatusBar<br/>• flushMetadataCache<br/>• shutdownOAuth"]
        CONFIG_LOAD["config.ts<br/>loadMcpConfig<br/>硬编码 Pi 路径"]
        META_CACHE["metadata-cache.ts<br/>loadMetadataCache"]
    end

    subgraph "Pi 工具系统"
        MCP_TOOL["mcp proxy tool<br/>~250 tokens"]
        MCP_CMD["/mcp /mcp-auth 命令"]
        MCP_FLAG["mcp-config flag"]
    end

    subgraph "MCP 服务器"
        SRV1[Server 1]
        SRV2[Server 2]
        SRVN[Server N]
    end

    PI_RUNTIME -->|"加载插件"| EXT_API
    EXT_API -->|"传入 pi 实例"| INDEX_TS
    INDEX_TS --> INLINE_REG
    INDEX_TS --> INLINE_LIFECYCLE
    INDEX_TS --> CONFIG_LOAD
    INDEX_TS --> META_CACHE
    CONFIG_LOAD -->|"读取 mcp.json"| INLINE_REG
    INLINE_REG -->|"pi.registerTool"| MCP_TOOL
    INLINE_REG -->|"pi.registerCommand"| MCP_CMD
    INLINE_REG -->|"pi.registerFlag"| MCP_FLAG
    INLINE_LIFECYCLE -->|"session_start 延迟连接"| SRV1
    INLINE_LIFECYCLE --> SRV2
    INLINE_LIFECYCLE --> SRVN
    MCP_TOOL -.->|"代理调用"| SRV1
    MCP_TOOL -.-> SRV2
    MCP_TOOL -.-> SRVN
```

**原始架构特征：**
- 无 `AgentAPI` 接口 — 直接用 Pi 的 `ExtensionAPI`
- 无 `adapters/` 目录 — 所有逻辑在 `index.ts` 内联
- 无 `AGENT_ADAPTERS` 注册表
- 无 `AgentPathResolver` — 配置路径硬编码为 Pi 的路径
- 无 `createMcpAdapter` 通用入口 — 只有 `mcpAdapter(pi)` Pi 专用函数
- 无法支持其他 agent — 想支持 Qoder 就得 fork 整个项目重写

#### 图 2：当前 for-every-agent mcp-adapter 流程（引入 AgentAPI）

```mermaid
graph TB
    subgraph "任意 Agent 运行时"
        PI_RT[Pi Runtime]
        QODER_RT[Qoder Runtime]
        KILO_RT[Kilo Runtime]
        CUSTOM_RT[Custom Agent Runtime]
    end

    subgraph "部署层 — mcp-adapter Skill (Phase 2)"
        SKILL["SKILL.md<br/>Phase 0: 识别目标 Agent<br/>Phase 1: 验证前置条件<br/>Phase 2: 分支执行部署<br/>Phase 3: 验证持久化<br/>Phase 4: 注册 AGENT_ADAPTERS"]
        SKILL -->|"Branch A: Pi"| DEPLOY_PI["pi install npm:pi-mcp-adapter<br/>一条命令"]
        SKILL -->|"Branch B: Qoder"| DEPLOY_QODER["SDK bridge<br/>+ SessionStart hook"]
        SKILL -->|"Branch C: Custom"| DEPLOY_CUSTOM["实现 AgentAPI<br/>+ 注入启动脚本"]
    end

    subgraph "注册表 — AGENT_ADAPTERS"
        REG["AGENT_ADAPTERS<br/>interfaces/agent-api.ts"]
        REG_ENTRY1["id: pi<br/>factory: PiAdapter<br/>resolver: createPiResolver"]
        REG_ENTRY2["id: qoder<br/>factory: QoderAdapter<br/>resolver: createQoderResolver"]
        REG_ENTRY3["id: kilo<br/>factory: KiloAdapter<br/>resolver: createKiloResolver"]
        REG --- REG_ENTRY1
        REG --- REG_ENTRY2
        REG --- REG_ENTRY3
    end

    subgraph "抽象层 — AgentAPI 接口（8 方法）"
        API["AgentAPI<br/>interfaces/agent-api.ts"]
        M1["registerTool"]
        M2["registerCommand"]
        M3["registerFlag"]
        M4["on event"]
        M5["getAllTools"]
        M6["getFlag"]
        M7["sendMessage"]
        M8["exec"]
        API --- M1 & M2 & M3 & M4 & M5 & M6 & M7 & M8
    end

    subgraph "适配器层 — 每个 Agent 一个实现"
        PI_ADAPTER["PiAdapter<br/>adapters/pi-adapter.ts<br/>直接委托 ExtensionAPI<br/>+ adaptTool / adaptCommand"]
        QODER_ADAPTER["QoderAdapter<br/>adapters/qoder-adapter.ts<br/>Map 存储 + SDK bridge<br/>+ attachQuery"]
        KILO_ADAPTER["KiloAdapter<br/>adapters/kilo-adapter.ts<br/>Map 存储 + hook 注入<br/>+ attachSendMessage"]
    end

    subgraph "通用入口 — createMcpAdapter"
        ENTRY["adapters/entry.ts<br/>createMcpAdapter(agentapi, ctx, config, cache)<br/>agent-agnostic 通用逻辑"]
        ENTRY_REG["通用注册逻辑<br/>• mcp proxy tool<br/>• /mcp /mcp-auth 命令<br/>• mcp-config flag<br/>• session_start / shutdown"]
        ENTRY_LIFECYCLE["通用生命周期<br/>• initializeMcp<br/>• updateStatusBar<br/>• flushMetadataCache<br/>• shutdownOAuth"]
    end

    subgraph "路径解析 — AgentPathResolver"
        RESOLVER["AgentPathResolver<br/>interfaces/agent-paths.ts"]
        PI_RES["createPiResolver<br/>~/.pi/agent/mcp.json"]
        QODER_RES["createQoderResolver<br/>~/.qoder/agent/mcp.json"]
        KILO_RES["createKiloResolver<br/>~/.kilo/mcp.json"]
        RESOLVER --- PI_RES & QODER_RES & KILO_RES
    end

    subgraph "Agent 工具系统"
        MCP_TOOL2["mcp proxy tool<br/>~250 tokens"]
        MCP_CMD2["/mcp /mcp-auth 命令"]
    end

    subgraph "MCP 服务器"
        S1[Server 1]
        S2[Server 2]
        SN[Server N]
    end

    PI_RT --> DEPLOY_PI
    QODER_RT --> DEPLOY_QODER
    KILO_RT --> DEPLOY_CUSTOM
    CUSTOM_RT --> DEPLOY_CUSTOM

    DEPLOY_PI --> REG
    DEPLOY_QODER --> REG
    DEPLOY_CUSTOM --> REG

    REG -->|"factory 实例化"| PI_ADAPTER
    REG -->|"factory 实例化"| QODER_ADAPTER
    REG -->|"factory 实例化"| KILO_ADAPTER

    PI_RT -->|"ExtensionAPI"| PI_ADAPTER
    QODER_RT -->|"SDK Query"| QODER_ADAPTER
    KILO_RT -->|"hooks 注入"| KILO_ADAPTER

    PI_ADAPTER -.->|"implements"| API
    QODER_ADAPTER -.->|"implements"| API
    KILO_ADAPTER -.->|"implements"| API

    API -->|"传入 agentapi 参数"| ENTRY
    RESOLVER -->|"传入 config 路径"| ENTRY
    ENTRY --> ENTRY_REG
    ENTRY --> ENTRY_LIFECYCLE
    ENTRY_REG -->|"agentapi.registerTool"| MCP_TOOL2
    ENTRY_REG -->|"agentapi.registerCommand"| MCP_CMD2
    ENTRY_LIFECYCLE -->|"session_start 延迟连接"| S1 & S2 & SN
    MCP_TOOL2 -.->|"代理调用"| S1 & S2 & SN

    INDEX_COMPAT["index.ts<br/>mcpAdapter(pi)<br/>向后兼容包装<br/>PiAdapter + createMcpAdapter"]
    PI_RT -.->|"向后兼容"| INDEX_COMPAT
    INDEX_COMPAT -.-> PI_ADAPTER
    INDEX_COMPAT -.-> ENTRY
```

**当前架构特征：**
- `AgentAPI` 接口（8 方法）作为 agent-agnostic 抽象合约
- `createMcpAdapter(agentapi, ctx, config, cache)` 通用入口，所有注册逻辑在此完成
- 每个 agent 一个 Adapter 实现（`PiAdapter` / `QoderAdapter` / `KiloAdapter`）
- `AGENT_ADAPTERS` 注册表支持动态发现
- `AgentPathResolver` 抽象配置路径
- `index.ts` 保留 `mcpAdapter(pi)` 向后兼容包装

---

### Q2: AgentAPI 接口是一开始就有的吗？

**不是。** `AgentAPI` 是 fork 后为通用化引入的抽象层，原始上游 pi-mcp-adapter 中不存在。

从代码可以确认：
- 原始上游只有一个 `mcpAdapter(pi: ExtensionAPI)` 函数，直接对接 Pi 的原生 API
- `AgentAPI`、`AgentContext`、`UISystem`、`AgentPathResolver`、`AGENT_ADAPTERS` 都是 fork 后新增的
- `PiAdapter` 是为了把 Pi 的 `ExtensionAPI` 适配到 `AgentAPI` 接口而创建的包装层
- `adapters/entry.ts` 中的 `createMcpAdapter` 是取代原始内联逻辑的通用入口

详细的改造过程记录在 [architecture-comparison.md](architecture-comparison.md) 中。

---

## 适配器设计

### Q3: 为什么每个 agent 需要单独的适配器？有了 Skill，启动脚本不应该都一样吗？

**不一样。** Skill 和 Adapter 解决的是两个不同层面的问题：

| 层面 | 通用还是专用？ | 原因 |
|------|--------------|------|
| **Skill（部署流程）** | 通用 | 所有 agent 的部署流程类似：识别 → 检查 → 安装 → 验证 |
| **createMcpAdapter（核心逻辑）** | 通用 | 注册 proxy tool、命令、生命周期 — 逻辑完全相同 |
| **AgentAPI 接口** | 通用 | 8 方法的抽象合约，所有 agent 共用 |
| **具体 Adapter 实现** | 专用 | 每个 agent 的原生 API 不同，必须各自实现 |
| **AgentPathResolver** | 专用 | 每个 agent 的配置目录不同 |

**Skill 解决部署流程问题**（怎么装进去），**Adapter 解决运行时 API 对接问题**（怎么跟 agent 的工具注册系统说话）。即使 Skill 统一了部署流程，运行时每个 agent 的 API 仍然不同：

- **Pi** 有原生 `ExtensionAPI`，直接调用 `pi.registerTool()`
- **Qoder** 用 SDK bridge，通过 `Query.streamInput` 交互
- **Kilo** 没有 SDK，通过 hooks 注入 + Map 存储 + 回调模拟

这些差异无法用一个通用启动脚本消除 — 因为每个 agent 的运行时 API 签名根本不一样。

---

### Q4: Skill 和 Adapter 的职责边界是什么？

```
┌─────────────────────────────────────────────────────────────────┐
│                    mcp-adapter Skill (Phase 2)                    │
│                                                                 │
│  职责：部署流程通用化                                           │
│  • 识别目标 Agent                                               │
│  • 验证前置条件（Node.js / npx / 配置文件）                     │
│  • 分支执行部署（Pi 一条命令 / Qoder SDK / Custom AgentAPI）    │
│  • 验证持久化（SessionStart hook 是否正确触发）                 │
│  • 注册到 AGENT_ADAPTERS                                        │
│                                                                 │
│  不负责：运行时 API 对接                                        │
├─────────────────────────────────────────────────────────────────┤
│                    AgentAPI Adapter 实现                         │
│                                                                 │
│  职责：运行时 API 差异化                                        │
│  • 实现 AgentAPI 的 8 个方法                                    │
│  • 将通用调用转换为 agent 原生 API 调用                         │
│  • 处理上下文转换（AgentContext ↔ 原生 Context）                │
│  • 处理 UI 系统适配（UISystem ↔ 原生 UI）                       │
│  • 提供事件模拟（如 fireSessionStart / fireSessionShutdown）    │
│                                                                 │
│  不负责：部署流程                                               │
├─────────────────────────────────────────────────────────────────┤
│                    createMcpAdapter 通用入口                     │
│                                                                 │
│  职责：核心注册逻辑（agent-agnostic）                           │
│  • 注册 mcp proxy tool（~250 tokens）                           │
│  • 注册 /mcp、/mcp-auth 命令                                    │
│  • 注册 mcp-config flag                                         │
│  • 注册 session_start / session_shutdown 生命周期               │
│  • 初始化 MCP 服务器连接                                        │
│                                                                 │
│  不负责：agent 特定的 API 对接                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Q5: 新增一个 Agent 需要改哪些代码？

#### 原始架构（fork 整个项目重写）

```mermaid
graph LR
    ORIG_FORK["fork 整个项目"] --> ORIG_REWRITE["重写 index.ts<br/>把 ExtensionAPI 调用<br/>全部替换为目标 agent SDK"]
    ORIG_REWRITE --> ORIG_RESULT["结果：完全分叉<br/>无法合并上游更新"]
```

#### 当前架构（只加不改）

```mermaid
graph LR
    NEW1["1. adapters/xxx-adapter.ts<br/>新建（实现 AgentAPI 8方法）"] --> NEW2["2. interfaces/agent-paths.ts<br/>+25行（createXxxResolver）"]
    NEW2 --> NEW3["3. interfaces/agent-api.ts<br/>+10行（AGENT_ADAPTERS 条目）"]
    NEW3 --> NEW4["4. 入口脚本<br/>新建（创建 adapter + 调用 createMcpAdapter）"]
    NEW4 --> NEW5["5. Agent 配置<br/>SessionStart hook 或等效机制"]
    NEW5 --> NEW_RESULT["结果：通用逻辑零修改<br/>createMcpAdapter 完全复用<br/>上游可正常反合"]
```

以 Kilo 为例，新增需要 5 个文件变更：
1. `adapters/kilo-adapter.ts` — 新建，~266 行，实现 AgentAPI
2. `interfaces/agent-paths.ts` — +25 行，添加 `createKiloResolver()`
3. `interfaces/agent-api.ts` — +10 行，在 `AGENT_ADAPTERS` 注册 Kilo 条目
4. `.kilo/mcp-adapter-entry.ts` — 新建入口脚本
5. `~/.config/kilo/settings.json` — SessionStart hook 配置

**核心逻辑（`adapters/entry.ts`、`init.ts`、`proxy-modes.ts` 等）零修改。**

---

## 取舍分析

### Q6: 适配器之间的代码重复是必须的吗？为什么不提取基类？

**Adapter 实现是必须的**（因为 agent 的运行时 API 不同），但**代码重复不是必须的**。

当前 `KiloAdapter`（266 行）有约 200 行与 `QoderAdapter` 几乎相同 — 主要是 Map 存储、事件模拟器、UI no-op 实现等。可以通过提取 `BaseAgentAdapter` 基类压缩到约 50 行：

```typescript
// 理想结构（未来优化方向）
abstract class BaseAgentAdapter implements AgentAPI {
  protected tools = new Map<string, ToolRegistration>();
  protected commands = new Map<string, CommandConfig>();
  protected flags = new Map<string, FlagConfig>();
  protected eventHandlers = new Map<string, Function[]>();

  // 通用实现：8 方法中的 6 个可以默认实现
  registerTool(tool) { this.tools.set(tool.name, tool); }
  getAllTools() { return [...this.tools.values()]; }
  // ... 其余通用方法

  // 子类只需覆盖差异部分
  abstract sendMessage(message: unknown, options?: unknown): void;
  abstract exec(command: string, args: string[]): Promise<unknown>;
}

class KiloAdapter extends BaseAgentAdapter {
  // 仅 ~50 行：sendMessage + exec + UI 配置
}
```

**当前没有做这一步的原因是反合友好性的 trade-off：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **保持现状（代码重复）** | 文件结构与上游一致，反合冲突最小 | 适配器间有 ~200 行重复代码 |
| **提取 BaseAgentAdapter 基类** | 新适配器从 266 行压缩到 ~50 行 | 改变文件结构，增加上游 merge 冲突风险 |

反合友好性是本项目的核心设计约束（详见 [UPSTREAM-CHANGES.md](../UPSTREAM-CHANGES.md)），因此当前选择了代码重复但反合友好的方案。如果未来上游稳定或反合需求降低，可以再提取基类。

---

### Q7: unknown 类型是否牺牲了类型安全？

`AgentAPI` 的方法签名使用了 `unknown` 类型（如 `sendMessage(message: unknown, options?: unknown)`），看起来丢掉了编译期类型安全。但实际上这是可接受的：

1. **不同 agent 的类型完全不同**：Pi 是 `ExtensionMessage`，Qoder 是 SDK 特定类型，无法用联合类型覆盖
2. **调用点有限**：`sendMessage` 在核心逻辑中只有 3 个调用点，运行时类型错误会立即暴露
3. **Adapter 层做了 cast**：出错边界清晰 — 要么是 adapter 写错了，要么是调用方传了错的类型

这是 **"宽接口、严实现"** 的策略 — 接口层面接受任何输入，adapter 层面确保正确转换。

| 维度 | 原仓库 | Fork | 权衡 |
|------|--------|------|------|
| **类型安全** | Pi 类型精确匹配，编译期检查 | `unknown` 类型，运行时断言 | 牺牲编译期安全换跨 agent 兼容 |
| **依赖耦合** | Pi 包是 hard dependency | Pi 包是 optional peerDependency | 非 Pi 用户无需安装 Pi |
| **文件改动面** | 换 agent 要改 10+ 文件 | 换 agent 只需写 1 个 adapter 文件 | 维护成本从 O(n) 降到 O(1) |
| **上游合并** | — | Adapter 层隔离，core logic 不变 | 可继续从上游 cherry-pick |
| **测试复杂度** | 需要真实 Pi 环境 | MockAgent 可独立测试全部逻辑 | 测试不依赖特定 agent 运行时 |
| **API 表面积** | 暴露 Pi 内部类型 | 暴露 3 个通用接口 + 8 个方法 | 新 agent 开发者学习成本极低 |

---

## 部署与运行时

### Q8: 不同 Agent 的部署方式有什么差异？

| Agent | 部署方式 | 配置位置 | 启动机制 |
|-------|---------|---------|---------|
| **Pi** | `pi install npm:pi-mcp-adapter` 一条命令 | `~/.pi/agent/mcp.json` | Pi 原生插件加载 |
| **Qoder** | SDK bridge + SessionStart hook | `~/.qoder/agent/mcp.json` | `~/.qoder/settings.json` 中的 SessionStart hook |
| **Kilo** | 手动入口脚本 + SessionStart hook | `~/.kilo/mcp.json` | `~/.config/kilo/settings.json` 中的 SessionStart hook |
| **Custom** | 实现 AgentAPI + 注入启动脚本 | 自定义路径 | Agent 特定的启动机制 |

**Pi 是最简单的** — 原生支持插件安装，一条命令搞定。
**Qoder 和 Kilo 类似** — 都通过 SessionStart hook 在会话启动时注入入口脚本。
**Custom Agent** 需要根据 agent 的扩展机制选择合适的注入点。

---

### Q9: 向后兼容是如何保证的？

`index.ts` 保留了原始的 `mcpAdapter(pi: ExtensionAPI)` 默认导出，内部委托给 `PiAdapter` + `createMcpAdapter`：

```typescript
// index.ts — 向后兼容包装
export default function mcpAdapter(pi: ExtensionAPI) {
  const agentapi = new PiAdapter(pi);           // 创建 Pi 适配器
  const ctx = adaptPiContext(...);              // 转换上下文
  createMcpAdapter(agentapi, ctx, config, cache); // 委托通用入口
}

// 同时导出 piMcpAdapter 别名（D-15）
export { default as piMcpAdapter } from "./index.ts";
```

这意味着：
- 现有 Pi 用户 `import { piMcpAdapter } from "pi-mcp-adapter"` 无需任何修改
- 原始 `mcpAdapter(pi)` 调用方式完全保留
- 新用户可以直接使用 `createMcpAdapter` + 自定义 Adapter

---

## 如何贡献新 FAQ

1. 在对应章节末尾添加新的 Q&A 条目
2. 如果是新主题，创建新的 `## 章节` 并更新[目录](#目录)
3. 图示优先使用 Mermaid 语法（本项目 `<generating_mermaid_diagrams>` 规范：不含样式定义）
4. 涉及代码引用时使用相对路径链接，如 `[adapters/entry.ts](../adapters/entry.ts)`
5. 取舍分析使用表格对比，明确标注 trade-off
