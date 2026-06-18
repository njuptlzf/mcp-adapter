# mcp-adapter Token 节省原理

## 一句话

mcp-adapter 把 N 个 MCP 工具的 schema 定义压缩成 **1 个 ~200 token 的 proxy 工具**，工具定义不再完整出现在 system prompt 里。每多挂一个 server，就多省一份。

---

## 问题：工具定义吃掉上下文窗口

MCP 生态的核心设计是 "agent 可以挂载任意 MCP server，server 的工具自动出现在 agent 的工具列表里"。问题是：

每个工具的 JSON Schema 定义（name + description + parameters）通常有 100~400 tokens。挂 10 个 server、60+ 个工具时，光是工具定义就占 **~4,000 tokens** —— 这在每次 API 请求的 `tools` 参数里都会被携带。

而 LLM 的上下文窗口是付费资源。GPT-4o 输入 $2.50/1M tokens，Claude Opus $15/1M。每次对话消耗几千 tokens 只为了 "告诉模型有哪些工具可用"，大部分工具根本不会在当前对话中被调用。

这就是 mcp-adapter 解决的问题。

---

## 原理：N:1 压缩

mcp-adapter 不把每个工具的完整 schema 暴露给 LLM。它只暴露一个 `mcp` proxy 工具：

```
Direct:   tools = [add_schema, subtract_schema, multiply_schema, ...]   ← 61 schemas, ~4,000 tokens
Adapter:  tools = [mcp_schema]                                           ← 1 schema,  ~250 tokens
```

`mcp` proxy 工具的参数是通用的：

```json
{
  "name": "mcp",
  "description": "Connect to MCP servers and call their tools",
  "parameters": {
    "tool":    { "type": "string", "description": "Tool name to call" },
    "args":    { "type": "string", "description": "Arguments as JSON string" },
    "search":  { "type": "string", "description": "Search tools by name/description" },
    "describe":{ "type": "string", "description": "Tool name to describe" }
  }
}
```

LLM 只需要知道有一个 `mcp` 工具，它通过 `search` 发现具体工具，通过 `tool` + `args` 调用它们。工具 schema 的存储和路由由 mcp-adapter 在本地处理，不消耗 LLM token。

---

## 真实 Agent 工作流对比

### 无 mcp-adapter（Direct 模式）

每次 API 请求都在 `tools` 参数里携带全部 61 个工具定义：

```
┌─────────────────────────────────────────────────────────────────┐
│                    DIRECT MODE (no mcp-adapter)                  │
└─────────────────────────────────────────────────────────────────┘

User: "Calculate 1234 * 5678"
        │
        ▼
┌──────────────────────────────────────────┐
│ API Request #1                           │
│   tools: [61 tool schemas, ~4,000 tokens]│  ← 每次请求都带全部工具定义
│   messages: [{role:"user", content:...}] │
│                                          │
│   Token cost: ~4,200 tokens              │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────┐
│ LLM 推理             │
│ → tool_call:         │
│   calculator.multiply│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ calculator server   │────▶│ result: "7006652"   │
│ multiply(1234, 5678)│     └──────────┬──────────┘
└─────────────────────┘                │
                                       ▼
┌──────────────────────────────────────────┐
│ API Request #2                           │
│   tools: [61 tool schemas, ~4,000 tokens]│  ← 又一次!
│   messages: [..., {role:"tool", ...}]    │
│                                          │
│   Token cost: ~4,500 tokens              │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────┐
│ LLM 推理             │
│ → assistant:         │
│   "The result is     │
│    7,006,652"        │
└─────────────────────┘

Total for 2 API calls: ~8,700 tokens (其中 ~8,000 是重复的工具定义)
```

### 有 mcp-adapter（Adapter 模式）

只在首次使用某 server 时需要 `search`，后续调用只需 `mcp(tool=..., args=...)`：

```
┌─────────────────────────────────────────────────────────────────┐
│                  ADAPTER MODE (with mcp-adapter)                 │
└─────────────────────────────────────────────────────────────────┘

User: "Calculate 1234 * 5678"
        │
        ▼
┌──────────────────────────────────────────┐
│ API Request #1                           │
│   tools: [mcp proxy, ~250 tokens]        │  ← 只有 1 个工具定义!
│   messages: [{role:"user", content:...}] │
│                                          │
│   Token cost: ~450 tokens                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────┐
│ LLM 推理             │
│ → tool_call:         │
│   mcp({             │
│     search:"calc"    │  ← 先搜索可用工具
│   })                 │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌──────────────────────────┐
│ mcp-adapter 本地     │────▶│ result: "calculator      │
│ 搜索 calculator 工具 │     │ tools: add, subtract,    │
│ (不消耗 LLM token)   │     │ multiply, divide, ..."   │
└─────────────────────┘     └──────────┬───────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────┐
│ API Request #2                           │
│   tools: [mcp proxy, ~250 tokens]        │  ← 仍然是 1 个!
│   messages: [..., {role:"tool", ...}]    │
│                                          │
│   Token cost: ~500 tokens                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────┐
│ LLM 推理             │
│ → tool_call:         │
│   mcp({             │
│     tool:"multiply", │  ← 已知工具后直接调用
│     args:{a:1234,    │
│            b:5678}   │
│   })                 │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│ mcp-adapter 路由到   │────▶│ calculator server   │
│ calculator server    │     │ multiply(1234,5678) │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                                       ▼
                              ┌─────────────────────┐
                              │ result: "7006652"   │
                              └──────────┬──────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────┐
│ API Request #3                           │
│   tools: [mcp proxy, ~250 tokens]        │
│   Token cost: ~500 tokens                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌─────────────────────┐
│ LLM 推理             │
│ → assistant:         │
│   "7,006,652"        │
└─────────────────────┘

Total for 3 API calls: ~1,450 tokens (其中 ~750 是工具定义)
```

---

## 成本对比：单次对话

以 "计算 (1234 × 5678) + 9000" 这个任务为例：

| 指标 | Direct | Adapter | 节省 |
|------|--------|---------|------|
| 每次请求的工具定义 | ~4,000 tokens | ~250 tokens | 94% |
| 总 API 请求次数 | 2 次 | 3 次 (多 1 次 search) | — |
| 工具定义总消耗 | ~8,000 tokens | ~750 tokens | 91% |
| 总对话 token 消耗 | ~8,700 tokens | ~1,450 tokens | 83% |

**结论**：虽然 adapter 多了一次 search 往返（~50 tokens），但工具定义的开销从 ~8,000 降到了 ~750。单次对话节省 83%。

---

## 成本对比：跨多 server 的长时间对话

模拟一个使用 4 个不同 server 的 18 轮对话：

```
场景: calculator(2 tools) → unit-converter(1 tool) → text-analyzer(1 tool) → kv-store(1 tool)
```

| 计数组件 | Direct | Adapter | Delta |
|---------|--------|---------|-------|
| 工具定义 × N 次请求 | ~12,000 | ~1,500 | -87% |
| System prompt | ~800 | ~800 | 0% |
| 用户消息 (5) | ~200 | ~200 | 0% |
| Assistant 文本 (5) | ~400 | ~400 | 0% |
| tool_calls | ~120 | ~340 | +~220 |
| Tool results | ~600 | ~600 | 0% |
| **总计** | **~14,120** | **~3,840** | **-73%** |

搜索开销 (~220 tokens) 在长时间对话中几乎可以忽略。

---

## 关键数字

| 指标 | 数值 |
|------|------|
| Proxy 工具定义 | ~250 tokens |
| 61 个工具的直接暴露 | ~3,963 tokens |
| 单 server 工具定义节省率 | 26%~72%（server 工具越多越省） |
| 10 server 综合节省率 | 94% |
| 真实对话综合节省率 | 73% |
| 搜索开销 / server 发现 | ~40 tokens |
| 盈亏平衡点 | 使用 ≥2 个 server 的工具后 adapter 必赢 |

---

## 为什么搜索开销不重要

有人会问：adapter 不是多了 `search` 步骤吗？

每发现一个新 server，adapter 多消耗 ~40 tokens（search 调用 + 结果）。但 direct 模式每次 API 请求多消耗 ~4,000 tokens（全部工具定义）。

```
Direct:    N次请求 × 4,000 = 4,000N
Adapter:   M次发现 × 40 + N次请求 × 250 = 40M + 250N

当 N≥2 时: 4,000N > 40M + 250N  (因为 M ≤ N)
→ 4,000 > 250 + 40(M/N)
→ 只要使用工具，adapter 几乎总是更省
```

第一次 tool call 之后，adapter 永远赢。
