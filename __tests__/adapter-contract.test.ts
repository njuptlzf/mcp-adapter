/**
 * Parametric AgentAPI contract tests.
 *
 * Per D-04 / D-09 (Phase 7 CONTEXT): one file covers all registered
 * adapters via `describe.each(AGENT_ADAPTERS.map(...))`. The contract
 * cases for the 8-method AgentAPI surface expand automatically across
 * every adapter registered in `interfaces/agent-api.ts`.
 *
 * Adding a new adapter to AGENT_ADAPTERS = zero edits here.
 *
 * Per D-06: the server-compatibility cases run once on MockAgentAPI
 * (server-agnostic). Set AGENT_API_FULL_MATRIX=1 to run them per-adapter
 * in a future plan; this file keeps the default CI run lightweight.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AgentAPI,
	AgentContext,
	UISystem,
} from "../interfaces/agent-api.ts";
import { AGENT_ADAPTERS } from "../interfaces/agent-api.ts";
import { MockAgentAPI } from "./fixtures/mock-agent-api.ts";
import { loadMcpConfig } from "../config.ts";

// StoreAgentAdapter (adapters/store-adapter.ts) is tested indirectly through
// QoderAdapter and KiloAdapter, both of which extend it. The AgentAPI contract
// methods exercised here are implemented in StoreAgentAdapter.

describe.each(
	AGENT_ADAPTERS.map((a) => [a.id, a.factory] as const),
)("AgentAPI contract — adapter: %s", (_id, factory) => {
	let adapter: AgentAPI;

	beforeEach(() => {
		// Fresh adapter per test → no cross-adapter state leak (D-04 isolation)
		adapter = factory();
	});

	it("Test 1: exposes all 8 required methods as functions", () => {
		const required: Array<keyof AgentAPI> = [
			"registerTool",
			"registerCommand",
			"registerFlag",
			"on",
			"getAllTools",
			"getFlag",
			"sendMessage",
			"exec",
		];
		for (const m of required) {
			expect(typeof adapter[m]).toBe("function");
		}
	});

	it("Test 2: registerTool stores the tool (visible via getAllTools)", () => {
		adapter.registerTool({ name: "x", execute: vi.fn() });
		const tools = adapter.getAllTools();
		expect(tools.some((t) => t.name === "x")).toBe(true);
	});

	it("Test 3: registerCommand and registerFlag accept their config shapes", () => {
		expect(() =>
			adapter.registerCommand("c", { description: "c", handler: vi.fn() }),
		).not.toThrow();
		expect(() =>
			adapter.registerFlag("f", { description: "f" }),
		).not.toThrow();
	});

	it("Test 4: getAllTools returns ToolInfo[] (array shape)", () => {
		expect(Array.isArray(adapter.getAllTools())).toBe(true);
	});

	it("Test 5: getFlag returns string | undefined for unknown flags", () => {
		expect(adapter.getFlag("nonexistent-flag-xyz")).toBeUndefined();
	});

	it("Test 6: sendMessage and exec accept their declared signatures", () => {
		expect(() => adapter.sendMessage({ msg: "hello" })).not.toThrow();
		expect(adapter.exec("echo", [])).toBeInstanceOf(Promise);
	});
});

describe("AgentAPI contract — server compatibility via MockAgentAPI (D-06)", () => {
	let mock: MockAgentAPI;

	beforeEach(() => {
		mock = new MockAgentAPI();
	});

	it("Test 7: MockAgentAPI satisfies the same 8-method surface (server-agnostic)", () => {
		const required: Array<keyof AgentAPI> = [
			"registerTool",
			"registerCommand",
			"registerFlag",
			"on",
			"getAllTools",
			"getFlag",
			"sendMessage",
			"exec",
		];
		for (const m of required) {
			expect(typeof mock[m]).toBe("function");
		}
	});

	it("Test 8: AgentContext requires cwd and hasUI; ui is optional", () => {
		const ctx: AgentContext = { cwd: "/work", hasUI: true };
		expect(ctx.cwd).toBe("/work");
		expect(ctx.hasUI).toBe(true);
		expect(ctx.ui).toBeUndefined();
	});

	it("Test 9: UISystem minimum surface is just notify", () => {
		const minimal: UISystem = { notify: () => {} };
		expect(typeof minimal.notify).toBe("function");
		expect(minimal.setStatus).toBeUndefined();
		expect(minimal.form).toBeUndefined();
	});

	it("Test 10: loadMcpConfig is reachable from the contract test path", () => {
		const config = loadMcpConfig(undefined, "/tmp");
		expect(config).toBeDefined();
		expect(config.mcpServers).toBeDefined();
	});
});
