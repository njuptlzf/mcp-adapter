#!/usr/bin/env npx tsx
/**
 * Universal mcp-adapter deployment verification (Stage 2: fork-host).
 *
 * Verifies that the published package builds & installs: loads config, installs
 * the UPSTREAM engine (`index.ts`'s `createMcpAdapter`) onto a `UniversalMcpHost`,
 * and confirms the `mcp` proxy tool is registered.
 *
 * Usage:
 *   npx tsx scripts/deploy-verify.ts                 # verify against ./.mcp.json
 *   npx tsx scripts/deploy-verify.ts --config ./.mcp.json
 */

import { resolve } from "node:path";
import { createMcpAdapter } from "../index.ts";
import { UniversalMcpHost } from "../adapters/universal-host.ts";
import { loadMcpConfig } from "../config.ts";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_MCP_JSON_PATH = resolve(PROJECT_ROOT, ".mcp.json");

const LOG = (msg: string) => process.stdout.write(`[deploy-verify] ${msg}\n`);

interface ParsedArgs {
	configPath?: string;
	showHelp: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
	let configPath: string | undefined;
	let showHelp = false;

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			showHelp = true;
		} else if (arg === "--config") {
			configPath = argv[++i];
			if (!configPath) throw new Error("--config requires a path argument");
		} else if (arg.startsWith("--config=")) {
			configPath = arg.slice("--config=".length);
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	return { configPath, showHelp };
}

function showHelp(): void {
	LOG(`Universal mcp-adapter deployment verification

Usage:
  npx tsx scripts/deploy-verify.ts [options]

Options:
  --config <path>   Path to mcp.json (default: ${DEFAULT_MCP_JSON_PATH})
  --help            Show this help

The script installs the upstream engine onto a UniversalMcpHost and confirms
the mcp proxy tool is registered.`);
}

async function verifyUniversalHost(configPath: string): Promise<boolean> {
	LOG(`Using config: ${configPath}`);

	// 1. Create host + install upstream engine
	const host = new UniversalMcpHost();
	const config = loadMcpConfig(configPath);
	createMcpAdapter({ config })(host);
	LOG("Upstream engine installed onto UniversalMcpHost");

	// 2. Verify mcp proxy tool registration
	const tools = host.getAllTools();
	LOG(`Tools registered: ${tools.map((t) => t.name).join(", ")}`);
	const hasProxyTool = tools.some((t) => t.name === "mcp");
	if (!hasProxyTool) {
		LOG("❌ mcp proxy tool NOT found!");
		return false;
	}
	LOG("✅ mcp proxy tool registered");

	// 3. Verify the tool surface is active (auto-activation on register)
	const active = host.getActiveTools();
	LOG(`Active tools: ${active.join(", ")}`);
	if (!active.includes("mcp")) {
		LOG("❌ mcp proxy tool missing from active surface!");
		return false;
	}
	LOG("✅ active tool surface correct");

	return true;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv);

	if (args.showHelp) {
		showHelp();
		return;
	}

	const configPath = resolve(args.configPath ?? DEFAULT_MCP_JSON_PATH);

	try {
		const ok = await verifyUniversalHost(configPath);
		if (!ok) process.exit(1);
		LOG("\n✅ Universal host deployment verification passed.");
	} catch (error) {
		LOG(`❌ Verification failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

void main();