#!/usr/bin/env npx tsx
/**
 * bin/mcp-server.ts — Universal MCP stdio server entry point.
 *
 * Agent-agnostic MCP stdio server that bridges the universal mcp-adapter
 * proxy tool into any MCP-compatible agent runtime via MCP stdio transport.
 *
 * D-04: Inlines its own AgentAPI implementation (InlineMcpAdapter) — no
 *   shared adapter base class, no per-agent adapter import.
 * D-05: Renamed from bin/kilo-mcp-server.ts. The server is agent-agnostic.
 * D-06/D-07: Protocol forwarders injected when Agent Client declares
 *   sampling/elicitation capabilities.
 * D-11: Pure forwarding — no config.settings checks. Client capability
 *   declaration is the only gate.
 *
 * Pitfall 1 (flow reordering): MCP Server is created and connected BEFORE
 *   fireSessionStart(), enabling runtime capability discovery and forwarder
 *   injection before initializeMcp() runs.
 * Pitfall 5: Uses server.getClientCapabilities() NOT the server's own
 *   capabilities method.
 * Pitfall 4: Sets ctx.hasUI = true when forwarders are injected, satisfying
 *   init.ts conditions without modifying init.ts.
 *
 * Usage:
 *   mcp-server                           # auto-discover .mcp.json
 *   mcp-server --config /path/to/mcp.json # explicit config path
 *   mcp-server --help                     # show usage
 *
 * Registration in agent config:
 *   {
 *     "mcpServers": {
 *       "mcp-adapter": {
 *         "command": "mcp-server"
 *       }
 *     }
 *   }
 *
 * This file is fork-only (upstream has no bin/ directory).
 */

import { ProtocolSamplingForwarder } from "../adapters/protocol-sampling-forwarder.ts";
import { ProtocolElicitationForwarder } from "../adapters/protocol-elicitation-forwarder.ts";
import { createMcpAdapter } from "../adapters/entry.ts";
import { loadMcpConfig } from "../config.ts";
import { loadMetadataCache } from "../metadata-cache.ts";
import { createUniversalResolver } from "../interfaces/agent-paths.ts";
import type {
	AgentAPI,
	AgentContext,
	CommandConfig,
	FlagConfig,
	ToolInfo,
	ToolRegistration,
	UISystem,
} from "../interfaces/agent-api.ts";
import type { AgentChannel } from "../interfaces/agent-channel.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SERVER_NAME = "mcp-adapter";
const SERVER_VERSION = "2.9.0";
const GENERIC_GLOBAL_CONFIG_PATH = createUniversalResolver().globalConfigPath();

// ---------------------------------------------------------------------------
// InlineMcpAdapter — inline AgentAPI implementation (D-04)
// ---------------------------------------------------------------------------

/**
 * Inline AgentAPI implementation for the universal MCP stdio server.
 *
 * D-04: No shared adapter base class. Each entry point has its own inline
 * implementation. This class provides in-memory tool/command/flag storage
 * and event simulators for createMcpAdapter.
 *
 * Threat model:
 *   T-10-01 (Information Disclosure): fire() logs errors with prefix +
 *     event name + handler count only — never the args.
 *   T-10-02 (Elevation of Privilege): exec() dynamically imports
 *     node:child_process; only called from trusted host code; no path from
 *     MCP tool result to exec.
 *   T-12-11 (Denial of Service): fireSessionStart wrapped in try/catch by
 *     caller; non-fatal — servers connect lazily on first tool call.
 */
class InlineMcpAdapter implements AgentAPI {
	/** Registered tools by name. Public so the MCP request handlers can enumerate them. */
	readonly tools = new Map<string, ToolRegistration>();
	/** Registered commands by name. */
	readonly commands = new Map<string, CommandConfig>();
	/** Registered flags by name. Value is mutable so `getFlag` reflects later updates. */
	readonly flags = new Map<string, FlagConfig & { value?: string }>();
	/** Event handlers keyed by event name. */
	readonly handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();

	/** Universal channel, set via `attachChannel`. */
	private channel: AgentChannel | undefined;

	private static readonly PREFIX = "[mcp-adapter]";

	// ----- Companion methods (NOT part of AgentAPI) -----

	/**
	 * Attach a universal AgentChannel for bidirectional communication.
	 * sendMessage routes through channel.send when attached.
	 */
	attachChannel(channel: AgentChannel): void {
		this.channel = channel;
	}

	/**
	 * Drive a simulated `session_start` event with the supplied runtime context.
	 * T-12-11: caller wraps in try/catch; non-fatal on error.
	 */
	async fireSessionStart(runtimeCtx: AgentContext): Promise<void> {
		await this.fire("session_start", "session_start", runtimeCtx);
	}

	/** Drive a simulated `session_shutdown` event. */
	async fireSessionShutdown(): Promise<void> {
		await this.fire("session_shutdown", "session_shutdown");
	}

	// ----- 8 AgentAPI methods -----

	registerTool(tool: ToolRegistration): void {
		this.tools.set(tool.name, tool);
	}

	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}

	registerFlag(name: string, config: FlagConfig): void {
		this.flags.set(name, { ...config });
	}

	on(event: string, handler: (...args: unknown[]) => void | Promise<void>): void {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler as (...args: unknown[]) => unknown);
	}

	getAllTools(): ToolInfo[] {
		return [...this.tools.values()].map((t) => ({ name: t.name }));
	}

	getFlag(name: string): string | undefined {
		return this.flags.get(name)?.value;
	}

	/**
	 * Send a message via the attached channel (routes to stderr).
	 * If no channel is attached, this is a no-op.
	 */
	sendMessage(message: unknown, _options?: unknown): void {
		if (this.channel) {
			void this.channel.send(message);
		}
		// No channel — no-op. stderr routing is handled by the channel in main().
	}

	/**
	 * Spawn a child process via node:child_process.spawn.
	 * T-10-02: only called from trusted host code; no path from MCP tool result.
	 */
	async exec(command: string, args: string[]): Promise<unknown> {
		const cp = (await import("node:child_process")) as typeof import("node:child_process");
		return await new Promise<{
			code: number | null;
			stdout: string;
			stderr: string;
		}>((resolvePromise, reject) => {
			const child = cp.spawn(command, args, {
				stdio: ["ignore", "pipe", "pipe"],
			});
			const stdoutChunks: Buffer[] = [];
			const stderrChunks: Buffer[] = [];
			child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
			child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
			child.once("error", reject);
			child.once("close", (code) => {
				resolvePromise({
					code,
					stdout: Buffer.concat(stdoutChunks).toString("utf8"),
					stderr: Buffer.concat(stderrChunks).toString("utf8"),
				});
			});
		});
	}

	// ----- Private helpers -----

	/**
	 * Invoke every handler registered for `event`.
	 * T-10-01: logs errors with prefix + event name + handler count only —
	 * never the args themselves.
	 */
	private async fire(event: string, ...args: unknown[]): Promise<void> {
		const set = this.handlers.get(event);
		if (!set || set.size === 0) return;
		const handlers = [...set];
		await Promise.all(
			handlers.map(async (h) => {
				try {
					await Promise.resolve(h(...args));
				} catch (err) {
					console.error(
						`${InlineMcpAdapter.PREFIX} handler error for event '${event}' (${set.size} handlers): ${(err as Error).message}`,
					);
				}
			}),
		);
	}
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function showHelp(): void {
	console.log(`
Usage: mcp-server [options]

Universal MCP stdio server — bridges mcp-adapter proxy tool into any
MCP-compatible agent via stdio transport.

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
			console.error("Run 'mcp-server --help' for usage.");
			process.exit(1);
		}
	}

	// Fall back to env var if no --config flag (D-02: universal config path discovery)
	if (!configPath && process.env.MCP_CONFIG_PATH) {
		configPath = process.env.MCP_CONFIG_PATH;
	}

	return { configPath, showHelp, showVersion };
}

// ---------------------------------------------------------------------------
// main() — reordered flow per Pitfall 1
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
	// Step 1: Parse args, handle help/version
	const args = parseArgs(process.argv);

	if (args.showHelp) {
		showHelp();
		return;
	}

	if (args.showVersion) {
		console.log(SERVER_VERSION);
		return;
	}

	// Step 2: Load config using universal resolver (D-02: no agent-specific paths)
	const config = loadMcpConfig(args.configPath, process.cwd(), GENERIC_GLOBAL_CONFIG_PATH);
	const serverCount = Object.keys(config.mcpServers || {}).length;
	console.error(`[mcp-server] Config loaded: ${serverCount} server(s) configured`);

	if (serverCount === 0) {
		console.error("[mcp-server] Warning: no MCP servers configured. Create a .mcp.json file or use --config <path>.");
	}

	// Step 3: Create InlineMcpAdapter instance (D-04: inline AgentAPI)
	const adapter = new InlineMcpAdapter();

	// Step 4: Create initial AgentContext (will be enhanced after capability discovery)
	const ctx: AgentContext = {
		cwd: process.cwd(),
		hasUI: false,
	};

	// Step 5: Load metadata cache
	const cache = loadMetadataCache();

	// Step 6: Register everything (proxy tool, commands, flags, session lifecycle)
	createMcpAdapter(adapter, ctx, config, cache);

	// Step 7: Attach AgentChannel — routes adapter sendMessage to stderr
	// (MCP stdio uses stdout for protocol; stderr is for diagnostics)
	const channel: AgentChannel = {
		send: (msg: unknown) => {
			const text = typeof msg === "string" ? msg : JSON.stringify(msg);
			console.error(`[mcp-server] adapter message: ${text}`);
		},
	};
	adapter.attachChannel(channel);

	// Step 8: Create MCP Server
	const server = new Server(
		{ name: SERVER_NAME, version: SERVER_VERSION },
		{ capabilities: { tools: {} } },
	);

	// Step 9: Set request handlers (same pattern as kilo-mcp-server.ts)
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		const mcpTools = [...adapter.tools.entries()].map(([name, tool]) => ({
			name,
			description: tool.description || `MCP proxy tool: ${name}`,
			inputSchema: tool.parameters || { type: "object", properties: {} },
		}));
		console.error(`[mcp-server] list-tools: ${mcpTools.length} tools`);
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

	// Step 10: CRITICAL — Connect transport BEFORE fireSessionStart (Pitfall 1)
	// getClientCapabilities() is only populated after server.connect() completes
	// the MCP initialization handshake.
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Step 11: CRITICAL — Check client capabilities via getClientCapabilities()
	// NOT the server's own capabilities method — Pitfall 5. The server's own
	// capabilities returns { tools, resources, prompts }; client capabilities
	// returns { sampling, elicitation } populated during MCP initialization.
	const clientCaps = server.getClientCapabilities();

	// Step 12: If client declares sampling capability — inject ProtocolSamplingForwarder
	// D-11: No config.settings.sampling check — pure forwarding.
	if (clientCaps?.sampling) {
		const samplingForwarder = new ProtocolSamplingForwarder(server);
		ctx.samplingProvider = samplingForwarder;
		// Pitfall 4: Set hasUI so init.ts sampling condition passes
		ctx.hasUI = true;
		console.error("[mcp-server] Sampling capability detected — ProtocolSamplingForwarder injected");
	}

	// Step 13: If client declares elicitation.form capability — inject ProtocolElicitationForwarder
	// D-11: No config.settings.elicitation check — pure forwarding.
	if (clientCaps?.elicitation?.form) {
		const elicitationForwarder = new ProtocolElicitationForwarder(server);
		const ui: UISystem = {
			notify: (message: string, level: "info" | "warning" | "error"): void => {
				const consoleMethod: "info" | "warn" | "error" =
					level === "error" ? "error" : level === "warning" ? "warn" : "info";
				console[consoleMethod](`[mcp-server] ${message}`);
			},
			form: (config: import("../interfaces/agent-api.ts").FormConfig) =>
				elicitationForwarder.form(config),
		};
		ctx.ui = ui;
		// Pitfall 4: Set hasUI so init.ts elicitation condition passes
		ctx.hasUI = true;
		console.error("[mcp-server] Elicitation.form capability detected — ProtocolElicitationForwarder injected");
	}

	// Step 14: Fire session_start — triggers initializeMcp which reads ctx
	// with forwarders injected. T-12-11: wrap in try/catch, non-fatal.
	try {
		await adapter.fireSessionStart(ctx);
		console.error("[mcp-server] Session started, lazy connections initialized");
	} catch (err) {
		console.error(`[mcp-server] Session start error: ${(err as Error).message}`);
		// Non-fatal — servers connect lazily on first tool call
	}

	// Step 15: Server ready
	console.error("[mcp-server] MCP server ready via stdio");
}

main().catch((err: unknown) => {
	console.error(`[mcp-server] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
