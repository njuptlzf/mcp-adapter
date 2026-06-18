import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "kv-store", version: "1.0.0" });

// In-memory store
const store = new Map<string, string>();

server.tool("set", "Set key-value pair", {
  key: z.string().describe("Key to store"),
  value: z.string().describe("Value to store"),
}, async ({ key, value }) => {
  store.set(key, value);
  return { content: [{ type: "text", text: `Stored key '${key}'` }] };
});

server.tool("get", "Get value by key", {
  key: z.string().describe("Key to retrieve"),
}, async ({ key }) => {
  const value = store.get(key);
  if (value === undefined) {
    return { content: [{ type: "text", text: `Error: Key '${key}' not found` }] };
  }
  return { content: [{ type: "text", text: value }] };
});

server.tool("delete", "Delete key-value pair", {
  key: z.string().describe("Key to delete"),
}, async ({ key }) => {
  if (store.has(key)) {
    store.delete(key);
    return { content: [{ type: "text", text: `Deleted key '${key}'` }] };
  } else {
    return { content: [{ type: "text", text: `Error: Key '${key}' not found` }] };
  }
});

server.tool("list_keys", "List all keys", {
  pattern: z.string().optional().describe("Optional pattern to filter keys (minimatch style)"),
}, async ({ pattern }) => {
  let keys = Array.from(store.keys());
  if (pattern) {
    // Simple glob-like matching
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    keys = keys.filter(key => regex.test(key));
  }
  return { content: [{ type: "text", text: JSON.stringify(keys) }] };
});

server.tool("exists", "Check if key exists", {
  key: z.string().describe("Key to check"),
}, async ({ key }) => {
  return { content: [{ type: "text", text: String(store.has(key)) }] };
});

server.tool("clear", "Clear all key-value pairs", {}, async () => {
  store.clear();
  return { content: [{ type: "text", text: "Cleared all key-value pairs" }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);