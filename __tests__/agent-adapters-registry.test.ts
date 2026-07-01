/**
 * Structural tests for the simplified AGENT_ADAPTERS registry (Phase 12, Plan 02).
 *
 * Verifies D-01 (universal-mcp + pi only) and D-04 (inline AgentAPI factory,
 * no StoreAgentAdapter import) at the registry level.
 *
 * These are structural/registry-level checks — the parametric contract tests
 * in adapter-contract.test.ts exercise the per-adapter AgentAPI surface.
 */
import { describe, expect, it } from "vitest";
import { AGENT_ADAPTERS } from "../interfaces/agent-api.ts";
import type { AgentAPI } from "../interfaces/agent-api.ts";
import { createUniversalResolver } from "../interfaces/agent-paths.ts";

describe("AGENT_ADAPTERS registry — Phase 12 simplification (D-01, D-04)", () => {
	it("has exactly 2 entries", () => {
		expect(AGENT_ADAPTERS).toHaveLength(2);
	});

	it("first entry is universal-mcp", () => {
		expect(AGENT_ADAPTERS[0].id).toBe("universal-mcp");
	});

	it("second entry is pi", () => {
		expect(AGENT_ADAPTERS[1].id).toBe("pi");
	});

	it("does NOT contain kilo or qoder entries", () => {
		const ids = AGENT_ADAPTERS.map((a) => a.id);
		expect(ids).not.toContain("kilo");
		expect(ids).not.toContain("qoder");
	});

	describe("universal-mcp entry", () => {
		const universal = AGENT_ADAPTERS.find((a) => a.id === "universal-mcp");

		it("exists", () => {
			expect(universal).toBeDefined();
		});

		it("has displayName 'Universal MCP'", () => {
			expect(universal?.displayName).toBe("Universal MCP");
		});

		it("has resolverFactory pointing to createUniversalResolver", () => {
			const resolver = universal!.resolverFactory();
			expect(resolver.agentId).toBe("universal-mcp");
			expect(resolver.globalConfigPath()).toBe(
				createUniversalResolver().globalConfigPath(),
			);
			expect(resolver.projectConfigName()).toBe(".mcp.json");
		});

		it("has envHints with MCP_CONFIG_PATH", () => {
			expect(universal?.envHints).toEqual([{ envVar: "MCP_CONFIG_PATH" }]);
		});

		it("has capabilities { ui: false, sampling: false, renderer: false }", () => {
			expect(universal?.capabilities).toEqual({
				ui: false,
				sampling: false,
				renderer: false,
			});
		});

		it("factory returns an object implementing all 8 AgentAPI methods", () => {
			const adapter: AgentAPI = universal!.factory();
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

		it("factory returns a fresh object each call (T-12-05: no shared state)", () => {
			const a1 = universal!.factory();
			const a2 = universal!.factory();
			a1.registerTool({ name: "tool-a", execute: () => {} });
			// a2 should NOT see tool-a — no module-level shared Map
			expect(a2.getAllTools().some((t) => t.name === "tool-a")).toBe(false);
		});

		it("factory returns object with working registerTool + getAllTools round-trip", () => {
			const adapter = universal!.factory();
			adapter.registerTool({ name: "test-tool", execute: () => {} });
			expect(adapter.getAllTools().some((t) => t.name === "test-tool")).toBe(true);
		});

		it("factory returns object with working registerFlag + getFlag", () => {
			const adapter = universal!.factory();
			adapter.registerFlag("my-flag", { description: "test" });
			expect(adapter.getFlag("my-flag")).toBeUndefined();
		});

		it("factory returns object with working registerCommand (no throw)", () => {
			const adapter = universal!.factory();
			expect(() =>
				adapter.registerCommand("cmd", { description: "c", handler: () => {} }),
			).not.toThrow();
		});

		it("factory returns object with working on (no throw)", () => {
			const adapter = universal!.factory();
			expect(() => adapter.on("event", () => {})).not.toThrow();
		});

		it("factory returns object with sendMessage as no-op (no throw)", () => {
			const adapter = universal!.factory();
			expect(() => adapter.sendMessage({ msg: "hello" })).not.toThrow();
		});

		it("factory returns object with exec returning a resolved Promise", () => {
			const adapter = universal!.factory();
			expect(adapter.exec("echo", [])).toBeInstanceOf(Promise);
		});

		it("has createVerificationContext", () => {
			expect(typeof universal?.createVerificationContext).toBe("function");
		});

		it("createVerificationContext returns { cwd, hasUI }", () => {
			const ctx = universal!.createVerificationContext!(
				{ cwd: "/test", hasUI: true },
				universal!.factory(),
			);
			expect(ctx.cwd).toBe("/test");
			expect(ctx.hasUI).toBe(true);
		});
	});

	describe("pi entry (unchanged)", () => {
		const pi = AGENT_ADAPTERS.find((a) => a.id === "pi");

		it("exists", () => {
			expect(pi).toBeDefined();
		});

		it("has displayName 'Pi'", () => {
			expect(pi?.displayName).toBe("Pi");
		});

		it("has capabilities { ui: true, sampling: true, renderer: true }", () => {
			expect(pi?.capabilities).toEqual({
				ui: true,
				sampling: true,
				renderer: true,
			});
		});

		it("has envHints with PI_CODING_AGENT_DIR", () => {
			expect(pi?.envHints).toEqual([{ envVar: "PI_CODING_AGENT_DIR" }]);
		});
	});
});
