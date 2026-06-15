import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const SERVER_PATH = "tests/demo-servers/01-calculator/server.ts";

const EXPECTED_TOOLS = [
  "add",
  "subtract",
  "multiply",
  "divide",
  "power",
  "sqrt",
] as const;

interface ToolResult {
  text: string;
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return { text };
}

describe("[smoke] 01-calculator E2E", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    client = new Client({ name: "smoke-test-client", version: "1.0.0" });
    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", SERVER_PATH],
      stderr: "pipe",
    });
    await client.connect(transport);
  });

  afterEach(async () => {
    await transport.close();
  });

  it("discovers all 6 tools", async () => {
    const { tools } = await client.listTools();
    const names = tools!.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("add: 2 + 3 = 5", async () => {
    const { text } = await callTool(client, "add", { a: 2, b: 3 });
    expect(text).toBe("5");
  });

  it("subtract: 10 - 4 = 6", async () => {
    const { text } = await callTool(client, "subtract", { a: 10, b: 4 });
    expect(text).toBe("6");
  });

  it("multiply: 6 * 7 = 42", async () => {
    const { text } = await callTool(client, "multiply", { a: 6, b: 7 });
    expect(text).toBe("42");
  });

  it("divide: 20 / 4 = 5", async () => {
    const { text } = await callTool(client, "divide", { a: 20, b: 4 });
    expect(text).toBe("5");
  });

  it("divide by zero returns error message", async () => {
    const { text } = await callTool(client, "divide", { a: 10, b: 0 });
    expect(text).toBe("Error: Division by zero");
  });

  it("power: 2 ^ 8 = 256", async () => {
    const { text } = await callTool(client, "power", { base: 2, exponent: 8 });
    expect(text).toBe("256");
  });

  it("sqrt: sqrt(144) = 12", async () => {
    const { text } = await callTool(client, "sqrt", { value: 144 });
    expect(text).toBe("12");
  });

  it("sqrt of negative returns error message", async () => {
    const { text } = await callTool(client, "sqrt", { value: -1 });
    expect(text).toBe("Error: Cannot compute square root of negative number");
  });
});
