/**
 * Adapter contract tests for the universal AgentAPI surface.
 *
 * Purpose: REQ-07 requires that the adapter pattern works for *any*
 * AgentAPI implementation, not just Pi. This file exercises the contract
 * by feeding a fully-mock AgentAPI through the same code paths PiAdapter
 * uses, ensuring the surface is implementation-agnostic.
 *
 * The MockAgentAPI class is defined inline (not imported from
 * mock-adapter.test.ts) so this test file can stand on its own and serve
 * as a contract reference for future adapter authors.
 */

import { describe, expect, it, vi } from "vitest";
import type {
	AgentAPI,
	AgentContext,
	CommandConfig,
	FlagConfig,
	FormConfig,
	FormResult,
	ToolInfo,
	ToolRegistration,
	UISystem,
} from "../interfaces/agent-api.ts";
import { PiAdapter } from "../adapters/pi-adapter.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadMcpConfig } from "../config.ts";

type StoredFlag = FlagConfig & { value?: string };

class MockUISystem implements UISystem {
	notified: Array<{ message: string; level: "info" | "warning" | "error" }> =
		[];
	statuses = new Map<string, string | undefined>();
	formHandler: ((config: FormConfig) => Promise<FormResult>) | undefined =
		undefined;
	themeFg: ((color: string, text: string) => string) | undefined = undefined;

	notify(message: string, level: "info" | "warning" | "error"): void {
		this.notified.push({ message, level });
	}

	setStatus(key: string, value: string | undefined): void {
		this.statuses.set(key, value);
	}

	form(config: FormConfig): Promise<FormResult> {
		if (!this.formHandler) return Promise.resolve({ action: "cancel" });
		return this.formHandler(config);
	}

	theme = this.themeFg
		? { fg: (c: string, t: string) => this.themeFg!(c, t) }
		: {};
}

class MockAgentAPI implements AgentAPI {
	tools: ToolRegistration[] = [];
	commands = new Map<string, CommandConfig>();
	flags = new Map<string, StoredFlag>();
	messages: Array<{ message: unknown; options?: unknown }> = [];
	execResults: Array<{ command: string; args: string[]; result: unknown }> = [];

	registerTool(tool: ToolRegistration): void {
		this.tools.push(tool);
	}
	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}
	registerFlag(name: string, config: FlagConfig): void {
		this.flags.set(name, { ...config } as StoredFlag);
	}
	on(_event: string, _handler: (...args: unknown[]) => unknown): void {
		/* no-op for contract test */
	}
	getAllTools(): ToolInfo[] {
		return this.tools.map((t) => ({ name: t.name }));
	}
	getFlag(name: string): string | undefined {
		return this.flags.get(name)?.value;
	}
	sendMessage(message: unknown, options?: unknown): void {
		this.messages.push({ message, options });
	}
	async exec(command: string, args: string[]): Promise<unknown> {
		const r = { code: 0, stdout: "", stderr: "" };
		this.execResults.push({ command, args, result: r });
		return r;
	}
}

describe("AgentAPI contract", () => {
	it("Test 1: any AgentAPI implementation must expose all required methods", () => {
		const mock = new MockAgentAPI();
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
});

describe("AgentContext contract", () => {
	it("Test 2: AgentContext requires cwd and hasUI; ui is optional", () => {
		const ctx: AgentContext = { cwd: "/work", hasUI: true };
		expect(ctx.cwd).toBe("/work");
		expect(ctx.hasUI).toBe(true);
		// ui is optional, may be undefined
		expect(ctx.ui).toBeUndefined();
	});
});

describe("UISystem contract", () => {
	it("Test 3: UISystem requires notify; all other members are optional", () => {
		const minimal: UISystem = { notify: () => {} };
		expect(typeof minimal.notify).toBe("function");
		// Optional members absent
		expect(minimal.setStatus).toBeUndefined();
		expect(minimal.form).toBeUndefined();
		expect(minimal.custom).toBeUndefined();
		expect(minimal.theme).toBeUndefined();
	});

	it("Test 3b: full UISystem shape works for agents that expose everything", () => {
		const ui = new MockUISystem();
		ui.setStatus("k", "v");
		expect(ui.statuses.get("k")).toBe("v");
	});
});

describe("Adapter pattern universality", () => {
	it("Test 4: a MockAgentAPI can be used wherever AgentAPI is required", () => {
		const mock = new MockAgentAPI();
		const consumer = (api: AgentAPI) => {
			api.registerTool({ name: "x", execute: vi.fn() });
			api.registerCommand("c", { description: "c", handler: vi.fn() });
			api.registerFlag("f", { description: "f" });
			return api.getAllTools().length;
		};
		expect(consumer(mock)).toBe(1);
	});

	it("Test 4b: PiAdapter satisfies the same AgentAPI surface", () => {
		const pi: ExtensionAPI = {
			registerTool: vi.fn(),
			registerCommand: vi.fn(),
			registerFlag: vi.fn(),
			on: vi.fn(),
			getAllTools: vi.fn(() => []),
			getFlag: vi.fn(() => undefined),
			sendMessage: vi.fn(),
			exec: vi.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
		} as unknown as ExtensionAPI;
		const adapter: AgentAPI = new PiAdapter(pi);
		const tools = adapter.getAllTools();
		expect(Array.isArray(tools)).toBe(true);
		adapter.registerTool({ name: "via-pi-adapter" });
		expect(pi.registerTool).toHaveBeenCalled();
	});
});

describe("initializeMcp contract compatibility", () => {
	it("Test 5: loadMcpConfig is reachable from the contract test path", () => {
		// Demonstrates the same config-loading call that initializeMcp makes
		// can be invoked with no preconditions — the contract does not depend
		// on Pi-specific wiring.
		const config = loadMcpConfig(undefined, "/tmp");
		expect(config).toBeDefined();
		expect(config.mcpServers).toBeDefined();
	});
});
