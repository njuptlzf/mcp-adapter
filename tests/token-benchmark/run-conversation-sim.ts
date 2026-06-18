import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countTokens, toOpenAIFormat } from "./token-counter.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Load tools from the 4 servers used in the conversation scenario ──

const SCENARIO_SERVERS = ["calculator", "unit-converter", "text-analyzer", "kv-store"];
const SERVER_DIRS = ["01-calculator", "04-unit-converter", "10-text-analyzer", "09-kv-store"];

function loadServerTools(serverDir: string): any[] {
  const specPath = join(__dirname, "..", "demo-servers", serverDir, "server-spec.json");
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  return spec.tools.map(toOpenAIFormat);
}

const allDirectTools: any[] = [];
for (const dir of SERVER_DIRS) {
  allDirectTools.push(...loadServerTools(dir));
}

// ── Adapter proxy tool ──

const ADAPTER_TOOL = [{
  type: "function",
  function: {
    name: "mcp",
    description:
      "Proxy tool for MCP server operations. Use search to discover tools on an MCP server, " +
      "describe to get parameter details, and call to invoke a specific tool. " +
      "Available servers: calculator, unit-converter, text-analyzer, kv-store.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search for available tools on an MCP server" },
        describe: { type: "string", description: "Get parameter details for a specific tool" },
        tool: { type: "string", description: "The full tool name (server.tool) to call" },
        args: { type: "string", description: "JSON-encoded arguments for the tool call" },
      },
    },
  },
}];

// ── System prompt ──

const SYSTEM_PROMPT =
  "You are a helpful coding assistant. You have access to tools that can perform calculations, " +
  "convert units, analyze text, and store key-value data. Use the appropriate tool when the user " +
  "asks for operations that match tool capabilities. Always verify tool results before responding. " +
  "When using tools, read the tool descriptions carefully and provide the correct arguments. " +
  "You should be concise in your responses and show your work when doing calculations.";

// ── Message types ──

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

// ── Simulation engine: count tokens at API call boundaries ──
//
// A conversation is a sequence of messages. An "API call" happens whenever we
// need the model to generate the next response — i.e., after a user message or
// after tool results are fed back. The cost of an API call = tokens(messages up
// to that point + tools array). Each call must carry the FULL tools array.

function simulateAtApiCalls(
  messages: Message[],
  tools: any[]
): { callTokens: number[]; totalTokens: number; callCount: number } {
  const callTokens: number[] = [];
  const accumulated: Message[] = [];

  // The first message is always the system prompt
  // We identify API call boundaries by looking for user messages
  // and tool result messages (which trigger the next model invocation)

  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    accumulated.push(msg);

    // An API call happens when the NEXT message would be an assistant response
    // This is after: a user message, or after tool result(s)
    const isApiCallBoundary =
      msg.role === "user" ||
      (msg.role === "tool" &&
        (i + 1 >= messages.length || messages[i + 1].role === "assistant"));

    if (isApiCallBoundary) {
      // If the next message is an assistant response (tool_call or text),
      // then this is where an API call happened to generate it.
      // But we need to look ahead: if the current message is user/tool,
      // and the next message is assistant, then an API call was made here.

      if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
        const request = JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...accumulated],
          tools,
        });
        callTokens.push(countTokens(request));
      }
      // Edge case: last message is user (no assistant response yet)
      // Don't count — the conversation ended
    }

    i++;
  }

  return {
    callTokens,
    totalTokens: callTokens.reduce((s, t) => s + t, 0),
    callCount: callTokens.length,
  };
}

// ── Direct mode conversation (18 turns, 9 API calls) ──

const DIRECT_MESSAGES: Message[] = [
  { role: "user", content: "Calculate (1234 * 5678) + 9000" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c1", type: "function", function: { name: "multiply", arguments: '{"a":1234,"b":5678}' } }],
  },
  { role: "tool", content: "7006652", tool_call_id: "c1" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c2", type: "function", function: { name: "add", arguments: '{"a":7006652,"b":9000}' } }],
  },
  { role: "tool", content: "7015652", tool_call_id: "c2" },
  { role: "assistant", content: "The result is 7,015,652." },

  { role: "user", content: "Convert 7015652 cm to km" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c3", type: "function", function: { name: "length", arguments: '{"value":7015652,"from":"cm","to":"km"}' } }],
  },
  { role: "tool", content: "70.15652", tool_call_id: "c3" },
  { role: "assistant", content: "That's about 70.16 km." },

  { role: "user", content: "What's the sentiment of 'I love this product'?" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c4", type: "function", function: { name: "sentiment", arguments: '{"text":"I love this product"}' } }],
  },
  { role: "tool", content: '{"sentiment":"positive","confidence":0.95}', tool_call_id: "c4" },
  { role: "assistant", content: "The sentiment is positive." },

  { role: "user", content: "Save result '7015652' to KV as 'last_calc'" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c5", type: "function", function: { name: "set", arguments: '{"key":"last_calc","value":"7015652"}' } }],
  },
  { role: "tool", content: "OK", tool_call_id: "c5" },
  { role: "assistant", content: "Saved." },
];

// ── Adapter mode conversation (26 turns, 13 API calls) ──
// Each new server requires a search→result round-trip before tool use

const ADAPTER_MESSAGES: Message[] = [
  // ── calculator ──
  { role: "user", content: "Calculate (1234 * 5678) + 9000" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "s1", type: "function", function: { name: "mcp", arguments: '{"search":"calculator"}' } }],
  },
  { role: "tool", content: "add,subtract,multiply,divide,power,sqrt (6 tools)", tool_call_id: "s1" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c1", type: "function", function: { name: "mcp", arguments: '{"tool":"multiply","args":"{\\"a\\":1234,\\"b\\":5678}"}' } }],
  },
  { role: "tool", content: "7006652", tool_call_id: "c1" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c2", type: "function", function: { name: "mcp", arguments: '{"tool":"add","args":"{\\"a\\":7006652,\\"b\\":9000}"}' } }],
  },
  { role: "tool", content: "7015652", tool_call_id: "c2" },
  { role: "assistant", content: "The result is 7,015,652." },

  // ── unit-converter ──
  { role: "user", content: "Convert 7015652 cm to km" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "s2", type: "function", function: { name: "mcp", arguments: '{"search":"unit-converter"}' } }],
  },
  { role: "tool", content: "length,weight,temperature,speed,area,volume,pressure,energy (8 tools)", tool_call_id: "s2" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c3", type: "function", function: { name: "mcp", arguments: '{"tool":"length","args":"{\\"value\\":7015652,\\"from\\":\\"cm\\",\\"to\\":\\"km\\"}"}' } }],
  },
  { role: "tool", content: "70.15652", tool_call_id: "c3" },
  { role: "assistant", content: "That's about 70.16 km." },

  // ── text-analyzer ──
  { role: "user", content: "What's the sentiment of 'I love this product'?" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "s3", type: "function", function: { name: "mcp", arguments: '{"search":"text-analyzer"}' } }],
  },
  { role: "tool", content: "sentiment,keywords,summary,language_detect,readability,pos_tag,ner (7 tools)", tool_call_id: "s3" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c4", type: "function", function: { name: "mcp", arguments: '{"tool":"sentiment","args":"{\\"text\\":\\"I love this product\\"}"}' } }],
  },
  { role: "tool", content: '{"sentiment":"positive","confidence":0.95}', tool_call_id: "c4" },
  { role: "assistant", content: "The sentiment is positive." },

  // ── kv-store ──
  { role: "user", content: "Save result '7015652' to KV as 'last_calc'" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "s4", type: "function", function: { name: "mcp", arguments: '{"search":"kv-store"}' } }],
  },
  { role: "tool", content: "set,get,delete,list_keys,exists,clear (6 tools)", tool_call_id: "s4" },
  {
    role: "assistant", content: null,
    tool_calls: [{ id: "c5", type: "function", function: { name: "mcp", arguments: '{"tool":"set","args":"{\\"key\\":\\"last_calc\\",\\"value\\":\\"7015652\\"}"}' } }],
  },
  { role: "tool", content: "OK", tool_call_id: "c5" },
  { role: "assistant", content: "Saved." },
];

// ── Run ──

const directResult = simulateAtApiCalls(DIRECT_MESSAGES, allDirectTools);
const adapterResult = simulateAtApiCalls(ADAPTER_MESSAGES, ADAPTER_TOOL);

const directToolDefTokens = countTokens(JSON.stringify({ tools: allDirectTools }));
const adapterToolDefTokens = countTokens(JSON.stringify({ tools: ADAPTER_TOOL }));
const toolDefSavingsPct = Math.round((1 - adapterToolDefTokens / directToolDefTokens) * 100);
const totalSavingsPct = Math.round((1 - adapterResult.totalTokens / directResult.totalTokens) * 100);

console.log("╔══════════════════════════════════════════════════════════════════════╗");
console.log("║     Real-World Conversation Token Cost Simulation                   ║");
console.log("╠══════════════════════════════════════════════════════════════════════╣");
console.log(`║  Component                  │ Direct      │ Adapter     │ Delta     ║`);
console.log(`╠══════════════════════════════════════════════════════════════════════╣`);
console.log(`║  Tool defs (single req)     │ ${String(directToolDefTokens).padStart(10)} │ ${String(adapterToolDefTokens).padStart(10)} │ -${String(toolDefSavingsPct).padStart(2)}%      ║`);
console.log(`║  API calls                  │ ${String(directResult.callCount).padStart(10)} │ ${String(adapterResult.callCount).padStart(10)} │ +${String(adapterResult.callCount - directResult.callCount).padStart(2)}       ║`);
console.log(`║  Tool defs × API calls      │ ${String(directToolDefTokens * directResult.callCount).padStart(10)} │ ${String(adapterToolDefTokens * adapterResult.callCount).padStart(10)} │ -${String(Math.round((1 - (adapterToolDefTokens * adapterResult.callCount) / (directToolDefTokens * directResult.callCount)) * 100)).padStart(2)}%      ║`);
console.log(`╠══════════════════════════════════════════════════════════════════════╣`);
console.log(`║  TOTAL (cumulative)         │ ${String(directResult.totalTokens).padStart(10)} │ ${String(adapterResult.totalTokens).padStart(10)} │ -${String(totalSavingsPct).padStart(2)}%     ║`);
console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
console.log();

// Per-call breakdown
console.log("── Per-API-call token breakdown ──");
console.log(`Direct  (${directResult.callCount} calls): ${directResult.callTokens.map(t => String(t)).join(" → ")}`);
console.log(`Adapter (${adapterResult.callCount} calls): ${adapterResult.callTokens.map(t => String(t)).join(" → ")}`);
console.log();

// ── Pass criteria ──

const passSavings = totalSavingsPct >= 65;
const passSearchOverhead = adapterToolDefTokens <= 300;

console.log("── Pass Criteria ──");
console.log(`  4-server conversation savings ≥ 65%: ${totalSavingsPct}% → ${passSavings ? "✅ PASS" : "❌ FAIL"}`);
console.log(`  Search overhead (proxy tool tokens) ≤ 300: ${adapterToolDefTokens} → ${passSearchOverhead ? "✅ PASS" : "❌ FAIL"}`);

// ── Write results ──

const results = {
  scenario: "18-turn / 26-turn conversation with 4 MCP servers",
  servers: SCENARIO_SERVERS,
  direct: {
    totalTokens: directResult.totalTokens,
    callCount: directResult.callCount,
    callTokens: directResult.callTokens,
    toolDefTokens: directToolDefTokens,
  },
  adapter: {
    totalTokens: adapterResult.totalTokens,
    callCount: adapterResult.callCount,
    callTokens: adapterResult.callTokens,
    toolDefTokens: adapterToolDefTokens,
    searchTurns: adapterResult.callCount - directResult.callCount,
  },
  savings: {
    totalPercent: totalSavingsPct,
    toolDefPercent: toolDefSavingsPct,
  },
  passCriteria: {
    conversationSavingsGe65: passSavings,
    searchOverheadLe300: passSearchOverhead,
  },
};

writeFileSync(
  join(__dirname, "conversation-sim-results.json"),
  JSON.stringify(results, null, 2)
);

console.log(`\nResults → tests/token-benchmark/conversation-sim-results.json`);
