#!/usr/bin/env npx tsx
/**
 * bin/kilo-mcp-server.ts — Kilo MCP stdio server entry point.
 *
 * Bridges the universal mcp-adapter proxy tool into Kilo's runtime via
 * MCP stdio transport. Kilo's native MCP client auto-discovers and
 * connects to this server at startup.
 *
 * Usage:
 *   kilo-mcp-server                           # auto-discover .mcp.json
 *   kilo-mcp-server --config /path/to/mcp.json # explicit config path
 *   kilo-mcp-server --help                     # show usage
 *
 * Registration in kilo.json / .mcp.json:
 *   {
 *     "mcpServers": {
 *       "mcp-adapter": {
 *         "command": "kilo-mcp-server"
 *       }
 *     }
 *   }
 *
 * This file is fork-only (upstream has no bin/ directory). It does not
 * modify any existing source files — all adapter logic stays in
 * adapters/kilo-adapter.ts and adapters/entry.ts.
 */

import { KiloAdapter, adaptKiloContext } from "../adapters/kilo-adapter.ts";
import { createMcpAdapter } from "../adapters/entry.ts";
import { loadMcpConfig } from "../config.ts";
import { loadMetadataCache } from "../metadata-cache.ts";
import { createKiloResolver } from "../interfaces/agent-paths.ts";
import type { AgentContext } from "../interfaces/agent-api.ts";
import type { AgentChannel } from "../interfaces/agent-channel.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SERVER_NAME = "mcp-adapter-kilo";
const SERVER_VERSION = "2.9.0";

function showHelp(): void {
	console.log(`
Usage: kilo-mcp-server [options]

Kilo MCP stdio server — bridges mcp-adapter proxy tool into Kilo.

Options:
  --config <path>   Path to mcp.json config file
  --help            Show this help message
  --version         Show version

Environment:
  MCP_CONFIG_PATH   Alternative way to specify config path

Config discovery (in priority order):
  1. --config flag
  2. MCP_CONFIG_PATH env var
  3. .mcp.json in current working directory
  4. ~/.config/mcp/mcp.json (shared global)
  5. ~/.kilo/mcp.json (Kilo global)
`);
}

function parseArgs(argv: string[]): { configPath?: string; showHelp: boolean; showVersion: boolean } {
	let configPath: string | undefined;
	let showHelp = false;
	let showVersion = false;

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			showHelp = true;
		} else if (arg === "--version" || arg === "-v") {
			showVersion = true;
		} else if (arg === "--config") {
			configPath = argv[++i];
			if (!configPath) {
				console.error("Error: --config requires a path argument");
				process.exit(1);
			}
		} else if (arg.startsWith("--config=")) {
			configPath = arg.slice("--config=".length);
		} else {
			console.error(`Unknown option: ${arg}`);
			console.error("Run 'kilo-mcp-server --help' for usage.");
			process.exit(1);
		}
	}

	// Fall back to env var if no --config flag
	if (!configPath && process.env.MCP_CONFIG_PATH) {
		configPath = process.env.MCP_CONFIG_PATH;
	}

	return { configPath, showHelp, showVersion };
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv);

	if (args.showHelp) {
		showHelp();
		return;
	}

	if (args.showVersion) {
		console.log(SERVER_VERSION);
		return;
	}

	// 1. Load config with Kilo resolver (DEC-04: was using DEFAULT_AGENT_RESOLVER = Pi)
	const kiloResolver = createKiloResolver();
	const config = loadMcpConfig(args.configPath, process.cwd(), kiloResolver.globalConfigPath());
	const serverCount = Object.keys(config.mcpServers || {}).length;
	console.error(`[kilo-mcp-server] Config loaded: ${serverCount} server(s) configured`);

	if (serverCount === 0) {
		console.error("[kilo-mcp-server] Warning: no MCP servers configured. Create a .mcp.json file or use --config <path>.");
	}

	// 2. Create adapter instance + context
	const adapter = new KiloAdapter();
	const ctx: AgentContext = adaptKiloContext({ cwd: process.cwd(), hasUI: false });

	// 3. Load metadata cache
	const cache = loadMetadataCache();

	// 4. Register everything (proxy tool, commands, flags, lifecycle)
	createMcpAdapter(adapter, ctx, config, cache);

	// 4b. Attach AgentChannel — routes adapter sendMessage to stderr
	// (MCP stdio uses stdout for protocol; stderr is for diagnostics)
	const channel: AgentChannel = {
		send: (msg: unknown) => {
			const text = typeof msg === "string" ? msg : JSON.stringify(msg);
			console.error(`[kilo-mcp-server] adapter message: ${text}`);
		},
	};
	adapter.attachChannel(channel);

	// 5. Fire session_start → triggers lazy MCP server connections
	try {
		await adapter.fireSessionStart(ctx);
		console.error("[kilo-mcp-server] Session started, lazy connections initialized");
	} catch (err) {
		console.error(`[kilo-mcp-server] Session start error: ${(err as Error).message}`);
		// Non-fatal — servers connect lazily on first tool call
	}

	// 6. Collect registered tools for MCP exposure
	const mcpTools = [...adapter.tools.entries()].map(([name, tool]) => ({
		name,
		description: tool.description || `MCP proxy tool: ${name}`,
		inputSchema: tool.parameters || { type: "object", properties: {} },
	}));

	console.error(`[kilo-mcp-server] Exposing ${mcpTools.length} tool(s): ${mcpTools.map(t => t.name).join(", ")}`);

	// 7. Create MCP stdio server
	const server = new Server(
		{ name: SERVER_NAME, version: SERVER_VERSION },
		{ capabilities: { tools: {} } },
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		console.error(`[kilo-mcp-server] list-tools: ${mcpTools.length} tools`);
		return { tools: mcpTools };
	});

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: callArgs } = request.params;
		const tool = adapter.tools.get(name);
		if (!tool) {
			throw new Error(`Unknown tool: ${name}`);
		}
		try {
			const result = await tool.execute(
				`call-${Date.now()}`,
				callArgs || {},
				undefined,
				undefined,
				ctx,
			);
			const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
			return { content: [{ type: "text" as const, text }] };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text" as const, text: `Error: ${message}` }],
				isError: true,
			};
		}
	});

	// 8. Connect via stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("[kilo-mcp-server] MCP server ready via stdio");
}

main().catch((err: unknown) => {
	console.error(`[kilo-mcp-server] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
