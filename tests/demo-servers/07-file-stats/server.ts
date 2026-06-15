import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";

const server = new McpServer({ name: "file-stats", version: "1.0.0" });

server.tool("line_count", "Count lines in a file", {
  filePath: z.string().describe("Path to the file"),
}, async ({ filePath }) => {
  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n').length;
    return { content: [{ type: "text", text: String(lines) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("word_count", "Count words in a file", {
  filePath: z.string().describe("Path to the file"),
}, async ({ filePath }) => {
  try {
    const content = await readFile(filePath, 'utf8');
    const words = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    return { content: [{ type: "text", text: String(words) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("char_count", "Count characters in a file", {
  filePath: z.string().describe("Path to the file"),
  includeSpaces: z.boolean().optional().default(true).describe("Whether to count spaces"),
}, async ({ filePath, includeSpaces }) => {
  try {
    const content = await readFile(filePath, 'utf8');
    const count = includeSpaces ? content.length : content.replace(/\s/g, '').length;
    return { content: [{ type: "text", text: String(count) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("find_pattern", "Find pattern in file content", {
  filePath: z.string().describe("Path to the file"),
  pattern: z.string().describe("Text or regex pattern to search for"),
  regex: z.boolean().optional().default(false).describe("Whether pattern is a regex"),
}, async ({ filePath, pattern, regex }) => {
  try {
    const content = await readFile(filePath, 'utf8');
    const regexObj = regex ? new RegExp(pattern, 'g') : new RegExp(escapeRegExp(pattern), 'g');
    const matches = content.match(regexObj);
    const count = matches ? matches.length : 0;
    return { content: [{ type: "text", text: String(count) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("head", "Get first N lines of a file", {
  filePath: z.string().describe("Path to the file"),
  lines: z.number().int().positive().describe("Number of lines to return"),
}, async ({ filePath, lines }) => {
  try {
    const content = await readFile(filePath, 'utf8');
    const contentLines = content.split('\n');
    const result = contentLines.slice(0, lines).join('\n');
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("tail", "Get last N lines of a file", {
  filePath: z.string().describe("Path to the file"),
  lines: z.number().int().positive().describe("Number of lines to return"),
}, async ({ filePath, lines }) => {
  try {
    const content = await readFile(filePath, 'utf8');
    const contentLines = content.split('\n');
    const result = contentLines.slice(-lines).join('\n');
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const transport = new StdioServerTransport();
await server.connect(transport);