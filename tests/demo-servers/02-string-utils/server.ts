import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "string-utils", version: "1.0.0" });

server.tool("upper", "Convert string to uppercase", {
  text: z.string().describe("Input string"),
}, async ({ text }) => ({
  content: [{ type: "text", text: text.toUpperCase() }],
}));

server.tool("lower", "Convert string to lowercase", {
  text: z.string().describe("Input string"),
}, async ({ text }) => ({
  content: [{ type: "text", text: text.toLowerCase() }],
}));

server.tool("trim", "Trim whitespace from both ends", {
  text: z.string().describe("Input string"),
}, async ({ text }) => ({
  content: [{ type: "text", text: text.trim() }],
}));

server.tool("split", "Split string by delimiter", {
  text: z.string().describe("Input string"),
  delimiter: z.string().describe("Delimiter to split by"),
}, async ({ text, delimiter }) => ({
  content: [{ type: "text", text: JSON.stringify(text.split(delimiter)) }],
}));

server.tool("replace", "Replace substring in string", {
  text: z.string().describe("Input string"),
  search: z.string().describe("Substring to replace"),
  replace: z.string().describe("Replacement string"),
}, async ({ text, search, replace }) => ({
  content: [{ type: "text", text: text.replaceAll(search, replace) }],
}));

server.tool("reverse", "Reverse a string", {
  text: z.string().describe("Input string"),
}, async ({ text }) => ({
  content: [{ type: "text", text: text.split("").reverse().join("") }],
}));

server.tool("count_chars", "Count characters in string", {
  text: z.string().describe("Input string"),
  include_spaces: z.boolean().optional().default(true).describe("Whether to count spaces"),
}, async ({ text, include_spaces }) => {
  const count = include_spaces ? text.length : text.replace(/\s/g, "").length;
  return { content: [{ type: "text", text: String(count) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);