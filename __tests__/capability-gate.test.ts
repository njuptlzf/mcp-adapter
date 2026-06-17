/**
 * Capability Gate — universal, agent-agnostic environment detection.
 *
 * Per D-01..D-03 / TEST-01 / TEST-02:
 *   - Gate runs FIRST (this file is alphabetically / semantically first
 *     in the contract suite; vitest's order is implementation-defined
 *     but the Gate's verdict is independent of execution order).
 *   - Single signal: `adapter.getAllTools()`.
 *   - Path A: `'mcp'` in tool list → mcp proxy tool registered.
 *   - Path B: any `^<server>_` prefix → directTools mode.
 *   - Path C: neither → mcp-adapter NOT loaded as extension.
 *
 * Replaces the Pi-biased prose in SKILL.md §122-138 with a table-driven
 * parametric check that works for any AgentAPI implementation.
 */
import { describe, expect, it } from "vitest";
import { AGENT_ADAPTERS } from "../interfaces/agent-api.ts";
import { createMcpAdapter } from "../adapters/entry.ts";
import { loadMcpConfig } from "../config.ts";

type Path = "A" | "B" | "C";

interface GateVerdict {
	agent: string;
	adapter: string;
	path: Path;
	toolsSample: string[];
	resolved: string;
}

function verdictFor(agentId: string, displayName: string, tools: string[]): GateVerdict {
	const hasMcp = tools.includes("mcp");
	const hasDirectTool = tools.some((n) => /^[a-z][a-z0-9-]*_/i.test(n));
	let path: Path;
	let resolved: string;
	if (hasMcp) {
		path = "A";
		resolved = "Use Path A — mcp proxy tool registered";
	} else if (hasDirectTool) {
		path = "B";
		resolved = "Use Path B — directTools mode, individual tools registered";
	} else {
		path = "C";
		resolved = "mcp-adapter NOT loaded as extension in this environment";
	}
	return {
		agent: agentId,
		adapter: displayName,
		path,
		toolsSample: tools.slice(0, 5),
		resolved,
	};
}

describe("Capability Gate (universal, runs FIRST)", () => {
	// Build the test config from the existing loader — no server processes spawned.
	const testConfig = loadMcpConfig(undefined, process.cwd());
	const testCtx = { cwd: process.cwd(), hasUI: false };

	for (const descriptor of AGENT_ADAPTERS) {
		const adapter = descriptor.factory();

		it(`Gate: ${descriptor.id} — mcp proxy tool registered after createMcpAdapter (Path A)`, () => {
			// Wire the universal entry point — this registers the `mcp` proxy tool
			createMcpAdapter(adapter, testCtx, testConfig, null);

			// Universal signal: the only externally-observable property
			// (per RESEARCH.md Pattern 3, qoder-adapter-integration.test.ts:135)
			const tools = adapter.getAllTools().map((t) => t.name);
			expect(tools).toContain("mcp");

			const verdict = verdictFor(descriptor.id, descriptor.displayName, tools);
			expect(verdict.path).toBe("A");
			expect(verdict.resolved).toMatch(/Path A/);
		});
	}

	it("Gate verdict table covers all 3 paths (A / B / C)", () => {
		// Pure-function check: verify the verdictFor helper maps the three
		// known tool-list shapes to the three documented paths.
		expect(verdictFor("a", "A", ["mcp", "calc_add"]).path).toBe("A");
		expect(verdictFor("b", "B", ["calc_add", "calc_sub"]).path).toBe("B");
		expect(verdictFor("c", "C", []).path).toBe("C");
	});

	it("Gate Path C explicitly says 'mcp-adapter NOT loaded as extension'", () => {
		const v = verdictFor("env", "no-host", []);
		expect(v.path).toBe("C");
		expect(v.resolved).toBe("mcp-adapter NOT loaded as extension in this environment");
	});
});
