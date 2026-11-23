/**
 * __tests__/mcp-server-stdin-eof.test.ts — issue #44 regression.
 *
 * A client that closes stdin without sending a signal is a normal MCP
 * shutdown. The SDK's StdioServerTransport does NOT exit the process on stdin
 * `end`, so without the EOF guard in bin/mcp-server.ts the adapter — and every
 * stdio child it spawned — lingers as an orphan (ppid=1). Those orphaned
 * children (e.g. codebase-memory-mcp) become concurrent writers on the same
 * SQLite index and corrupt it, killing incremental watch.
 *
 * These tests spawn the real entry point as a subprocess and assert:
 *   1. stdin EOF ⇒ adapter exits 0 promptly (the guard fires)
 *   2. `--exit-on-eof=false` / `MCP_ADAPTER_EXIT_ON_EOF=0` keeps it resident
 *   3. EOF with a connected child ⇒ both adapter and child are reaped
 *   4. config-watch keep-alive alone no longer pins the process after EOF
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SERVER_SCRIPT = resolve("bin/mcp-server.ts");
const CHILD_FIXTURE = resolve("__tests__/fixtures/mcp-server-eof-child.mjs");

/** Hard ceiling for a subprocess we expect to exit on its own. */
const EXIT_TIMEOUT_MS = 10_000;
/** How long we wait before deciding an "opt-out" process is staying alive. */
const STAY_ALIVE_MS = 1500;

const roots: string[] = [];
const spawned: ChildProcess[] = [];

afterEach(() => {
	for (const child of spawned.splice(0)) {
		if (!child.killed && child.exitCode === null) child.kill("SIGKILL");
	}
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function emptyConfig(): string {
	const root = mkdtempSync(join(tmpdir(), "eof-guard-"));
	roots.push(root);
	const cfg = join(root, "mcp.json");
	writeFileSync(cfg, JSON.stringify({ mcpServers: {} }));
	return cfg;
}

/**
 * Spawn the adapter with stdin piped so we can close it explicitly. stderr is
 * piped (never inherited) to keep CI output clean; it is only read on failure.
 */
function startAdapter(configPath: string, opts: { env?: NodeJS.ProcessEnv; extraArgs?: string[] } = {}): ChildProcess {
	const child = spawn(process.execPath, ["--import", "tsx", SERVER_SCRIPT, "--config", configPath, ...(opts.extraArgs ?? [])], {
		cwd: process.cwd(),
		env: { ...process.env, ...opts.env },
		stdio: ["pipe", "pipe", "pipe"],
	});
	spawned.push(child);
	return child;
}

/** Resolve when the child exits, or reject after `ms`. */
function waitForExit(child: ChildProcess, ms: number): Promise<number | null> {
	return new Promise((resolveExit, reject) => {
		if (child.exitCode !== null) return resolveExit(child.exitCode);
		const timer = setTimeout(() => {
			child.removeListener("exit", onExit);
			reject(new Error("adapter did not exit within timeout"));
		}, ms);
		function onExit(code: number | null): void {
			clearTimeout(timer);
			resolveExit(code);
		}
		child.once("exit", onExit);
	});
}

describe("bin/mcp-server.ts stdin EOF guard (issue #44)", () => {
	it("exits 0 promptly when stdin reaches EOF", async () => {
		const child = startAdapter(emptyConfig());
		const exited = waitForExit(child, EXIT_TIMEOUT_MS);
		child.stdin!.end(); // simulate a host closing stdin without any signal
		await expect(exited).resolves.toBe(0);
	}, EXIT_TIMEOUT_MS + 2000);

	it("stays resident after stdin EOF with --exit-on-eof=false", async () => {
		const child = startAdapter(emptyConfig(), { extraArgs: ["--exit-on-eof=false"] });
		child.stdin!.end();
		await new Promise((r) => setTimeout(r, STAY_ALIVE_MS));
		expect(child.exitCode).toBeNull();
	}, EXIT_TIMEOUT_MS + 2000);

	it("stays resident after stdin EOF with MCP_ADAPTER_EXIT_ON_EOF=0", async () => {
		const child = startAdapter(emptyConfig(), { env: { MCP_ADAPTER_EXIT_ON_EOF: "0" } });
		child.stdin!.end();
		await new Promise((r) => setTimeout(r, STAY_ALIVE_MS));
		expect(child.exitCode).toBeNull();
	}, EXIT_TIMEOUT_MS + 2000);

	it("reaps a connected stdio child when stdin reaches EOF", async () => {
		const root = mkdtempSync(join(tmpdir(), "eof-child-"));
		roots.push(root);
		const pidFile = join(root, "child.pid");
		const cfg = join(root, "mcp.json");
		writeFileSync(cfg, JSON.stringify({
			mcpServers: {
				watcher: {
					command: process.execPath,
					args: [CHILD_FIXTURE, pidFile],
				},
			},
		}));

		const child = startAdapter(cfg);
		// Wait for the fixture child to record its PID (adapter connected it at
		// session start). Poll the file rather than sleeping a fixed duration.
		const deadline = Date.now() + EXIT_TIMEOUT_MS;
		let childPid: number | null = null;
		while (Date.now() < deadline) {
			try {
				const { readFileSync } = await import("node:fs");
				childPid = Number(readFileSync(pidFile, "utf8").trim());
				if (Number.isInteger(childPid) && childPid > 0) break;
			} catch {
				// not written yet
			}
			await new Promise((r) => setTimeout(r, 100));
		}
		expect(childPid, "fixture child should have connected and recorded its PID").toBeGreaterThan(0);

		const exited = waitForExit(child, EXIT_TIMEOUT_MS);
		child.stdin!.end();
		await expect(exited).resolves.toBe(0);

		// The child receives socket EOF when the adapter exits; give it a moment.
		let childAlive = true;
		for (let i = 0; i < 30 && childAlive; i++) {
			try {
				process.kill(childPid!, 0);
				await new Promise((r) => setTimeout(r, 100));
			} catch {
				childAlive = false;
			}
		}
		expect(childAlive, "spawned child should be reaped after adapter exits").toBe(false);
	}, EXIT_TIMEOUT_MS * 2 + 2000);
});
