#!/usr/bin/env npx tsx
/**
 * bin/mcp-server.ts — Universal MCP stdio server entry point.
 *
 * Stage 2 (fork-host, not fork-engine): this entry point now installs the
 * UPSTREAM engine (`index.ts`'s `createMcpAdapter`) onto a `UniversalMcpHost`
 * that presents the Pi `ExtensionAPI` surface. The fork's parallel engine
 * (`adapters/entry.ts`) is no longer used here.
 *
 * D-04/D-05: the host is agent-agnostic; no per-agent adapter import.
 * D-06/D-07: protocol forwarders are injected when the Agent Client declares
 *   sampling/elicitation capabilities.
 * D-11: pure forwarding — no config.settings checks. Client capability
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

import { readFileSync } from "node:fs";

import { createMcpAdapter } from "../index.ts";
import { UniversalMcpHost } from "../adapters/universal-host.ts";
import { ProtocolSamplingForwarder } from "../adapters/protocol-sampling-forwarder.ts";
import { ProtocolElicitationForwarder } from "../adapters/protocol-elicitation-forwarder.ts";
import { getConfigSources, loadMcpConfig } from "../config.ts";
import { getConfigWatch, startConfigWatch, stopConfigWatch } from "../config-watch.ts";
import { createUniversalResolver } from "../interfaces/agent-paths.ts";
import type { AgentChannel, FormConfig, UISystem } from "../interfaces/host-types.ts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const SERVER_NAME = "mcp-adapter";
// Injected at bundle time by scripts/build-mcp-server.mjs via esbuild `define`
// from package.json's `version`. Running directly with tsx (dev) falls back to
// reading package.json, so --version can never drift from the package version.
declare const __SERVER_VERSION__: string | undefined;
const SERVER_VERSION: string =
	typeof __SERVER_VERSION__ !== "undefined"
		? __SERVER_VERSION__
		: JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")).version;
const GENERIC_GLOBAL_CONFIG_PATH = createUniversalResolver().globalConfigPath();

// Build metadata injected at bundle time by scripts/build-mcp-server.mjs via
// esbuild `define`. When run directly with tsx (dev), __BUILD_INFO__ is an
// unbound global, so BUILD_INFO falls back to placeholder values.
declare const __BUILD_INFO__: { tag: string; hash: string; date: string } | undefined;

const BUILD_INFO: { tag: string; hash: string; date: string } =
	typeof __BUILD_INFO__ !== "undefined"
		? __BUILD_INFO__
		: { tag: "dev", hash: "unknown", date: "unknown" };

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function showHelp(): void {
	console.log(`
Usage: mcp-server [options] [version]

Universal MCP stdio server — bridges mcp-adapter proxy tool into any
MCP-compatible agent via stdio transport.

Options:
  --config <path>        Path to mcp.json config file
  --exit-on-eof[=bool]   Exit when stdin reaches EOF (default: true). Set false
                         to keep the adapter resident after the client closes stdin.
  --help                 Show this help message
  --version              Show version (tag, commit hash, build date)

Environment:
  MCP_CONFIG_PATH         Alternative way to specify config path
  MCP_CONFIG_WATCH        "0"/"off"/"false" disables the auto-restart when watched
                          config files change after startup (warn-only instead)
  MCP_ADAPTER_EXIT_ON_EOF "0"/"off"/"false" keeps the adapter resident after stdin
                          EOF — use only when a host intentionally holds stdin open.

Config discovery (in priority order):
  1. --config flag
  2. MCP_CONFIG_PATH env var
  3. .mcp.json in current working directory
  4. ~/.config/mcp/mcp.json (shared global)
`);
}

function parseArgs(argv: string[]): { configPath?: string; showHelp: boolean; showVersion: boolean; exitOnEof: boolean } {
	let configPath: string | undefined;
	let showHelp = false;
	let showVersion = false;
	// stdin EOF guard is on by default; both the flag and the env var can opt out.
	let exitOnEof = exitOnEofFromEnv(process.env.MCP_ADAPTER_EXIT_ON_EOF);

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			showHelp = true;
		} else if (arg === "--version" || arg === "-v" || arg === "version") {
			showVersion = true;
		} else if (arg === "--config") {
			configPath = argv[++i];
			if (!configPath) {
				console.error("Error: --config requires a path argument");
				process.exit(1);
			}
		} else if (arg.startsWith("--config=")) {
			configPath = arg.slice("--config=".length);
		} else if (arg === "--exit-on-eof") {
			// Bare flag means "true"; an explicit false is only via = or the env var.
			exitOnEof = true;
		} else if (arg.startsWith("--exit-on-eof=")) {
			exitOnEof = parseBoolFlag(arg.slice("--exit-on-eof=".length));
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

	return { configPath, showHelp, showVersion, exitOnEof };
}

/** "0"/"off"/"false"/"no" (case-insensitive) mean false; anything else means true. */
function parseBoolFlag(raw: string | undefined): boolean {
	return !["0", "off", "false", "no"].includes((raw ?? "").trim().toLowerCase());
}

/** Absent/empty env var keeps the EOF guard enabled; explicit false disables it. */
function exitOnEofFromEnv(raw: string | undefined): boolean {
	if (raw === undefined || raw.trim() === "") return true;
	return parseBoolFlag(raw);
}

// ---------------------------------------------------------------------------
// stdin EOF guard (issue #44)
// ---------------------------------------------------------------------------

/** Max time to wait for graceful cleanup before force-exiting on stdin EOF. */
const SHUTDOWN_GRACE_MS = 2000;

/**
 * A client that closes stdin without sending a signal is a *normal* MCP
 * shutdown, but the SDK's StdioServerTransport does not exit the process on
 * stdin `end`. Without this guard the adapter — and every stdio child it
 * spawned — lingers as an orphan (ppid=1). Stateful children then fight over
 * the same on-disk store (issue #44: concurrent SQLite writers corrupt the
 * codebase-memory-mcp index and kill incremental watching).
 *
 * Idempotent: `end`/`close`/`error` can all fire for one EOF, and a self-restart
 * can race with it — shutdown must happen exactly once.
 *
 * Skipped on a TTY so local `npx tsx bin/mcp-server.ts` debugging is unaffected.
 */
function installStdinEofGuard(host: UniversalMcpHost, transport: StdioServerTransport): void {
	if (process.stdin.isTTY) return;

	let shuttingDown = false;
	const shutdown = (reason: string): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.error(`[mcp-server] stdin ${reason} — shutting down`);

		// 1) Stop the config-watch poll timer: on its own it keeps the event loop
		//    alive forever, which is the reason the process never exited.
		stopConfigWatch();

		// 2) Backstop: regardless of what graceful cleanup does, leave within the
		//    grace window. unref() so this timer never keeps the loop alive itself.
		const forceExit = setTimeout(() => {
			console.error("[mcp-server] shutdown grace period elapsed; forcing exit");
			process.exit(0);
		}, SHUTDOWN_GRACE_MS);
		forceExit.unref?.();

		// 3) Graceful: session_shutdown runs the engine's closeAll() so child
		//    transports close and their stdio pipes signal EOF to the children.
		//    Closing our own transport then releases stdin/stdout. process.exit()
		//    is the final guarantee (fd close reaps anything still attached).
		void (async () => {
			try {
				await host.fireSessionShutdown();
			} catch {
				// Non-fatal — process.exit() closes all fds regardless.
			}
			try {
				await transport.close();
			} catch {
				// Already closed (e.g. an EOF-triggered close won the race).
			}
			process.exit(0);
		})();
	};

	process.stdin.on("end", () => shutdown("end"));
	process.stdin.on("close", () => shutdown("close"));
	process.stdin.on("error", () => shutdown("error"));

	// Make sure the stream flows so `end` fires even if no other data listener
	// was attached (belt-and-suspenders; StdioServerTransport normally does this).
	process.stdin.resume();

	// EOF may have arrived between connect() and listener installation.
	if (process.stdin.readableEnded) shutdown("already ended");
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
		console.log(`tag: ${BUILD_INFO.tag}`);
		console.log(`commit: ${BUILD_INFO.hash}`);
		console.log(`built: ${BUILD_INFO.date}`);
		return;
	}

	// Step 2: Load config using universal resolver (D-02: no agent-specific paths).
	// The upstream engine loads metadata cache itself; here we only pre-load
	// config for the startup log and pass it programmatically.
	const config = loadMcpConfig(args.configPath, process.cwd(), GENERIC_GLOBAL_CONFIG_PATH);
	const serverCount = Object.keys(config.mcpServers || {}).length;
	console.error(`[mcp-server] Config loaded: ${serverCount} server(s) configured`);

	// Step 2b: fingerprint the config files the loader reads and watch them for
	// post-startup changes (issue #34). Consumers may write the manifest only after
	// the adapter is already running; the engine config is a frozen snapshot, so a
	// detected change exits(0) and lets the client supervisor respawn fresh.
	// MCP_CONFIG_WATCH=0|off|false downgrades auto-restart to warn-only.
	const watchPaths = [...new Set(getConfigSources(args.configPath, process.cwd()).map((source) => source.readPath))];
	const autoRestart = !["0", "off", "false"].includes((process.env.MCP_CONFIG_WATCH ?? "").trim().toLowerCase());
	startConfigWatch({
		paths: watchPaths,
		overridePath: args.configPath,
		cwd: process.cwd(),
		loadedServerCount: serverCount,
		autoRestart,
	});

	if (serverCount === 0) {
		console.error(`[mcp-server] Warning: no MCP servers configured. Create a .mcp.json file or use --config <path>.${autoRestart ? " Watching config files — the adapter restarts itself when one appears or changes." : ""}`);
	}

	// Step 3: Install the UPSTREAM engine onto a UniversalMcpHost (Stage 2).
	const host = new UniversalMcpHost();
	const install = createMcpAdapter({ config });
	install(host);

	// Step 4: Attach AgentChannel — routes host sendMessage to stderr
	// (MCP stdio uses stdout for protocol; stderr is for diagnostics)
	const channel: AgentChannel = {
		send: (msg: unknown) => {
			const text = typeof msg === "string" ? msg : JSON.stringify(msg);
			console.error(`[mcp-server] adapter message: ${text}`);
		},
	};
	host.attachChannel(channel);

	// Step 5: Create MCP Server
	const server = new Server(
		{ name: SERVER_NAME, version: SERVER_VERSION },
		{ capabilities: { tools: {} } },
	);

	// Step 6: Set request handlers (ListTools filtered to the active tool surface)
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		const active = host.getActiveTools();
		const visibleNames = active.length > 0 ? active : [...host.tools.keys()];
		const mcpTools = visibleNames
			.map((name) => host.tools.get(name))
			.filter((tool): tool is NonNullable<typeof tool> => Boolean(tool))
			.map((tool) => ({
				name: tool.name,
				description: tool.description || `MCP proxy tool: ${tool.name}`,
				inputSchema: tool.parameters || { type: "object", properties: {} },
			}));
		console.error(`[mcp-server] list-tools: ${mcpTools.length} tools`);
		return { tools: mcpTools };
	});

	// The context is built before the transport handshake so capability
	// discovery can mutate it (Pitfall 4) before fireSessionStart() consumes it.
	const ctx = {
		cwd: process.cwd(),
		hasUI: false,
		mode: undefined as string | undefined,
		ui: undefined as UISystem | undefined,
		modelRegistry: undefined as unknown,
		model: undefined as unknown,
		signal: undefined as AbortSignal | undefined,
		reload: undefined as (() => Promise<void>) | undefined,
		samplingProvider: undefined as unknown,
	};

	// The stdio host has no session-reload loop, so wire ctx.reload (used by the
	// engine's /mcp enable|disable flows) to the config watch: exit so the next
	// process reads the config the command just wrote (issue #34).
	ctx.reload = async () => {
		getConfigWatch()?.restartWithFreshConfig("Reload requested by host");
	};

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: callArgs } = request.params;
		const tool = host.tools.get(name);
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
			// Upstream engine tools return MCP-shaped results ({ content: [...] });
			// pass those through verbatim and stringify anything else.
			if (result && typeof result === "object" && "content" in result) {
				return result;
			}
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

	// Step 7: CRITICAL — Connect transport BEFORE fireSessionStart (Pitfall 1)
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Step 7b (issue #44): exit when the host closes stdin without a signal.
	// Installed after connect so a clean client disconnect reaps this process and
	// all its children instead of leaving orphaned watchers behind.
	if (args.exitOnEof) {
		installStdinEofGuard(host, transport);
	}

	// Step 8: CRITICAL — Check client capabilities via getClientCapabilities() (Pitfall 5)
	const clientCaps = server.getClientCapabilities();

	// Step 9: If client declares sampling capability — inject ProtocolSamplingForwarder
	// D-11: No config.settings.sampling check — pure forwarding.
	if (clientCaps?.sampling) {
		const samplingForwarder = new ProtocolSamplingForwarder(server);
		ctx.samplingProvider = samplingForwarder;
		// Pitfall 4: Set hasUI so init.ts sampling condition passes
		ctx.hasUI = true;
		console.error("[mcp-server] Sampling capability detected — ProtocolSamplingForwarder injected");
	}

	// Step 10: If client declares elicitation.form capability — inject ProtocolElicitationForwarder
	// D-11: No config.settings.elicitation check — pure forwarding.
	if (clientCaps?.elicitation?.form) {
		const elicitationForwarder = new ProtocolElicitationForwarder(server);
		const ui: UISystem = {
			notify: (message: string, level: "info" | "warning" | "error"): void => {
				const consoleMethod: "info" | "warn" | "error" =
					level === "error" ? "error" : level === "warning" ? "warn" : "info";
				console[consoleMethod](`[mcp-server] ${message}`);
			},
			form: (config: FormConfig) => elicitationForwarder.form(config),
		};
		ctx.ui = ui;
		// Pitfall 4: Set hasUI so init.ts elicitation condition passes
		ctx.hasUI = true;
		console.error("[mcp-server] Elicitation.form capability detected — ProtocolElicitationForwarder injected");
	}

	// Step 11: Fire session_start — triggers initializeMcp which reads ctx
	// with forwarders injected. T-12-11: wrap in try/catch, non-fatal.
	try {
		await host.fireSessionStart(ctx);
		console.error("[mcp-server] Session started, lazy connections initialized");
	} catch (err) {
		console.error(`[mcp-server] Session start error: ${(err as Error).message}`);
		// Non-fatal — servers connect lazily on first tool call
	}

	// Step 12: Server ready
	console.error("[mcp-server] MCP server ready via stdio");
}

main().catch((err: unknown) => {
	console.error(`[mcp-server] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});