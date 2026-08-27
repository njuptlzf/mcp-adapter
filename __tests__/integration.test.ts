/**
 * Integration tests for the Stage 2 fork-host wiring: the upstream engine
 * (`index.ts`) installs onto a `UniversalMcpHost` that presents the Pi
 * `ExtensionAPI` surface.
 *
 * Replaces the pre-Stage-2 integration test that exercised the retired
 * parallel abstraction (`PiAdapter`, `piMcpAdapter`, `adaptPiContext` exports).
 */

import { describe, expect, it } from "vitest";
import mcpAdapter, { createMcpAdapter } from "../index.ts";
import { UniversalMcpHost } from "../adapters/universal-host.ts";

describe("integration: UniversalMcpHost + upstream engine", () => {
	it("default export installs onto a UniversalMcpHost and returns void", () => {
		const host = new UniversalMcpHost();
		expect(() => mcpAdapter(host)).not.toThrow();
	});

	it("registers mcp proxy tool, mcpScript, commands, and mcp-config flag", () => {
		const host = new UniversalMcpHost();
		mcpAdapter(host);

		expect(host.tools.has("mcp")).toBe(true);
		expect(host.tools.has("mcpScript")).toBe(true);
		expect(host.commands.has("mcp")).toBe(true);
		expect(host.commands.has("mcp-auth")).toBe(true);
		expect(host.flags.has("mcp-config")).toBe(true);
	});

	it("auto-activates registered tools on the active surface", () => {
		const host = new UniversalMcpHost();
		mcpAdapter(host);

		expect(host.getActiveTools()).toContain("mcp");
		expect(host.getAllTools().map((t) => t.name)).toContain("mcp");
	});

	it("createMcpAdapter({ config }) installs a programmatic config deterministically", () => {
		const host = new UniversalMcpHost();
		createMcpAdapter({ config: { mcpServers: {} } })(host);

		expect(host.tools.has("mcp")).toBe(true);
		expect(host.getActiveTools()).toContain("mcp");
	});
});