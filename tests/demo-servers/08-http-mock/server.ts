import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "http-mock", version: "1.0.0" });

server.tool("get", "Mock HTTP GET request", {
  url: z.string().describe("URL to request"),
  headers: z.record(z.string()).optional().describe("Request headers"),
}, async ({ url, headers }) => {
  return { content: [{ type: "text", text: JSON.stringify({ method: "GET", url, headers: headers || {}, status: 200, data: { message: "Mock GET response" } }) }] };
});

server.tool("post", "Mock HTTP POST request", {
  url: z.string().describe("URL to request"),
  headers: z.record(z.string()).optional().describe("Request headers"),
  body: z.union([z.string(), z.object()]).describe("Request body"),
}, async ({ url, headers, body }) => {
  return { content: [{ type: "text", text: JSON.stringify({ method: "POST", url, headers: headers || {}, body, status: 201, data: { message: "Mock POST response" } }) }] };
});

server.tool("put", "Mock HTTP PUT request", {
  url: z.string().describe("URL to request"),
  headers: z.record(z.string()).optional().describe("Request headers"),
  body: z.union([z.string(), z.object()]).describe("Request body"),
}, async ({ url, headers, body }) => {
  return { content: [{ type: "text", text: JSON.stringify({ method: "PUT", url, headers: headers || {}, body, status: 200, data: { message: "Mock PUT response" } }) }] };
});

server.tool("delete", "Mock HTTP DELETE request", {
  url: z.string().describe("URL to request"),
  headers: z.record(z.string()).optional().describe("Request headers"),
}, async ({ url, headers }) => {
  return { content: [{ type: "text", text: JSON.stringify({ method: "DELETE", url, headers: headers || {}, status: 204, data: { message: "Mock DELETE response" } }) }] };
});

server.tool("check_status", "Mock HTTP status check", {
  url: z.string().describe("URL to check"),
}, async ({ url }) => {
  return { content: [{ type: "text", text: JSON.stringify({ url, status: 200, statusText: "OK" }) }] };
});

server.tool("parse_headers", "Parse HTTP headers string", {
  headers: z.string().describe("HTTP headers string (one per line)"),
}, async ({ headers }) => {
  const parsed = {};
  headers.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      parsed[key.trim()] = valueParts.join(':').trim();
    }
  });
  return { content: [{ type: "text", text: JSON.stringify(parsed) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);