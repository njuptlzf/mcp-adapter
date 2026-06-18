import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");
const SERVER_PATH = resolve(PROJECT_ROOT, "tests/demo-servers/01-calculator/server.ts");

const SMOKE_CALLS = [
  { tool: "add", args: { a: 2, b: 3 }, expect: "5", label: "add(2,3)=5" },
  { tool: "subtract", args: { a: 10, b: 4 }, expect: "6", label: "subtract(10,4)=6" },
  { tool: "multiply", args: { a: 7, b: 8 }, expect: "56", label: "multiply(7,8)=56" },
  { tool: "divide", args: { a: 20, b: 5 }, expect: "4", label: "divide(20,5)=4" },
  { tool: "divide", args: { a: 1, b: 0 }, expect: "Error: Division by zero", label: "divide(1,0)=error" },
  { tool: "power", args: { base: 2, exponent: 10 }, expect: "1024", label: "power(2,10)=1024" },
  { tool: "sqrt", args: { value: 144 }, expect: "12", label: "sqrt(144)=12" },
  { tool: "sqrt", args: { value: -1 }, expect: "Error: Cannot compute square root of negative number", label: "sqrt(-1)=error" },
];

async function main() {
  const results = [];

  console.log("=== Calculator Smoke Test ===\n");

  // Start server
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", SERVER_PATH],
    stderr: "pipe",
  });

  const client = new Client({ name: "smoke-test", version: "1.0.0" });

  try {
    console.log("Connecting to calculator server...");
    await client.connect(transport);
    console.log("Connected.\n");

    // List tools
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    console.log(`Discovered ${toolNames.length} tools: ${toolNames.join(", ")}\n`);

    const expectedTools = ["add", "subtract", "multiply", "divide", "power", "sqrt"];
    const missingTools = expectedTools.filter(t => !toolNames.includes(t));
    if (missingTools.length > 0) {
      console.error(`FAIL: Missing tools: ${missingTools.join(", ")}`);
      results.push({ label: "tool discovery", pass: false, detail: `Missing: ${missingTools.join(", ")}` });
    } else {
      console.log("PASS: All expected tools discovered\n");
      results.push({ label: "tool discovery", pass: true });
    }

    // Run smoke calls
    for (const tc of SMOKE_CALLS) {
      try {
        const result = await client.callTool({ name: tc.tool, arguments: tc.args });
        const text = result.content?.[0]?.text ?? "";
        const pass = text === tc.expect;
        const status = pass ? "PASS" : "FAIL";
        console.log(`${status}: ${tc.label} → got "${text}"${pass ? "" : `, expected "${tc.expect}"`}`);
        results.push({ label: tc.label, pass, detail: pass ? undefined : `got "${text}", expected "${tc.expect}"` });
      } catch (err) {
        console.log(`FAIL: ${tc.label} → error: ${err.message}`);
        results.push({ label: tc.label, pass: false, detail: `error: ${err.message}` });
      }
    }
  } catch (err) {
    console.error(`FATAL: ${err.message}`);
    results.push({ label: "connection", pass: false, detail: err.message });
  } finally {
    await client.close();
    console.log("\nServer connection closed.");
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  const total = results.length;

  console.log(`\n=== Summary: ${passed}/${total} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.label}: ${r.detail}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
