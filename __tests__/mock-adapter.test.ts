/**
 * Mock adapter tests for the universal AgentAPI / AgentContext / UISystem contract.
 *
 * Purpose: REQ-07 demands a test that any AgentAPI implementation satisfies
 * the contract used by `init.ts` and the rest of the adapter. PiAdapter is
 * a pass-through wrapper around Pi's ExtensionAPI, so we cannot reuse it in
 * isolation. This file defines an in-memory `MockAgentAPI` and exercises the
 * shape of the contract that all concrete adapters must implement.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
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

class MockUISystem implements UISystem {
	notified: Array<{ message: string; level: "info" | "warning" | "error" }> =
		[];
	statuses = new Map<string, string | undefined>();
	formHandler: ((config: FormConfig) => Promise<FormResult>) | undefined =
		undefined;
	customRenderers: Array<{ renderer: unknown; options?: unknown }> = [];
	themeFg: ((color: string, text: string) => string) | undefined = undefined;

	notify(message: string, level: "info" | "warning" | "error"): void {
		this.notified.push({ message, level });
	}

	setStatus(key: string, value: string | undefined): void {
		this.statuses.set(key, value);
	}

	form(config: FormConfig): Promise<FormResult> {
		if (!this.formHandler) {
			return Promise.resolve({ action: "cancel" });
		}
		return this.formHandler(config);
	}

	custom(renderer: unknown, options?: unknown): void {
		this.customRenderers.push({ renderer, options });
	}

	setThemeFg(fn: (color: string, text: string) => string): void {
		this.themeFg = fn;
	}

	get theme(): { fg?: (color: string, text: string) => string } {
		return this.themeFg ? { fg: this.themeFg } : {};
	}
}

class MockAgentContext implements AgentContext {
	uiSystem = new MockUISystem();
	cwd: string;
	hasUI: boolean;
	model: unknown;
	modelRegistry: unknown;
	signal: AbortSignal | undefined;
	reload: () => Promise<void>;

	constructor(opts: { cwd: string; hasUI: boolean }) {
		this.cwd = opts.cwd;
		this.hasUI = opts.hasUI;
		this.reload = vi.fn(async () => undefined);
		this.signal = new AbortController().signal;
	}

	get ui(): UISystem | undefined {
		return this.hasUI ? this.uiSystem : undefined;
	}
}

type StoredFlag = FlagConfig & { value?: string };

class MockAgentAPI implements AgentAPI {
	tools: ToolRegistration[] = [];
	commands = new Map<string, CommandConfig>();
	flags = new Map<string, StoredFlag>();
	handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();
	messages: Array<{ message: unknown; options?: unknown }> = [];
	execResults: Array<{ command: string; args: string[]; result: unknown }> = [];
	defaultExecResult: unknown = { code: 0, stdout: "", stderr: "" };

	registerTool(tool: ToolRegistration): void {
		this.tools.push(tool);
	}

	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}

	registerFlag(name: string, config: FlagConfig): void {
		const stored: StoredFlag = {
			description: config.description,
			type: config.type,
		};
		for (const [k, v] of Object.entries(config)) {
			if (k !== "description" && k !== "type") {
				(stored as Record<string, unknown>)[k] = v;
			}
		}
		this.flags.set(name, stored);
	}

	on(event: string, handler: (...args: unknown[]) => unknown): void {
		const list = this.handlers.get(event) ?? [];
		list.push(handler);
		this.handlers.set(event, list);
	}

	getAllTools(): ToolInfo[] {
		return this.tools.map((t) => ({ name: t.name }));
	}

	getFlag(name: string): string | undefined {
		const flag = this.flags.get(name);
		if (!flag) return undefined;
		return flag.value;
	}

	sendMessage(message: unknown, options?: unknown): void {
		this.messages.push({ message, options });
	}

	async exec(command: string, args: string[]): Promise<unknown> {
		const result = this.defaultExecResult;
		this.execResults.push({ command, args, result });
		return result;
	}
}

describe("MockAgentAPI / MockAgentContext contract", () => {
	let mock: MockAgentAPI;
	let ctx: MockAgentContext;

	beforeEach(() => {
		mock = new MockAgentAPI();
		ctx = new MockAgentContext({ cwd: "/tmp/work", hasUI: true });
	});

	it("Test 1: registerTool stores the tool in the internal array", () => {
		const tool: ToolRegistration = {
			name: "ping",
			execute: vi.fn(),
		};
		mock.registerTool(tool);
		expect(mock.tools).toHaveLength(1);
		expect(mock.tools[0]).toBe(tool);
	});

	it("Test 2: registerCommand stores the command by name", () => {
		const config: CommandConfig = { description: "demo", handler: vi.fn() };
		mock.registerCommand("mcp", config);
		expect(mock.commands.get("mcp")).toBe(config);
	});

	it("Test 3: registerFlag stores the flag with its config", () => {
		const config: FlagConfig = {
			description: "config path",
			type: "string",
			value: "/tmp/cfg.json",
		};
		mock.registerFlag("mcp-config", config);
		const stored = mock.flags.get("mcp-config");
		expect(stored).toBeDefined();
		expect(stored?.description).toBe("config path");
		expect(stored?.type).toBe("string");
		expect((stored as { value?: string }).value).toBe("/tmp/cfg.json");
	});

	it("Test 4: on registers an event handler", async () => {
		const handler = vi.fn(async () => undefined);
		mock.on("session_start", handler);
		const list = mock.handlers.get("session_start") ?? [];
		await list[0]?.();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("Test 5: getAllTools returns all registered tools", () => {
		mock.registerTool({ name: "a", execute: vi.fn() });
		mock.registerTool({ name: "b", execute: vi.fn() });
		const tools = mock.getAllTools();
		expect(tools).toHaveLength(2);
		expect(tools.map((t) => t.name)).toEqual(["a", "b"]);
	});

	it("Test 6: getFlag returns stored value or undefined when missing", () => {
		mock.registerFlag("mcp-config", {
			description: "path",
			type: "string",
			value: "/etc/mcp.json",
		} as FlagConfig & { value: string });
		expect(mock.getFlag("mcp-config")).toBe("/etc/mcp.json");
		expect(mock.getFlag("nope")).toBeUndefined();
	});

	it("Test 7: sendMessage forwards the message and options", () => {
		const message = { role: "user", content: "hi" };
		const options = { silent: true };
		mock.sendMessage(message, options);
		expect(mock.messages).toEqual([{ message, options }]);
	});

	it("Test 8: exec runs the command and returns the mock result", async () => {
		mock.defaultExecResult = { code: 0, stdout: "ok" };
		const result = await mock.exec("ls", ["-la"]);
		expect(result).toEqual({ code: 0, stdout: "ok" });
		expect(mock.execResults[0]).toEqual({
			command: "ls",
			args: ["-la"],
			result: { code: 0, stdout: "ok" },
		});
	});

	it("Test 9: MockAgentContext implements the AgentContext contract", () => {
		expect(ctx.cwd).toBe("/tmp/work");
		expect(ctx.hasUI).toBe(true);
		expect(ctx.ui).toBeDefined();
		expect(ctx.reload).toBeTypeOf("function");
		expect(ctx.signal).toBeDefined();
	});

	it("Test 10: MockUISystem implements notify, setStatus, form, custom, and theme", () => {
		const ui = ctx.uiSystem;
		ui.notify("hello", "info");
		ui.setStatus("loading", "yes");
		ui.setStatus("loading", undefined);
		ui.custom((x: unknown) => x, { mode: "x" });
		ui.setThemeFg((c, t) => `[${c}]${t}`);

		expect(ui.notified).toEqual([{ message: "hello", level: "info" }]);
		expect(ui.statuses.get("loading")).toBeUndefined();
		expect(ui.customRenderers).toHaveLength(1);
		expect(ui.theme.fg?.("red", "X")).toBe("[red]X");
	});

	it("Test 10b: ui is undefined on the context when hasUI is false", () => {
		const noUi = new MockAgentContext({ cwd: "/tmp", hasUI: false });
		expect(noUi.hasUI).toBe(false);
		expect(noUi.ui).toBeUndefined();
	});

	it("Test 10c: UISystem.form forwards to the configured formHandler", async () => {
		const ui = ctx.uiSystem;
		ui.formHandler = vi.fn(async (config) => ({
			action: "submit" as const,
			values: { name: config.fields[0]?.name ?? "x" },
		}));
		const result = await ui.form({
			title: "Test",
			fields: [{ name: "answer", type: "text" }],
		});
		expect(result.action).toBe("submit");
		expect(result.values).toEqual({ name: "answer" });
	});
});
