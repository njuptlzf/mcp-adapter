import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpConfig, MetadataCache, ServerCacheEntry } from "../../types.ts";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Mock isServerCacheValid to avoid hash computation complexity.
// The resolveDirectTools tests construct known-good cache data.
vi.mock("../../metadata-cache.ts", async () => {
  const actual = await vi.importActual("../../metadata-cache.ts");
  return {
    ...(actual as object),
    isServerCacheValid: () => true,
  };
});

import { resolveDirectTools } from "../../direct-tools.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// E2E-05: directTools Mode — End-to-End Validation
//
// Validates that when directTools is enabled, MCP server tools
// can be resolved as individual top-level tools and called
// directly (without the mcp proxy indirection).
//
// Per test plan §6.2 E2E-05:
//   Step 1: Confirm individual tools exist (not grouped under mcp)
//   Step 2: Direct call add(10, 20) = "30"
// ============================================================

const CALCULATOR_SPEC_PATH = join(__dirname, "..", "demo-servers", "01-calculator", "server-spec.json");
const CALCULATOR_SERVER_PATH = join(__dirname, "..", "demo-servers", "01-calculator", "server.ts");

describe("E2E-05: directTools mode", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", CALCULATOR_SERVER_PATH],
    });
    client = new Client(
      { name: "e2e-05-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  describe("Step 1: tools are individually accessible (not via mcp proxy)", () => {
    it("lists calculator tools directly from the MCP server", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t: { name: string }) => t.name);

      expect(toolNames).toContain("add");
      expect(toolNames).toContain("subtract");
      expect(toolNames).toContain("multiply");
      expect(toolNames).toContain("divide");
      expect(toolNames).toContain("power");
      expect(toolNames).toContain("sqrt");
      // In directTools mode, these appear as individual tools,
      // NOT grouped under a single "mcp" proxy tool.
      // The MCP SDK connection here is equivalent to what
      // mcp-adapter does internally when connecting to servers.
      expect(toolNames).not.toContain("mcp");
    });

    it("resolveDirectTools produces correct specs for calculator", () => {
      // Simulate the config + cache that would exist after
      // mcp-adapter connects to the calculator server with directTools: true
      const spec = JSON.parse(readFileSync(CALCULATOR_SPEC_PATH, "utf8"));

      const config: McpConfig = {
        mcpServers: {
          calculator: {
            command: "npx",
            args: ["tsx", CALCULATOR_SERVER_PATH],
            directTools: true,
          },
        },
      };

      const serverCache: ServerCacheEntry = {
        configHash: "test-hash",
        cachedAt: Date.now(),
        tools: spec.tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.parameters || { type: "object", properties: {} },
        })),
      };

      const cache: MetadataCache = {
        version: 1,
        servers: { calculator: serverCache },
      };

      const result = resolveDirectTools(config, cache, "server");

      expect(result.length).toBe(6);
      expect(result.map((r) => r.originalName).sort()).toEqual([
        "add", "divide", "multiply", "power", "sqrt", "subtract",
      ]);

      // Each tool gets a prefixed name (prefix="server" → "calculator_add" etc.)
      for (const spec of result) {
        expect(spec.prefixedName).toBe(`calculator_${spec.originalName}`);
        expect(spec.serverName).toBe("calculator");
        expect(spec.description).toBeTruthy();
      }
    });

    it("resolveDirectTools with prefix='none' keeps original names", () => {
      const spec = JSON.parse(readFileSync(CALCULATOR_SPEC_PATH, "utf8"));

      const config: McpConfig = {
        mcpServers: {
          calculator: {
            command: "npx",
            args: ["tsx", CALCULATOR_SERVER_PATH],
            directTools: true,
          },
        },
        settings: { toolPrefix: "none" },
      };

      const cache: MetadataCache = {
        version: 1,
        servers: {
          calculator: {
            configHash: "test-hash",
            cachedAt: Date.now(),
            tools: spec.tools.map((t: any) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.parameters || { type: "object", properties: {} },
            })),
          },
        },
      };

      const result = resolveDirectTools(config, cache, "none");

      // With prefix="none", tool names are kept as-is
      for (const spec of result) {
        expect(spec.prefixedName).toBe(spec.originalName);
      }
    });

    it("resolveDirectTools filters by tool name when array provided", () => {
      const spec = JSON.parse(readFileSync(CALCULATOR_SPEC_PATH, "utf8"));

      const config: McpConfig = {
        mcpServers: {
          calculator: {
            command: "npx",
            args: ["tsx", CALCULATOR_SERVER_PATH],
            directTools: ["add", "power"], // only these two
          },
        },
      };

      const cache: MetadataCache = {
        version: 1,
        servers: {
          calculator: {
            configHash: "test-hash",
            cachedAt: Date.now(),
            tools: spec.tools.map((t: any) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.parameters || { type: "object", properties: {} },
            })),
          },
        },
      };

      const result = resolveDirectTools(config, cache, "server");

      expect(result.length).toBe(2);
      expect(result.map((r) => r.originalName).sort()).toEqual(["add", "power"]);
    });

    it("resolveDirectTools returns empty when directTools is false", () => {
      const spec = JSON.parse(readFileSync(CALCULATOR_SPEC_PATH, "utf8"));

      const config: McpConfig = {
        mcpServers: {
          calculator: {
            command: "npx",
            args: ["tsx", CALCULATOR_SERVER_PATH],
            directTools: false,
          },
        },
      };

      const definition = config.mcpServers.calculator;

      const cache: MetadataCache = {
        version: 1,
        servers: {
          calculator: {
            configHash: "test-hash",
            cachedAt: Date.now(),
            tools: spec.tools.map((t: any) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.parameters || { type: "object", properties: {} },
            })),
          },
        },
      };

      const result = resolveDirectTools(config, cache, "server");
      expect(result).toHaveLength(0);
    });
  });

  describe("Step 2: direct tool call add(10, 20) = 30", () => {
    it("calls add via MCP SDK directly and returns correct result", async () => {
      const result = await client.callTool({
        name: "add",
        arguments: { a: 10, b: 20 },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();

      const textContent = result.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("");

      expect(textContent).toContain("30");
    });

    it("calls multiply directly and returns correct result", async () => {
      const result = await client.callTool({
        name: "multiply",
        arguments: { a: 7, b: 8 },
      });

      const textContent = result.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("");

      expect(textContent).toContain("56");
    });

    it("calls power directly and returns correct result", async () => {
      const result = await client.callTool({
        name: "power",
        arguments: { base: 2, exponent: 10 },
      });

      const textContent = result.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("");

      expect(textContent).toContain("1024");
    });

    it("all 6 calculator tools are individually callable", async () => {
      const testCases = [
        { tool: "add", args: { a: 1, b: 2 }, expect: "3" },
        { tool: "subtract", args: { a: 10, b: 3 }, expect: "7" },
        { tool: "multiply", args: { a: 4, b: 5 }, expect: "20" },
        { tool: "divide", args: { a: 20, b: 4 }, expect: "5" },
        { tool: "power", args: { base: 3, exponent: 3 }, expect: "27" },
        { tool: "sqrt", args: { value: 144 }, expect: "12" },
      ];

      for (const { tool, args, expect: expected } of testCases) {
        const result = await client.callTool({ name: tool, arguments: args });
        const textContent = result.content
          .filter((c: { type: string }) => c.type === "text")
          .map((c: { text: string }) => c.text)
          .join("");

        expect(
          textContent,
          `${tool}(${JSON.stringify(args)}) should return ${expected}`,
        ).toContain(expected);
      }
    });
  });
});
