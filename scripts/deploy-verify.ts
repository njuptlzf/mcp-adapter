#!/usr/bin/env npx tsx
/**
 * Universal mcp-adapter deployment verification.
 *
 * Exercises the deployment flow for every registered adapter that provides a
 * `createVerificationContext` harness (SDK-bridge and stdio-server adapters).
 * Adapters that require a live native runtime (e.g. Pi's ExtensionAPI) are
 * skipped by design.
 *
 * Usage:
 *   npx tsx scripts/deploy-verify.ts                    # verify all harnessed adapters
 *   npx tsx scripts/deploy-verify.ts --agent qoder      # verify one adapter
 *   npx tsx scripts/deploy-verify.ts --config ./.mcp.json
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMcpAdapter } from "../adapters/entry.ts";
import { AGENT_ADAPTERS } from "../interfaces/agent-api.ts";
import type { AgentAPI, AgentContext } from "../interfaces/agent-api.ts";
import { loadMcpConfig } from "../config.ts";
import { loadMetadataCache } from "../metadata-cache.ts";
import type { McpConfig } from "../types.ts";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_MCP_JSON_PATH = resolve(PROJECT_ROOT, ".mcp.json");

const LOG = (msg: string) => process.stdout.write(`[deploy-verify] ${msg}\n`);

interface ParsedArgs {
	agentId?: string;
	configPath?: string;
	showHelp: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
	let agentId: string | undefined;
	let configPath: string | undefined;
	let showHelp = false;

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			showHelp = true;
		} else if (arg === "--agent") {
			agentId = argv[++i];
			if (!agentId) throw new Error("--agent requires a value");
		} else if (arg.startsWith("--agent=")) {
			agentId = arg.slice("--agent=".length);
		} else if (arg === "--config") {
			configPath = argv[++i];
			if (!configPath) throw new Error("--config requires a value");
		} else if (arg.startsWith("--config=")) {
			configPath = arg.slice("--config=".length);
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	return { agentId, configPath, showHelp };
}

function showHelp(): void {
	LOG(`Universal mcp-adapter deployment verification

Usage:
  npx tsx scripts/deploy-verify.ts [options]

Options:
  --agent <id>      Verify a single registered adapter (default: all harnessed adapters)
  --config <path>   Path to mcp.json (default: ${DEFAULT_MCP_JSON_PATH})
  --help            Show this help

The script reads the AGENT_ADAPTERS registry in interfaces/agent-api.ts and runs
verification on every adapter that exposes createVerificationContext. Adapters
that need a live native runtime (e.g. Pi) are skipped.`);
}

async function loadConfig(configPath: string): Promise<McpConfig> {
	const raw = await readFile(configPath, "utf8");
	return JSON.parse(raw) as McpConfig;
}

function hasLifecycle(adapter: AgentAPI): {
	fireSessionStart?: (ctx: AgentContext) => Promise<void>;
	fireSessionShutdown?: () => Promise<void>;
} {
	const a = adapter as {
		fireSessionStart?: (ctx: AgentContext) => Promise<void>;
		fireSessionShutdown?: () => Promise<void>;
	};
	return {
		fireSessionStart: a.fireSessionStart
			? (ctx) => a.fireSessionStart!(ctx)
			: undefined,
		fireSessionShutdown: a.fireSessionShutdown
			? () => a.fireSessionShutdown!()
			: undefined,
	};
}

async function verifyAdapter(
	descriptor: (typeof AGENT_ADAPTERS)[number],
	configPath: string,
): Promise<boolean> {
	LOG(`\n=== Verifying ${descriptor.displayName} (${descriptor.id}) ===`);

	if (!descriptor.createVerificationContext) {
		LOG(`⏭️  skipped — no verification harness (live native runtime required)`);
		return true;
	}

	// 1. Create adapter instance
	const adapter = descriptor.factory();
	LOG(`Adapter instance created`);

	// 2. Build verification context
	const ctx = descriptor.createVerificationContext(
		{ cwd: PROJECT_ROOT, hasUI: descriptor.capabilities?.ui ?? false },
		adapter,
	);
	LOG(`AgentContext built: cwd=${ctx.cwd}, hasUI=${ctx.hasUI}`);

	// 3. Resolve config paths
	const resolver = descriptor.resolverFactory();
	LOG(`Resolver: agentId=${resolver.agentId}, globalConfigPath=${resolver.globalConfigPath()}`);

	// 4. Load config (prefer explicit --config, then resolver global path)
	const config = loadMcpConfig(configPath);
	const serverCount = Object.keys(config.mcpServers || {}).length;
	LOG(`Config loaded: ${serverCount} MCP server(s)`);
	for (const name of Object.keys(config.mcpServers || {})) {
		LOG(`  - ${name}`);
	}

	// 5. Load metadata cache (optional)
	const cache = loadMetadataCache();

	// 6. Wire through universal entry point
	createMcpAdapter(adapter, ctx, config, cache);
	LOG(`createMcpAdapter() completed`);

	// 7. Verify proxy tool registration
	const tools = adapter.getAllTools();
	LOG(`Tools registered: ${tools.map((t) => t.name).join(", ")}`);
	const hasProxyTool = tools.some((t) => t.name === "mcp");
	if (!hasProxyTool) {
		LOG("❌ mcp proxy tool NOT found!");
		return false;
	}
	LOG("✅ mcp proxy tool registered successfully (~250 tokens)");

	// 8. Fire session lifecycle (lazy server connections)
	const lifecycle = hasLifecycle(adapter);
	if (lifecycle.fireSessionStart) {
		LOG("Firing session_start...");
		await lifecycle.fireSessionStart(ctx);
		LOG("session_start completed — servers will lazy-connect on first tool call");
	}

	LOG(`✅ ${descriptor.displayName} verification passed`);

	if (lifecycle.fireSessionShutdown) {
		LOG("Firing session_shutdown...");
		await lifecycle.fireSessionShutdown();
	}

	return true;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv);

	if (args.showHelp) {
		showHelp();
		return;
	}

	const configPath = resolve(args.configPath ?? DEFAULT_MCP_JSON_PATH);
	LOG(`Using config: ${configPath}`);

	const descriptors = args.agentId
		? AGENT_ADAPTERS.filter((d) => d.id === args.agentId)
		: AGENT_ADAPTERS;

	if (descriptors.length === 0) {
		LOG(`❌ No adapter found for id: ${args.agentId}`);
		process.exit(1);
	}

	const results = new Map<string, boolean>();
	for (const descriptor of descriptors) {
		try {
			const ok = await verifyAdapter(descriptor, configPath);
			results.set(descriptor.id, ok);
		} catch (error) {
			LOG(`❌ ${descriptor.displayName} verification failed: ${error instanceof Error ? error.message : String(error)}`);
			results.set(descriptor.id, false);
		}
	}

	// Summary
	LOG("\n=== Verification Summary ===");
	for (const [id, ok] of results) {
		const descriptor = AGENT_ADAPTERS.find((d) => d.id === id);
		LOG(`${ok ? "✅" : "❌"} ${descriptor?.displayName ?? id}`);
	}

	const allPassed = Array.from(results.values()).every(Boolean);
	if (!allPassed) {
		process.exit(1);
	}

	LOG("\n✅ All verified adapters passed.");
}

void main();
