import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ============================================================
// E2E Test Suite — Section 6: Direct MCP SDK connection
// Validates all 10 demo servers via the same stdio transport
// that mcp-adapter uses internally.
// ============================================================

const SERVER_BASE = "tests/demo-servers";

interface ServerDef {
  name: string;
  dir: string;
}

const ALL_SERVERS: ServerDef[] = [
  { name: "calculator", dir: "01-calculator" },
  { name: "string-utils", dir: "02-string-utils" },
  { name: "datetime", dir: "03-datetime" },
  { name: "unit-converter", dir: "04-unit-converter" },
  { name: "json-tools", dir: "05-json-tools" },
  { name: "markdown", dir: "06-markdown" },
  { name: "file-stats", dir: "07-file-stats" },
  { name: "http-mock", dir: "08-http-mock" },
  { name: "kv-store", dir: "09-kv-store" },
  { name: "text-analyzer", dir: "10-text-analyzer" },
];

// Expected smoke calls per test plan Section 6.2 E2E-04
const SMOKE_CALLS: Record<string, { tool: string; args: Record<string, unknown>; expect: (text: string) => boolean }> = {
  "calculator":    { tool: "add",        args: { a: 3, b: 4 },             expect: (t) => t.includes("7") },
  "string-utils":  { tool: "upper",      args: { text: "hello" },           expect: (t) => t.includes("HELLO") },
  "datetime":      { tool: "now",        args: {},                           expect: (t) => /\d{4}-\d{2}-\d{2}/.test(t) || t.includes("T") },
  "unit-converter":{ tool: "length",     args: { value: 1, from: "m", to: "cm" }, expect: (t) => t.includes("100") },
  "json-tools":    { tool: "parse",      args: { json: '{"x":1}' },         expect: (t) => t.includes("x") },
  "markdown":      { tool: "word_count", args: { text: "hello world" },     expect: (t) => t.includes("2") },
  "file-stats":    { tool: "line_count", args: { text: "a\nb\nc" },         expect: (t) => t.includes("3") },
  "http-mock":     { tool: "get",        args: { url: "https://example.com" }, expect: (t) => !t.toLowerCase().includes("error") },
  "kv-store":      { tool: "set",        args: { key: "k", value: "v" },    expect: (t) => !t.toLowerCase().includes("error") },
  "text-analyzer": { tool: "sentiment",  args: { text: "I love this" },     expect: (t) => t.toLowerCase().includes("positive") },
};

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    return `ERROR: ${JSON.stringify(result.content)}`;
  }
  const texts = (result.content as Array<{ type: string; text?: string }>)
    .filter(c => c.type === "text")
    .map(c => c.text || "")
    .join("\n");
  return texts;
}

// ============================================================
// E2E-03: Smoke Test — Single Server (calculator) search→describe→call
// ============================================================
describe("E2E-03: Smoke — calculator (search→describe→call)", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    client = new Client({ name: "e2e-test", version: "1.0.0" });
    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", `${SERVER_BASE}/01-calculator/server.ts`],
      stderr: "pipe",
    });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await transport.close();
  });

  it("Step 1: search discovers calculator tools", async () => {
    const { tools } = await client.listTools();
    const names = tools!.map(t => t.name);
    expect(names).toContain("add");
    expect(names).toContain("subtract");
    expect(names).toContain("multiply");
    expect(names).toContain("divide");
    expect(names).toContain("power");
    expect(names).toContain("sqrt");
  });

  it("Step 2: describe add returns parameters", async () => {
    const { tools } = await client.listTools();
    const addTool = tools!.find(t => t.name === "add");
    expect(addTool).toBeDefined();
    expect(addTool!.description).toBeTruthy();
    // inputSchema contains the parameters
    expect(addTool!.inputSchema).toBeDefined();
    const props = (addTool!.inputSchema as any)?.properties;
    expect(props).toBeDefined();
    expect(props.a).toBeDefined();
    expect(props.b).toBeDefined();
  });

  it("Step 3: call add(3, 4) = 7", async () => {
    const text = await callTool(client, "add", { a: 3, b: 4 });
    expect(text).toContain("7");
  });
});

// ============================================================
// E2E-04: Smoke Test — All 10 Servers
// ============================================================
describe("E2E-04: Smoke — all 10 servers", () => {
  for (const server of ALL_SERVERS) {
    const smokeCall = SMOKE_CALLS[server.name];
    if (!smokeCall) continue;

    describe(`[${server.name}]`, () => {
      let client: Client;
      let transport: StdioClientTransport;

      beforeAll(async () => {
        client = new Client({ name: "e2e-test", version: "1.0.0" });
        transport = new StdioClientTransport({
          command: "npx",
          args: ["tsx", `${SERVER_BASE}/${server.dir}/server.ts`],
          stderr: "pipe",
        });
        await client.connect(transport);
      }, 15000);

      afterAll(async () => {
        await transport.close();
      });

      it(`discovers tools`, async () => {
        const { tools } = await client.listTools();
        const names = tools!.map(t => t.name);
        expect(names.length).toBeGreaterThanOrEqual(1);
        expect(names).toContain(smokeCall.tool);
      });

      it(`${smokeCall.tool}(${JSON.stringify(smokeCall.args)}) passes`, async () => {
        const text = await callTool(client, smokeCall.tool, smokeCall.args);
        expect(smokeCall.expect(text)).toBe(true);
      }, 10000);
    });
  }
});

// ============================================================
// E2E-06: Multi-Turn (Optional) — calculator power → unit-converter length
// ============================================================
describe("E2E-06: Multi-turn (Optional)", () => {
  let calcClient: Client;
  let calcTransport: StdioClientTransport;
  let convClient: Client;
  let convTransport: StdioClientTransport;

  beforeAll(async () => {
    // Connect to calculator
    calcClient = new Client({ name: "e2e-mt-calc", version: "1.0.0" });
    calcTransport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", `${SERVER_BASE}/01-calculator/server.ts`],
      stderr: "pipe",
    });
    await calcClient.connect(calcTransport);

    // Connect to unit-converter
    convClient = new Client({ name: "e2e-mt-conv", version: "1.0.0" });
    convTransport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", `${SERVER_BASE}/04-unit-converter/server.ts`],
      stderr: "pipe",
    });
    await convClient.connect(convTransport);
  }, 20000);

  afterAll(async () => {
    await calcTransport.close();
    await convTransport.close();
  });

  it("Turn 1: calculator power(2, 8) = 256", async () => {
    const text = await callTool(calcClient, "power", { base: 2, exponent: 8 });
    expect(text).toContain("256");
  });

  it("Turn 2: unit-converter length(256, cm→m) = 2.56", async () => {
    const text = await callTool(convClient, "length", { value: 256, from: "cm", to: "m" });
    expect(text).toContain("2.56");
  });
});
