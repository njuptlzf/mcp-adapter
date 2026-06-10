import { describe, expect, it, vi } from "vitest";
import { PiAdapter } from "../adapters/pi-adapter.ts";
import mcpAdapter, { piMcpAdapter, PiAdapter as RePiAdapter, adaptPiContext } from "../index.ts";
import type { AgentAPI, AgentContext, UISystem } from "../interfaces/agent-api.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function makePiMock(): ExtensionAPI {
	const session_start = vi.fn();
	const session_shutdown = vi.fn();
	const exec = vi.fn(async (_cmd: string, _args: string[]) => ({ code: 0, stdout: "", stderr: "" }));
	return {
		registerTool: vi.fn(),
		registerCommand: vi.fn(),
		registerFlag: vi.fn(),
		on: vi.fn((event: string, handler: unknown) => {
			if (event === "session_start") session_start(handler);
			if (event === "session_shutdown") session_shutdown(handler);
		}),
		getAllTools: vi.fn(() => []),
		getFlag: vi.fn(() => undefined),
		sendMessage: vi.fn(),
		exec,
	} as unknown as ExtensionAPI;
}

describe("integration: mcpAdapter backward compatibility", () => {
	it("still accepts the original Pi ExtensionAPI and returns void", () => {
		const pi = makePiMock();
		expect(() => mcpAdapter(pi)).not.toThrow();
	});

	it("registers the mcp flag at minimum", () => {
		const pi = makePiMock();
		mcpAdapter(pi);
		const registerFlag = pi.registerFlag as unknown as ReturnType<typeof vi.fn>;
		expect(registerFlag).toHaveBeenCalledWith("mcp-config", expect.objectContaining({ type: "string" }));
	});

	it("registers both mcp and mcp-auth commands", () => {
		const pi = makePiMock();
		mcpAdapter(pi);
		const registerCommand = pi.registerCommand as unknown as ReturnType<typeof vi.fn>;
		const names = registerCommand.mock.calls.map(([name]) => name);
		expect(names).toContain("mcp");
		expect(names).toContain("mcp-auth");
	});

	it("registers a session_start and session_shutdown event handler", () => {
		const pi = makePiMock();
		mcpAdapter(pi);
		const on = pi.on as unknown as ReturnType<typeof vi.fn>;
		const events = on.mock.calls.map(([event]) => event);
		expect(events).toContain("session_start");
		expect(events).toContain("session_shutdown");
	});

	it("piMcpAdapter is the same function as the default mcpAdapter", () => {
		expect(piMcpAdapter).toBe(mcpAdapter);
	});
});

describe("integration: universal adapter entry points", () => {
	it("exports PiAdapter and adaptPiContext as named exports from index.ts", () => {
		expect(RePiAdapter).toBe(PiAdapter);
		expect(typeof adaptPiContext).toBe("function");
	});

	it("exports AgentAPI, AgentContext, UISystem as types (compile-time check)", () => {
		// Use the types so a missing export would be a TypeScript error.
		const _agentApi: AgentAPI = new PiAdapter(makePiMock());
		const _ui: UISystem = {
			notify: () => {},
		};
		const _ctx: AgentContext = {
			cwd: "/tmp",
			hasUI: false,
		};
		expect(_agentApi).toBeDefined();
		expect(_ui).toBeDefined();
		expect(_ctx).toBeDefined();
	});
});

describe("integration: PiAdapter can be instantiated separately from mcpAdapter", () => {
	it("PiAdapter can be constructed directly with an ExtensionAPI-shaped object", () => {
		const pi = {
			registerTool: vi.fn(),
			registerCommand: vi.fn(),
			registerFlag: vi.fn(),
			on: vi.fn(),
			getAllTools: vi.fn(() => []),
			getFlag: vi.fn(() => undefined),
			sendMessage: vi.fn(),
			exec: vi.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
		};
		const adapter = new PiAdapter(pi as unknown as ExtensionAPI);
		adapter.registerTool({ name: "x" });
		expect(pi.registerTool).toHaveBeenCalledWith({ name: "x" });
	});

	it("PiAdapter and mcpAdapter can coexist without interference", () => {
		const pi = makePiMock();
		const adapter = new PiAdapter(pi);
		mcpAdapter(pi);
		adapter.registerTool({ name: "via-adapter" });
		const registerTool = pi.registerTool as unknown as ReturnType<typeof vi.fn>;
		// mcpAdapter also calls registerTool (for direct tools + proxy)
		expect(registerTool).toHaveBeenCalled();
		const adapterCall = registerTool.mock.calls.find(([tool]) => (tool as { name?: string })?.name === "via-adapter");
		expect(adapterCall).toBeDefined();
	});
});
