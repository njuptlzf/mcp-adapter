import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "datetime", version: "1.0.0" });

server.tool("now", "Get current date and time", {
  format: z.enum(["iso", "unix", "readable"]).optional().default("iso").describe("Output format"),
}, async ({ format }) => {
  const now = new Date();
  switch (format) {
    case "iso": return { content: [{ type: "text", text: now.toISOString() }] };
    case "unix": return { content: [{ type: "text", text: String(Math.floor(now.getTime() / 1000)) }] };
    case "readable": return { content: [{ type: "text", text: now.toLocaleString() }] };
  }
});

server.tool("format", "Format a date", {
  timestamp: z.union([z.number(), z.string()]).describe("Unix timestamp or ISO date string"),
  format: z.enum(["iso", "unix", "readable", "date", "time"]).optional().default("iso").describe("Output format"),
}, async ({ timestamp, format }) => {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp * 1000);
  switch (format) {
    case "iso": return { content: [{ type: "text", text: date.toISOString() }] };
    case "unix": return { content: [{ type: "text", text: String(Math.floor(date.getTime() / 1000)) }] };
    case "readable": return { content: [{ type: "text", text: date.toLocaleString() }] };
    case "date": return { content: [{ type: "text", text: date.toLocaleDateString() }] };
    case "time": return { content: [{ type: "text", text: date.toLocaleTimeString() }] };
  }
});

server.tool("parse", "Parse date string to timestamp", {
  dateString: z.string().describe("Date string to parse"),
}, async ({ dateString }) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { content: [{ type: "text", text: "Error: Invalid date string" }] };
  }
  return { content: [{ type: "text", text: String(Math.floor(date.getTime() / 1000)) }] };
});

server.tool("diff", "Calculate difference between two dates", {
  from: z.union([z.number(), z.string()]).describe("Start date (Unix timestamp or ISO string)"),
  to: z.union([z.number(), z.string()]).describe("End date (Unix timestamp or ISO string)"),
  unit: z.enum(["ms", "s", "m", "h", "d"]).optional().default("s").describe("Unit for difference"),
}, async ({ from, to, unit }) => {
  const d1 = typeof from === "string" ? new Date(from) : new Date(from * 1000);
  const d2 = typeof to === "string" ? new Date(to) : new Date(to * 1000);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  const divisors = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return { content: [{ type: "text", text: String(diffMs / (divisors[unit] || 1000)) }] };
});

server.tool("add_days", "Add days to a date", {
  date: z.union([z.number(), z.string()]).describe("Base date (Unix timestamp or ISO string)"),
  days: z.number().describe("Number of days to add (can be negative)"),
}, async ({ date, days }) => {
  const d = typeof date === "string" ? new Date(date) : new Date(date * 1000);
  d.setDate(d.getDate() + days);
  return { content: [{ type: "text", text: d.toISOString() }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);