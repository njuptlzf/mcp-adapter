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

server.tool("subtract", "Subtract second number from first", {
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
}, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a - b) }],
}));

server.tool("multiply", "Multiply two numbers", {
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
}, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a * b) }],
}));

server.tool("divide", "Divide first number by second", {
  a: z.number().describe("Dividend"),
  b: z.number().describe("Divisor (must not be zero)"),
}, async ({ a, b }) => {
  if (b === 0) {
    return { content: [{ type: "text", text: "Error: Division by zero" }] };
  }
  return { content: [{ type: "text", text: String(a / b) }] };
});

server.tool("power", "Raise base to exponent", {
  base: z.number().describe("Base"),
  exponent: z.number().describe("Exponent"),
}, async ({ base, exponent }) => ({
  content: [{ type: "text", text: String(Math.pow(base, exponent)) }],
}));

server.tool("sqrt", "Calculate square root", {
  value: z.number().describe("Value (must be non-negative)"),
}, async ({ value }) => {
  if (value < 0) {
    return { content: [{ type: "text", text: "Error: Cannot compute square root of negative number" }] };
  }
  return { content: [{ type: "text", text: String(Math.sqrt(value)) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);