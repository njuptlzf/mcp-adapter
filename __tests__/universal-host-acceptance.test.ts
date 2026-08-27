/**
 * Phase 1.6 acceptance — the upstream engine (`index.ts`) installed onto a
 * `UniversalMcpHost` exposes the surface documented in
 * `docs/phase0-feature-diff-checklist.md`.
 *
 * These tests target the checklist items that are observable at the *host
 * boundary* (tool surface, runtime registration, lifecycle/status events).
 * Items that live inside `init.ts`/`index.ts` engine internals are covered by
 * `__tests__/index-lifecycle.test.ts` (58) and `__tests__/runtime-register.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createMcpAdapter, registerMcpServer } from "../index.ts";
import { UniversalMcpHost } from "../adapters/universal-host.ts";
import { MCP_STATUS_EVENT } from "../types.ts";

function install(): UniversalMcpHost {
	const host = new UniversalMcpHost();
	createMcpAdapter({ config: { mcpServers: {} } })(host as unknown as ExtensionAPI);
	return host;
}

describe("Phase 1.6 acceptance: UniversalMcpHost + upstream engine", () => {
	it("C1: registers mcp proxy tool + mcpScript batch tool (scriptMode default on)", () => {
		const host = install();
		expect(host.tools.has("mcp")).toBe(true);
		expect(host.tools.has("mcpScript")).toBe(true);
		expect(host.getActiveTools()).toEqual(expect.arrayContaining(["mcp", "mcpScript"]));
	});

	it("C2: proxy tool exposes the rich schema (args object|string, instructions, limit, offset, server)", () => {
		const host = install();
		const params = host.tools.get("mcp")?.parameters as
			| { properties?: Record<string, unknown> }
			| undefined;
		const props = Object.keys(params?.properties ?? {});
		expect(props).toEqual(
			expect.arrayContaining(["tool", "args", "instructions", "limit", "offset", "server", "action"]),
		);
	});

	it("C5: active tool surface is engine-driven (setActiveTools narrows; getActiveTools reflects it)", () => {
		const host = install();
		host.setActiveTools(["mcp"]);
		expect(host.getActiveTools()).toEqual(["mcp"]);
		expect(host.getAllTools().map((t) => t.name)).toEqual(expect.arrayContaining(["mcp", "mcpScript"]));
	});

	it("A-lifecycle: session_start / input / session_shutdown handlers fire without throwing", async () => {
		const host = install();
		const ctx = { cwd: process.cwd(), hasUI: false, mode: "stdio" };
		await expect(host.fireSessionStart(ctx)).resolves.toBeUndefined();
		await expect(host.fireInput()).resolves.toBeUndefined();
		await expect(host.fireSessionShutdown()).resolves.toBeUndefined();
	});

	it("D2: status event bus is wired (session_shutdown publishes MCP_STATUS_EVENT)", async () => {
		const host = install();
		const received: unknown[] = [];
		host.events.on(MCP_STATUS_EVENT, (payload) => received.push(payload));
		await host.fireSessionShutdown();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(received.length).toBeGreaterThan(0);
	});

	it("D1: registerMcpServer rejects an uninstalled host (runtimeRegistrars lookup)", () => {
		const uninstalled = new UniversalMcpHost();
		expect(() =>
			registerMcpServer({
				pi: uninstalled as unknown as ExtensionAPI,
				name: "runtime",
				definition: { command: "node" } as never,
			}),
		).toThrow(/not installed/);
	});
});