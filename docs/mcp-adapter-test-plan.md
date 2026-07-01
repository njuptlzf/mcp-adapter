# mcp-adapter Test Plan

> Repository: https://github.com/njuptlzf/mcp-adapter  
> System Under Test: General adaptation capability of mcp-adapter  
> Executing Agent: Any agent (kilo, qodercli, Claude Code, etc.)
> **Canonical Runbook**: `skills/mcp-adapter/SKILL.md` (Phase 3: Verify) — use `/mcp-adapter` to execute

---

## 1. Overall Test Strategy

### Three Testing Dimensions

```
Dimension A: Adaptability Testing               Dimension B: Token Efficiency Testing       Dimension C: Real-World Cost Simulation
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
MockAgent implements AgentAPI                   Group A: Directly expose all MCP tools     Simulate 18-turn conversation with
↓                                                ↓                                           system prompt + messages + tools
Mount mcp-adapter                                Static calculation of tool definitions     ↓
↓                                                ↓                                           Count full API payload tokens for
Verify that all 10 demo servers can              Group B: mcp-adapter proxy tool             both direct and adapter modes
search / call / describe                         Static calculation of proxy tool token     ↓
                                                 Calculate savings = (A - B) / A            Calculate real-world savings %
```

### Why This Design

The core value of mcp-adapter is: **compress N MCP tool definitions into a single ~200 token proxy tool**. Token savings come from "tool definitions no longer fully appear in the system prompt".

Measurement method: No need to actually call an LLM, just simulate tool definitions in OpenAI/Anthropic format and count statically with `tiktoken`. **MockAgent does the heavy lifting for verification; Section 6 E2E uses whatever real agent is executing this plan.**

**Section 5B** adds a critical dimension: static tool definition counting (Section 5.1~5.5) only tells part of the story. In a real conversation, system prompts, user messages, and search overhead dilute the savings. Section 5B simulates a complete multi-turn conversation to give a realistic picture of actual token cost reduction.

---

## 2. Test Environment Setup

### 2.1 Directory Structure

```
tests/
├── fixtures/
│   └── mock-agent.ts          # Full AgentAPI implementation of MockAgent
├── demo-servers/
│   ├── 01-calculator/         # Arithmetic (6 tools)
│   ├── 02-string-utils/       # String manipulation (7 tools)
│   ├── 03-datetime/           # Date/time (5 tools)
│   ├── 04-unit-converter/     # Unit conversion (8 tools)
│   ├── 05-json-tools/         # JSON operations (5 tools)
│   ├── 06-markdown/           # Markdown rendering (5 tools)
│   ├── 07-file-stats/         # File statistics (6 tools)
│   ├── 08-http-mock/          # Mock HTTP requests (6 tools)
│   ├── 09-kv-store/           # In-memory KV store (6 tools)
│   └── 10-text-analyzer/      # Text analysis (7 tools)
├── compatibility/
│   └── non-pi-agent.test.ts   # Adaptability test suite (Vitest)
├── token-benchmark/
│   ├── run-baseline.ts        # Baseline: directly expose all tools
│   ├── run-adapter.ts         # Comparison: mcp-adapter proxy tool
│   ├── run-conversation-sim.ts # Section 5B: full conversation cost sim
│   ├── token-counter.ts       # tiktoken wrapper
│   └── report.ts              # Generate Markdown report
├── reports/                   # Generated output artifacts
│   ├── compatibility-report.md
│   ├── benchmark-report.md
│   ├── smoke-report.md
│   ├── direct-tools-report.md
│   ├── multi-turn-report.md
│   └── e2e-summary.md
└── agent-scenarios/
    ├── AGENTS.md              # Agent-readable scenario config
    ├── .mcp.json              # mcp-adapter server config reference template
    └── e2e-runner.ts          # Programmatic CI runner (MockAgent stages only)
```

### 2.2 MockAgent Implementation

```typescript
// tests/fixtures/mock-agent.ts
import type { AgentAPI, AgentContext, ToolRegistration, ToolInfo, CommandConfig, FlagConfig } from "../../interfaces/agent-api";

export class MockAgent implements AgentAPI {
  readonly tools = new Map<string, ToolRegistration>();
  readonly commands = new Map<string, CommandConfig>();
  readonly flags = new Map<string, string>();
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  readonly messages: unknown[] = [];

  registerTool(tool: ToolRegistration) { this.tools.set(tool.name, tool); }
  registerCommand(name: string, cfg: CommandConfig) { this.commands.set(name, cfg); }
  registerFlag(name: string, _cfg: FlagConfig) { this.flags.set(name, ""); }
  on(event: string, handler: (...args: unknown[]) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach(h => h(...args));
  }
  getAllTools(): ToolInfo[] { return [...this.tools.values()] as unknown as ToolInfo[]; }
  getFlag(name: string) { return this.flags.get(name); }
  sendMessage(message: unknown) { this.messages.push(message); }
  async exec(command: string, args: string[]) { return { command, args }; }
}

export function makeContext(overrides?: Partial<AgentContext>): AgentContext {
  return { cwd: process.cwd(), hasUI: false, ...overrides };
}
```

---

## 3. Design of the 10 Demo MCP Servers

Each server contains **5–8 tools** to ensure tool definitions have sufficient token volume (~150–300 tokens per tool).

| # | Server Name      | Tools | Example Tools                                          | Estimated Direct Tokens |
|---|------------------|-------|--------------------------------------------------------|--------------------------|
| 01 | calculator       | 6     | add, subtract, multiply, divide, power, sqrt          | ~900                     |
| 02 | string-utils     | 7     | upper, lower, trim, split, replace, reverse, count_chars | ~1050                 |
| 03 | datetime         | 5     | now, format, parse, diff, add_days                    | ~750                     |
| 04 | unit-converter   | 8     | length, weight, temperature, speed, area, volume, pressure, energy | ~1200         |
| 05 | json-tools       | 5     | parse, stringify, get_path, merge, validate_schema    | ~750                     |
| 06 | markdown         | 5     | to_html, to_text, get_headings, get_links, word_count | ~750                     |
| 07 | file-stats       | 6     | line_count, word_count, char_count, find_pattern, head, tail | ~900               |
| 08 | http-mock        | 6     | get, post, put, delete, check_status, parse_headers   | ~900                     |
| 09 | kv-store         | 6     | set, get, delete, list_keys, exists, clear            | ~900                     |
| 10 | text-analyzer    | 7     | sentiment, keywords, summary, language_detect, readability, pos_tag, ner | ~1050       |

**Total: 61 tools, direct exposure ~9,150 tokens (tool definitions only)**

Each server also provides:
- `server.ts` — stdio transport implementation (using `@modelcontextprotocol/sdk`)
- `server-spec.json` — static tool schema snapshot (for baseline token counting)

Example implementation (calculator):

```typescript
// demo-servers/01-calculator/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "calculator", version: "1.0.0" });

server.tool("add", "Add two numbers together", {
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
}, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));
// ... remaining 5 tools

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 4. Adaptability Testing (Dimension A)

**File**: `tests/compatibility/non-pi-agent.test.ts`  
**Framework**: Vitest  
**Goal**: Use MockAgent (non-Pi) to mount mcp-adapter and verify that all 10 servers' core operations succeed.

### 4.1 Test Case Matrix

Each server runs the following 4 generic tests:

```typescript
describe.each(DEMO_SERVERS)("[$id] $name adapter compatibility", ({ name, command }) => {
  let agent: MockAgent;
  let mcpTool: ToolRegistration;

  beforeAll(async () => {
    agent = new MockAgent();
    await activateMcpAdapter(agent, makeContext(), {
      mcpServers: { [name]: { command, args: [] } }
    });
    mcpTool = agent.tools.get("mcp")!;
    expect(mcpTool, "mcp proxy tool should be registered").toBeDefined();
  });

  test("TC-A1: mcp proxy tool registered successfully & definition is concise", () => {
    expect(mcpTool.name).toBe("mcp");
    const defTokens = estimateTokens(JSON.stringify(mcpTool));
    expect(defTokens).toBeLessThan(400); // ~200 tokens, allow some overhead
  });

  test("TC-A2: search can discover tools of that server", async () => {
    const result = await mcpTool.handler({ search: name });
    expect(result).toMatch(new RegExp(name));
  });

  test("TC-A3: describe returns tool details", async () => {
    const searchResult = await mcpTool.handler({ search: name });
    const firstTool = extractFirstToolName(searchResult);
    const descResult = await mcpTool.handler({ describe: firstTool });
    expect(descResult).toContain("Parameters");
  });

  test("TC-A4: call executes the tool successfully", async () => {
    const { toolName, args } = DEMO_SERVERS_SMOKE_CALLS[name];
    const result = await mcpTool.handler({ tool: toolName, args: JSON.stringify(args) });
    expect(result).toBeDefined();
    expect(result).not.toMatch(/error/i);
  });
});
```

**Pass criteria**: 10 servers × 4 TCs = 40 test cases all green.

### 4.2 Additional Contract Tests

```typescript
describe("Non-Pi AgentAPI contract", () => {
  test("TC-A5: registerTool called only once (single proxy tool)", () => {
    expect(agent.tools.size).toBe(1);
    expect(agent.tools.has("mcp")).toBe(true);
  });

  test("TC-A6: custom AgentPathResolver does not throw", async () => {
    const customResolver: AgentPathResolver = {
      id: "mock" as AgentId,
      globalConfigPath: () => "/tmp/mock-mcp-test.json",
      projectConfigPath: () => ".mcp.json",
      agentDir: () => "/tmp/mock-agent",
      cachePath: () => "/tmp/mock-agent/mcp-cache.json",
      authDir: () => "/tmp/mock-agent/mcp-oauth",
    };
    await expect(activateMcpAdapter(new MockAgent(), makeContext(), {}, customResolver))
      .resolves.not.toThrow();
  });

  test("TC-A7: hasUI=false does not call UISystem methods", () => {
    const uiCalls: string[] = [];
    makeContext({
      hasUI: false,
      ui: {
        notify: () => uiCalls.push("notify"),
        setStatus: () => uiCalls.push("setStatus"),
      }
    });
    expect(uiCalls).toHaveLength(0);
  });

  test("TC-A8: directTools mode directly registers multiple tools", async () => {
    const agentWithDirect = new MockAgent();
    await activateMcpAdapter(agentWithDirect, makeContext(), {
      mcpServers: {
        calculator: { command: DEMO_SERVERS[0].command, args: [], directTools: true }
      }
    });
    expect(agentWithDirect.tools.size).toBeGreaterThan(1);
  });
});
```

---

## 5. Token Efficiency Testing (Dimension B)

### 5.1 Measurement Method

Use `tiktoken` (cl100k_base) to statically count **OpenAI function calling format tool definitions**, simulating the payload actually sent to the LLM:

```typescript
// tests/token-benchmark/token-counter.ts
import { encoding_for_model } from "tiktoken";
const enc = encoding_for_model("gpt-4o"); // cl100k_base

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function countToolDefinitions(tools: ToolDefinition[]): number {
  const payload = {
    tools: tools.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))
  };
  return countTokens(JSON.stringify(payload));
}
```

> **Note**: tiktoken (cl100k_base) has ±5-10% error relative to the Claude tokenizer. For absolute measurements, also output **raw JSON byte size** as a fallback metric (bytes are objective and can be independently verified).

### 5.2 Comparison Groups

| Group       | Description                                 | Measurement                                                                 |
|-------------|---------------------------------------------|------------------------------------------------------------------------------|
| **Baseline**| Directly expose all MCP tools               | Read all tool schemas from each server's `server-spec.json`, serialize into OpenAI format, sum token counts |
| **Adapter** | Only the mcp-adapter proxy tool             | Token count of a single `mcp` proxy tool definition (constant regardless of how many servers are mounted) |

### 5.3 Baseline Measurement Script

```typescript
// tests/token-benchmark/run-baseline.ts
const servers = readdirSync("tests/demo-servers").sort();
const results: Record<string, { tools: number; tokens: number; bytes: number }> = {};

for (const dir of servers) {
  const spec = JSON.parse(readFileSync(`tests/demo-servers/${dir}/server-spec.json`, "utf8"));
  const serialized = JSON.stringify({ tools: spec.tools.map(toOpenAIFormat) });
  results[spec.name] = {
    tools: spec.tools.length,
    tokens: countTokens(serialized),
    bytes: Buffer.byteLength(serialized),
  };
}

const total = { tokens: sum(r => r.tokens), bytes: sum(r => r.bytes) };
console.log(`Total (10 servers): ${total.tokens} tokens / ${total.bytes} bytes`);
writeFileSync("tests/token-benchmark/baseline-results.json", JSON.stringify(results, null, 2));
```

### 5.4 Adapter Measurement Script

```typescript
// tests/token-benchmark/run-adapter.ts
const agent = new MockAgent();
await activateMcpAdapter(agent, makeContext(), { mcpServers: ALL_DEMO_SERVERS_CONFIG });

const mcpTool = agent.tools.get("mcp")!;
const serialized = JSON.stringify({
  tools: [{ type: "function", function: {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: mcpTool.parameters
  }}]
});

console.log(`mcp proxy tool: ${countTokens(serialized)} tokens / ${Buffer.byteLength(serialized)} bytes`);
writeFileSync("tests/token-benchmark/adapter-results.json", JSON.stringify({
  tokens: countTokens(serialized),
  bytes: Buffer.byteLength(serialized),
  note: "proxy definition is constant regardless of server count"
}, null, 2));
```

### 5.5 Expected Report Format

```
╔═══════════════════════════════════════════════════════════════════════╗
║            mcp-adapter Token Efficiency Benchmark Report              ║
╠═══════════════════════════════════════════════════════════════════════╣
║  Server              │ Tools │ Direct Tokens │ Direct Bytes │ Saved   ║
╠═══════════════════════════════════════════════════════════════════════╣
║  01-calculator       │   6   │    ~900       │   ~3.6 KB    │  ~78%   ║
║  02-string-utils     │   7   │   ~1050       │   ~4.2 KB    │  ~81%   ║
║  03-datetime         │   5   │    ~750       │   ~3.0 KB    │  ~73%   ║
║  04-unit-converter   │   8   │   ~1200       │   ~4.8 KB    │  ~83%   ║
║  05-json-tools       │   5   │    ~750       │   ~3.0 KB    │  ~73%   ║
║  06-markdown         │   5   │    ~750       │   ~3.0 KB    │  ~73%   ║
║  07-file-stats       │   6   │    ~900       │   ~3.6 KB    │  ~78%   ║
║  08-http-mock        │   6   │    ~900       │   ~3.6 KB    │  ~78%   ║
║  09-kv-store         │   6   │    ~900       │   ~3.6 KB    │  ~78%   ║
║  10-text-analyzer    │   7   │   ~1050       │   ~4.2 KB    │  ~81%   ║
╠═══════════════════════════════════════════════════════════════════════╣
║  TOTAL (all loaded)  │  61   │   ~9150       │  ~36.6 KB    │  ~98%   ║
║  mcp proxy tool      │   1   │    ~200       │   ~0.8 KB    │   —     ║
╚═══════════════════════════════════════════════════════════════════════╝

  • Search overhead per call: ~15 tokens
  • Break-even: after 1st tool call, adapter always wins
  • Note: token counts use tiktoken cl100k_base; bytes are exact
```

### 5.6 Real-World Conversation Cost Simulation (Section 5B)

Section 5.1~5.5 只测量了工具定义的静态 token 数量。真实 LLM 调用中，system prompt、用户消息、tool call 结果、多轮上下文都会消耗 token。本节模拟一个典型 agent 对话，比较 **直接暴露工具** vs **mcp-adapter proxy** 两种模式下的完整 API payload token 成本。

> 此测试不需要真实 API 调用 — 用 tiktoken 对完整 messages payload 做静态计数即可。与 Section 5.1 不同之处在于：计数范围从"仅工具定义"扩展到"完整 API request body"。

#### 5.6.1 模拟场景

模拟一个 agent 使用 4 个不同 server 的工具完成任务的对话（共 6 轮）：

```
Turn 1 [user]:        "Calculate (1234 * 5678) + 9000"
Turn 2 [assistant]:   tool_call: calculator.multiply(1234, 5678)
Turn 3 [tool_result]:  "7006652"
Turn 4 [assistant]:   tool_call: calculator.add(7006652, 9000)
Turn 5 [tool_result]:  "7015652"
Turn 6 [assistant]:   "The result is 7,015,652"

... later in same session ...

Turn 7  [user]:        "Convert 7015652 cm to km"
Turn 8  [assistant]:   tool_call: unit-converter.length(7015652, cm, km)
Turn 9  [tool_result]:  "70.15652"
Turn 10 [assistant]:   "That's about 70.16 km"

... later ...

Turn 11 [user]:        "What's the sentiment of 'I love this product'?"
Turn 12 [assistant]:   tool_call: text-analyzer.sentiment("I love this product")
Turn 13 [tool_result]:  '{"sentiment":"positive",...}'
Turn 14 [assistant]:   "The sentiment is positive."

... later ...

Turn 15 [user]:        "Save result '7015652' to KV as 'last_calc'"
Turn 16 [assistant]:   tool_call: kv-store.set("last_calc", "7015652")
Turn 17 [tool_result]:  "OK"
Turn 18 [assistant]:   "Saved."
```

#### 5.6.2 两种模式的 Token 计数方式

| 计数组件 | Direct（直接暴露） | Adapter（mcp-adapter proxy） |
|---------|-------------------|------------------------------|
| System prompt | 固定 ~800 tokens | 固定 ~800 tokens |
| Tool definitions | 4 个 server 的全部工具定义（~2,000 tokens） | 仅 `mcp` proxy 工具定义（~250 tokens） |
| 用户消息 | 每轮 ~10-50 tokens | 每轮 ~10-50 tokens |
| Assistant tool_calls | 直接调用目标工具（每次 ~30 tokens） | 首次调用某 server 需额外 `mcp.search`（~40 tokens），后续直接 `mcp(tool=...)`（~50 tokens） |
| Tool results | 每次 ~20-200 tokens | 每次 ~20-200 tokens（相同） |
| Assistant 文本回复 | 每轮 ~20-100 tokens | 每轮 ~20-100 tokens（相同） |

**关键差异**：
- Direct 模式在每个 API 请求的 `tools` 参数中携带全部工具定义（~2,000 tokens × 每次请求）
- Adapter 模式只携带 `mcp` proxy 定义（~250 tokens），但首次使用某 server 的工具需要一次 `search` 往返

#### 5.6.3 累计 Token 成本对比（模拟 18 轮对话）

```
╔══════════════════════════════════════════════════════════════════════╗
║     Real-World Conversation Token Cost Simulation (18 turns)        ║
╠══════════════════════════════════════════════════════════════════════╣
║  Component                  │ Direct      │ Adapter     │ Delta     ║
╠══════════════════════════════════════════════════════════════════════╣
║  Tool defs × N requests     │ ~12,000     │ ~1,500      │ -87%      ║
║  System prompt              │ ~800        │ ~800        │ 0%        ║
║  User messages (5)          │ ~200        │ ~200        │ 0%        ║
║  Assistant text (5)         │ ~400        │ ~400        │ 0%        ║
║  tool_calls (direct)        │ ~120        │ —           │ —         ║
║  tool_calls (proxy)         │ —           │ ~340        │ +~220     ║
║  Tool results               │ ~600        │ ~600        │ 0%        ║
╠══════════════════════════════════════════════════════════════════════╣
║  TOTAL                      │ ~14,120     │ ~3,840      │ -73%      ║
╚══════════════════════════════════════════════════════════════════════╝

  • Tool defs saved: 87% (same as Section 5 static measurement)
  • Total conversation saved: 73% (lower because system prompt & messages are fixed cost)
  • Search overhead: ~200 tokens total across 4 server discoveries
  • Break-even: adapter wins after using tools from ≥2 servers
  • Worst case (1 server, 1 tool call): adapter ~550 vs direct ~2,350 (still saves 77%)
```

#### 5.6.4 实现脚本

```typescript
// tests/token-benchmark/run-conversation-sim.ts
import { encoding_for_model } from "tiktoken";
const enc = encoding_for_model("gpt-4o");

// Simulated system prompt (representative ~800 token prompt)
const SYSTEM_PROMPT = "You are a helpful coding assistant with access to tools...";

// Tool definitions for the 4 servers used in this scenario
const DIRECT_TOOLS = [
  ...loadServerTools("calculator"),     // 6 tools
  ...loadServerTools("unit-converter"), // 8 tools
  ...loadServerTools("text-analyzer"),  // 7 tools
  ...loadServerTools("kv-store"),       // 6 tools
]; // 27 tools total

const ADAPTER_TOOL = [{ /* mcp proxy tool definition, ~250 tokens */ }];

interface Turn {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { name: string; args: Record<string, unknown> }[];
  tool_call_id?: string;
}

function simulateConversation(turns: Turn[], tools: any[]): number {
  let totalTokens = 0;
  for (const turn of turns) {
    const request = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // ... prior turns within context window
        { role: turn.role, content: turn.content, tool_calls: turn.tool_calls },
      ],
      tools: tools, // ← key difference: direct has 27 tools, adapter has 1
    };
    totalTokens += enc.encode(JSON.stringify(request)).length;
  }
  return totalTokens;
}

const directTokens = simulateConversation(SCENARIO_TURNS, DIRECT_TOOLS);
const adapterTokens = simulateConversation(SCENARIO_TURNS, ADAPTER_TOOL);

console.log(`Direct:  ${directTokens} tokens`);
console.log(`Adapter: ${adapterTokens} tokens`);
console.log(`Savings: ${((1 - adapterTokens / directTokens) * 100).toFixed(0)}%`);
```

#### 5.6.5 Pass Criteria

| 指标 | 目标 |
|------|------|
| 4-server conversation total savings | ≥ 65% |
| 1-server conversation total savings | ≥ 40% |
| Search overhead (4 server discoveries) | ≤ 300 tokens |
| Break-even point | ≤ 使用 2 个 server 的工具后 |

---

## 6. End-to-End Validation with Real Agent

Section 4 和 Section 5 通过 MockAgent + tiktoken 完整验证了接口契约和 token 效率。Section 5B 进一步在模拟真实对话中比较了完整 API payload 的 token 成本。Section 6 由执行本测试计划的 **真实 agent** 完成 E2E 验证，目的是覆盖 MockAgent 无法验证的内容：真实 LLM 推理路径下的 tool 调度、参数构造、结果解析。

**执行主体**：读取并执行本计划的 agent（Qoder、kilo、Claude Code 或任何支持 MCP tool 的 agent）。

### MCP 配置注入（Agent 职责）

**本项目不预设 `.mcp.json`，由执行测试计划的 agent 负责创建。**

Agent 在执行 Section 6 E2E 之前，**必须**完成以下步骤：

1. 检查项目根目录是否存在 `.mcp.json`
2. 如果**不存在**：按 Section 6.1 的模板创建 `.mcp.json`，写入 10 个 demo server 的配置
3. 对于 Qoder：`.mcp.json` 放于项目根目录，下次会话启动时自动加载
4. 对于当前会话：如果 agent 无法热加载 MCP 配置，使用 Section 6.0 的 Fallback 路径（SDK_DIRECT）执行 E2E

---

### 6.0 前置检查（Capability Gate）

**此步骤必须最先执行，不可跳过。**

Agent 执行以下检查：

1. **Step 0 — 创建 `.mcp.json`**：检查项目根目录是否存在 `.mcp.json`，不存在则按 Section 6.1 模板创建
2. 检查两种路径之一是否可用：
   - **路径 A**: 工具列表中存在 `mcp` proxy tool（由 mcp-adapter 扩展注册）
   - **路径 B**: 工具列表中存在各 demo server 的工具（由 `.mcp.json` 直接注册，如 Qoder 原生 MCP 支持）
3. 如果**两条路径都不可用**：
   - **Fallback**: 通过 MCP SDK (`@modelcontextprotocol/sdk`) 直连各 server 的 stdio transport 执行 E2E 验证。此路径验证了与 `mcp-adapter` 相同的底层协议。
   - 在报告中标注 E2E 执行方式为 `SDK_DIRECT`。
4. 如果**任一可用**：直接使用 agent 的 tool call 能力执行 E2E 场景。

> 设计原意：E2E 验证是可选增强层，不应因 agent 能力不足而污染整体测试结论。MockAgent 测试（Section 4/5）已提供完整的正确性保证。

---

### 6.1 创建 `.mcp.json`（Agent 必须执行）

详见 `skills/mcp-adapter/references/verify.md` Phase 4 Step 0 — 包含完整模板。

> 此文件不是项目预设的。Agent 在执行 E2E 前按 skill 中的模板创建于项目根目录。

---

### 6.2 E2E 场景定义

每个场景由 agent 直接执行 `mcp` tool call，**不通过子进程或外部命令触发**。

#### E2E-03：Smoke Test — 单服务器（calculator）

**目标**：验证 search → describe → call 完整链路。

Agent 依次执行：

```
Step 1: mcp({ search: "calculator" })
  断言：返回结果包含工具名列表

Step 2: mcp({ describe: "add" })
  断言：返回结果包含 "Parameters"

Step 3: mcp({ tool: "add", args: '{"a":3,"b":4}' })
  断言：返回结果包含 "7"，不包含 "error"
```

全部通过则记录 `✅ E2E-03 PASS`，任一失败记录 `❌ E2E-03 FAIL: <step> <actual>`。

---

#### E2E-04：Smoke Test — 全部 10 个服务器

**目标**：批量验证所有服务器的 call 步骤。

Agent 对每个服务器执行一次 tool call，使用下表中的固定参数：

| Server        | Tool        | Args                                      | Expected      |
|---------------|-------------|-------------------------------------------|---------------|
| calculator    | add         | `{"a":3,"b":4}`                           | 包含 "7"      |
| string-utils  | upper       | `{"text":"hello"}`                        | 包含 "HELLO"  |
| datetime      | now         | `{}`                                      | 包含 ISO 日期 |
| unit-converter| length      | `{"value":1,"from":"m","to":"cm"}`        | 包含 "100"    |
| json-tools    | parse       | `{"json":"{\"x\":1}"}`                    | 包含 "x"      |
| markdown      | word_count  | `{"text":"hello world"}`                  | 包含 "2"      |
| file-stats    | line_count  | `{"text":"a\nb\nc"}`                      | 包含 "3"      |
| http-mock     | get         | `{"url":"https://example.com"}`           | 不含 "error"  |
| kv-store      | set         | `{"key":"k","value":"v"}`                 | 不含 "error"  |
| text-analyzer | sentiment   | `{"text":"I love this"}`                  | 包含 "positive"|

每个服务器记录独立 pass/fail，汇总写入 `tests/reports/smoke-report.md`。

---

#### E2E-05：directTools 模式

**目标**：验证 `directTools: true` 时工具直接注册，不经过 proxy。

Agent 执行：

```
Step 1: 确认工具列表中存在 "add"（作为一级 tool，而非 mcp 子命令）
  断言：tool list 包含 "add"

Step 2: 直接调用 add(a=10, b=20)
  断言：返回结果包含 "30"
```

结果写入 `tests/reports/direct-tools-report.md`。

---

#### E2E-06：多轮对话（Optional）

**目标**：验证跨轮次的连接复用，不重复启动 server。

```
Turn 1: 使用 calculator 计算 2^8
  mcp({ tool: "power", args: '{"base":2,"exp":8}' })
  断言：结果包含 "256"

Turn 2: 将 256 cm 转换为 m
  mcp({ tool: "length", args: '{"value":256,"from":"cm","to":"m"}' })
  断言：结果包含 "2.56"

验证：两轮之间未重复启动 server（检查是否出现 "already connected" 或无重复连接日志）
```

此场景标记为 **Optional**，失败不影响整体 pass/fail 判定。结果写入 `tests/reports/multi-turn-report.md`。

---

### 6.3 E2E 场景清单

| Scenario ID | 场景           | 验证点                                    | 阻塞整体结论 |
|-------------|----------------|-------------------------------------------|-------------|
| E2E-03      | Smoke 单服务器 | search/describe/call 三步，add(3,4)=7     | ✅ Yes       |
| E2E-04      | Smoke 全量     | 10 个服务器 call 各通过                   | ✅ Yes       |
| E2E-05      | directTools    | add 直接注册，add(10,20)=30               | ✅ Yes       |
| E2E-06      | 多轮对话       | 两轮链式调用，256→2.56m，无重复连接       | ⚠️ Optional  |

> E2E-01（run compat tests）和 E2E-02（benchmark tokens）已移入 Section 7 执行顺序，由 shell 命令直接触发，不需要 agent mcp tool 能力。

---

### 6.4 结果汇总

Agent 执行完所有场景后，将结果写入 `tests/reports/e2e-summary.md`，格式如下：

```markdown
# E2E Summary — <date>

## Capability Gate
mcp tool available: <YES / NO>

## Results
| Scenario | Result    | Type     | Notes |
|----------|-----------|----------|-------|
| E2E-03   | ✅ PASS   | required |       |
| E2E-04   | ✅ PASS   | required |       |
| E2E-05   | ✅ PASS   | required |       |
| E2E-06   | ⚠️ SKIP   | optional |       |
```

---

## 7. Execution Order

> **Canonical runbook**: `skills/mcp-adapter/references/verify.md` — 包含完整执行命令和 pass criteria。
> 本节仅提供概要。执行测试时请使用 `/mcp-adapter` skill（Phase 3: Verify）。

```bash
# 1. Install dependencies
npm install

# 2. Adaptability tests (MockAgent) — Section 4
npx vitest run tests/compatibility/

# 3. Token benchmark — Section 5
npx tsx tests/token-benchmark/run-baseline.ts
npx tsx tests/token-benchmark/run-adapter.ts
npx tsx tests/token-benchmark/report.ts

# 3b. Conversation cost simulation — Section 5B
npx tsx tests/token-benchmark/run-conversation-sim.ts

# 4. E2E — Section 6 (see skill for .mcp.json creation + Capability Gate)
npx vitest run tests/smoke/e2e-all-servers.test.ts
```

### GitHub Actions

```yaml
name: mcp-adapter tests
on: [push, pull_request]

jobs:
  compatibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npx vitest run tests/compatibility/
      - uses: actions/upload-artifact@v4
        with: { name: compatibility-report, path: tests/reports/ }

  token-benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npx ts-node tests/token-benchmark/run-baseline.ts
      - run: npx ts-node tests/token-benchmark/run-adapter.ts
      - run: npx ts-node tests/token-benchmark/report.ts
      - uses: actions/upload-artifact@v4
        with: { name: benchmark-report, path: tests/token-benchmark/benchmark-report.md }

  # E2E (Section 6) は CI では agent が本計画を読んで実行する場合のみ有効。
  # headless CI では Section 4/5 の結果のみでゲートとする。
```

---

## 8. Pass Criteria Summary

| Test Category                 | Cases | Pass Criteria                              |
|-------------------------------|-------|--------------------------------------------|
| Basic adaptability (TC-A1~A4) | 40    | All pass                                   |
| AgentAPI contract (TC-A5~A8)  | 4     | All pass                                   |
| Token savings (single server) | 10    | Savings ≥ 70% per server                  |
| Token savings (all loaded)    | 1     | Savings ≥ 95% combined                    |
| Conversation simulation (5B)  | 1     | Total savings ≥ 65%, search overhead ≤ 300 tokens |
| E2E-03~05 (required)          | 3     | All pass — only if agent has `mcp` tool   |
| E2E-06 (optional)             | 1     | Pass preferred, failure non-blocking       |

**Key quantitative metrics**:
- Proxy tool definition tokens: ≤ 300 (README claims ~200, verify by measurement)
- Single-server savings: ≥ 70%
- 10-server combined savings: ≥ 95%
- 4-server real-world conversation savings: ≥ 65% (Section 5B)
- Search overhead per server discovery: ≤ 50 tokens
- Total search overhead (4 discoveries): ≤ 300 tokens (Section 5B)

---

## 9. Risks and Mitigations

| Risk                                                           | Impact | Mitigation                                                                                          |
|----------------------------------------------------------------|--------|------------------------------------------------------------------------------------------------------|
| `activateMcpAdapter` does not yet expose a non-Pi entry point | High   | Directly call `mcpAdapter` and pass MockAgent; switch to exported `McpAdapter` constructor when available |
| Token count differs from actual LLM tokenizer                 | Medium | Use tiktoken cl100k_base as baseline; also output raw JSON byte size as fallback                    |
| Upstream AgentAPI interface changes                           | Low    | Pin mcp-adapter version used for testing; re-validate after upgrade                                |
| Agent does not have `mcp` tool (E2E skipped)                  | Low    | Section 6.0 Capability Gate exits cleanly; Section 4/5 MockAgent tests are sufficient for correctness |
| E2E-06 flaky due to LLM non-determinism                       | Low    | Marked Optional; re-run up to 3 times before declaring failure                                     |

---

## 10. Artifacts

| Artifact                  | Source              | Description                                                         |
|---------------------------|---------------------|----------------------------------------------------------------------|
| `compatibility-report.md` | Section 4 Vitest    | 40 TC-A1~A4 + 4 TC-A5~A8 results                                   |
| `benchmark-report.md`     | Section 5 tiktoken  | Per-server savings, byte comparison, summary table                  |
| `conversation-cost-report.md` | Section 5B tiktoken | Full conversation token cost comparison (direct vs adapter)      |
| `smoke-report.md`         | Section 6 E2E-04    | Per-server call pass/fail for all 10 servers                        |
| `direct-tools-report.md`  | Section 6 E2E-05    | directTools mode registration and call verification                 |
| `multi-turn-report.md`    | Section 6 E2E-06    | Two-turn chain transcript (optional)                                |
| `e2e-summary.md`          | Section 6 agent     | Capability Gate result + consolidated E2E pass/fail table           |
| CI Artifacts              | GitHub Actions      | All reports uploaded automatically for PR review                    |