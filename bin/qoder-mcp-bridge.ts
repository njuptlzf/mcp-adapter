#!/usr/bin/env npx tsx
/**
 * bin/qoder-mcp-bridge.ts — Qoder SDK bridge entry point.
 *
 * Bridges the universal mcp-adapter proxy tool into Qoder's runtime via
 * the Qoder Agent SDK (createSdkMcpServer + query). Unlike the Kilo
 * stdio server, this is a process-internal bridge — Qoder's SessionStart
 * hook invokes this script, which registers tools into the SDK session.
 *
 * Usage:
 *   qoder-mcp-bridge                           # auto-discover .mcp.json
 *   qoder-mcp-bridge --config /path/to/mcp.json # explicit config path
 *   qoder-mcp-bridge --help                     # show usage
 *
 * Registration in ~/.qoder/settings.json:
 *   {
 *     "hooks": {
 *       "SessionStart": [{
 *         "hooks": [{
 *           "type": "command",
 *           "command": "qoder-mcp-bridge"
 *         }]
 *       }]
 *     }
 *   }
 *
 * This file is fork-only (upstream has no bin/ directory). It does not
 * modify any existing source files — all adapter logic stays in
 * adapters/qoder-adapter.ts and adapters/entry.ts.
 */

import { QoderAdapter, adaptQoderContext } from "../adapters/qoder-adapter.ts";
import { createMcpAdapter } from "../adapters/entry.ts";
import { createQoderResolver } from "../interfaces/agent-paths.ts";
import { loadMcpConfig } from "../config.ts";
import { loadMetadataCache } from "../metadata-cache.ts";
import type { AgentChannel } from "../interfaces/agent-channel.ts";

const BRIDGE_VERSION = "2.9.0";

function showHelp(): void {
	console.log(`
Usage: qoder-mcp-bridge [options]

Qoder SDK bridge — bridges mcp-adapter proxy tool into Qoder via SDK.

Options:
  --config <path>   Path to mcp.json config file
  --help            Show this help message
  --version         Show version

Environment:
  MCP_CONFIG_PATH   Alternative way to specify config path
  MCP_AGENT_DIR     Override Qoder global config directory (default: ~/.qoder/agent)

Config discovery (in priority order):
  1. --config flag
  2. MCP_CONFIG_PATH env var
  3. .mcp.json in current working directory
  4. ~/.config/mcp/mcp.json (shared global)
  5. ~/.qoder/agent/mcp.json (Qoder global)
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
			console.error("Run 'qoder-mcp-bridge --help' for usage.");
			process.exit(1);
		}
	}

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
		console.log(BRIDGE_VERSION);
		return;
	}

	// Dynamically import Qoder SDK — provides a clear error if not installed
	let createSdkMcpServer: typeof import("@qoder-ai/qoder-agent-sdk").createSdkMcpServer;
	let query: typeof import("@qoder-ai/qoder-agent-sdk").query;
	try {
		const sdk = await import("@qoder-ai/qoder-agent-sdk");
		createSdkMcpServer = sdk.createSdkMcpServer;
		query = sdk.query;
	} catch {
		console.error("[qoder-mcp-bridge] Error: @qoder-ai/qoder-agent-sdk not found.");
		console.error("[qoder-mcp-bridge] Install it with: npm install @qoder-ai/qoder-agent-sdk");
		process.exit(1);
	}

	// 1. Resolve config path — prefer explicit, then Qoder global, then auto-discover
	const resolver = createQoderResolver();
	const configPath = args.configPath ?? `${resolver.globalConfigPath()}/mcp.json`;
	const config = loadMcpConfig(configPath);
	const serverCount = Object.keys(config.mcpServers || {}).length;
	console.error(`[qoder-mcp-bridge] Config loaded: ${serverCount} server(s) configured`);

	if (serverCount === 0) {
		console.error("[qoder-mcp-bridge] Warning: no MCP servers configured. Create a .mcp.json file or use --config <path>.");
	}

	// 2. Create adapter instance + context
	const adapter = new QoderAdapter();
	const ctx = adaptQoderContext(
		{ cwd: process.cwd(), hasUI: true },
		adapter,
	);

	// 3. Load metadata cache
	const cache = loadMetadataCache();

	// 4. Register everything (proxy tool, commands, flags, lifecycle)
	createMcpAdapter(adapter, ctx, config, cache);

	// 5. Bridge adapter tools to Qoder SDK
	const tools = [...adapter.tools.values()];
	console.error(`[qoder-mcp-bridge] Bridging ${tools.length} tool(s) to Qoder SDK: ${tools.map(t => t.name).join(", ")}`);

	const mcpServer = createSdkMcpServer({ name: "mcp-adapter-tools", tools });
	const q = query({
		prompt: "",
		options: {
			mcpServers: { "mcp-adapter-tools": mcpServer },
			allowedTools: tools.map((t) => `mcp__mcp-adapter-tools__${t.name}`),
		},
	});

	// 5b. Wrap the Query handle into a universal AgentChannel
	// The channel normalizes the adapter → session communication path.
	// sendMessage routes through q.streamInput(); close delegates to q.close().
	const channel: AgentChannel = {
		send: (message: unknown) => {
			void q.streamInput(
				(async function* () { yield message; })(),
			);
		},
		close: () => { void q.close(); },
	};
	adapter.attachChannel(channel);

	// 6. Fire session_start → triggers lazy MCP server connections
	try {
		await adapter.fireSessionStart(ctx);
		console.error("[qoder-mcp-bridge] Session started, lazy connections initialized");
	} catch (err) {
		console.error(`[qoder-mcp-bridge] Session start error: ${(err as Error).message}`);
		// Non-fatal — servers connect lazily on first tool call
	}

	console.error("[qoder-mcp-bridge] Qoder SDK bridge ready");
}

main().catch((err: unknown) => {
	console.error(`[qoder-mcp-bridge] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
