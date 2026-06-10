import { beforeEach, describe, expect, it, vi } from "vitest";
import { PiAdapter, adaptPiContext } from "../adapters/pi-adapter.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";

type PiMock = {
	registerTool: ReturnType<typeof vi.fn>;
	registerCommand: ReturnType<typeof vi.fn>;
	registerFlag: ReturnType<typeof vi.fn>;
	on: ReturnType<typeof vi.fn>;
	getAllTools: ReturnType<typeof vi.fn>;
	getFlag: ReturnType<typeof vi.fn>;
	sendMessage: ReturnType<typeof vi.fn>;
	exec: ReturnType<typeof vi.fn>;
};

function makePiMock(): PiMock {
	return {
		registerTool: vi.fn(),
		registerCommand: vi.fn(),
		registerFlag: vi.fn(),
		on: vi.fn(),
		getAllTools: vi.fn(() => []),
		getFlag: vi.fn((name: string) => (name === "mcp-config" ? "/tmp/cfg.json" : undefined)),
		sendMessage: vi.fn(),
		exec: vi.fn(async (_cmd: string, _args: string[]) => ({ code: 0, stdout: "", stderr: "" })),
	};
}

describe("PiAdapter", () => {
	let pi: PiMock;
	let adapter: PiAdapter;

	beforeEach(() => {
		pi = makePiMock();
		adapter = new PiAdapter(pi as unknown as ExtensionAPI);
	});

	it("forwards registerTool to pi.registerTool", () => {
		const tool = { name: "test-tool" };
		adapter.registerTool(tool);
		expect(pi.registerTool).toHaveBeenCalledTimes(1);
		expect(pi.registerTool).toHaveBeenCalledWith(tool);
	});

	it("forwards registerCommand with the given name and config", () => {
		const config = { description: "demo", handler: vi.fn() };
		adapter.registerCommand("mcp", config);
		expect(pi.registerCommand).toHaveBeenCalledWith("mcp", config);
	});

	it("forwards registerFlag with the given name and config", () => {
		const config = { description: "path", type: "string" };
		adapter.registerFlag("mcp-config", config);
		expect(pi.registerFlag).toHaveBeenCalledWith("mcp-config", config);
	});

	it("forwards on() with event name and handler", () => {
		const handler = vi.fn();
		adapter.on("session_start", handler);
		expect(pi.on).toHaveBeenCalledWith("session_start", handler);
	});

	it("returns tools from getAllTools", () => {
		const tools = [{ name: "tool-a" }, { name: "tool-b" }];
		pi.getAllTools.mockReturnValue(tools);
		const result = adapter.getAllTools();
		expect(result).toEqual(tools);
	});

	it("returns an empty array when getAllTools is not an array", () => {
		pi.getAllTools.mockReturnValue(null);
		const result = adapter.getAllTools();
		expect(result).toEqual([]);
	});

	it("returns the flag value from getFlag", () => {
		expect(adapter.getFlag("mcp-config")).toBe("/tmp/cfg.json");
		expect(adapter.getFlag("missing")).toBeUndefined();
	});

	it("forwards sendMessage with unknown message and options", () => {
		const message = { role: "user", content: "hi" };
		const options = { model: "gpt-4" };
		adapter.sendMessage(message, options);
		expect(pi.sendMessage).toHaveBeenCalledWith(message, options);
	});

	it("forwards sendMessage with no options", () => {
		adapter.sendMessage("plain");
		expect(pi.sendMessage).toHaveBeenCalledWith("plain", undefined);
	});

	it("forwards exec and returns its result", async () => {
		const expected = { code: 0, stdout: "ok", stderr: "" };
		pi.exec.mockResolvedValue(expected);
		const result = await adapter.exec("echo", ["hi"]);
		expect(result).toBe(expected);
		expect(pi.exec).toHaveBeenCalledWith("echo", ["hi"]);
	});
});

describe("adaptPiContext", () => {
	it("converts a UI-less context (ui is undefined)", () => {
		const ctx: ExtensionContext = {
			cwd: "/work",
			hasUI: false,
			ui: undefined as unknown as ExtensionContext["ui"],
			model: undefined,
			modelRegistry: { getAvailable: () => [] } as unknown as ExtensionContext["modelRegistry"],
			signal: undefined,
			sessionManager: {} as ExtensionContext["sessionManager"],
			isIdle: () => true,
			abort: () => {},
			hasPendingMessages: () => false,
			shutdown: () => {},
			getContextUsage: () => undefined,
			compact: () => {},
			getSystemPrompt: () => "",
		};

		const adapted = adaptPiContext(ctx);
		expect(adapted.cwd).toBe("/work");
		expect(adapted.hasUI).toBe(false);
		expect(adapted.ui).toBeUndefined();
	});

	it("wraps ui when hasUI is true", async () => {
		const notify = vi.fn();
		const setStatus = vi.fn();
		const form = vi.fn(async () => ({ action: "submit" as const, values: {} }));
		const custom = vi.fn();
		const fg = vi.fn((_color: string, text: string) => text);

		const ctx: ExtensionContext = {
			cwd: "/work",
			hasUI: true,
			ui: { notify, setStatus, form, custom, theme: { fg }, confirm: vi.fn(), select: vi.fn(), widget: vi.fn() } as unknown as ExtensionContext["ui"],
			model: undefined,
			modelRegistry: { getAvailable: () => [] } as unknown as ExtensionContext["modelRegistry"],
			signal: new AbortController().signal,
			sessionManager: {} as ExtensionContext["sessionManager"],
			isIdle: () => true,
			abort: () => {},
			hasPendingMessages: () => false,
			shutdown: () => {},
			getContextUsage: () => undefined,
			compact: () => {},
			getSystemPrompt: () => "",
		};

		const adapted = adaptPiContext(ctx);
		expect(adapted.hasUI).toBe(true);
		expect(adapted.ui).toBeDefined();
		if (!adapted.ui) throw new Error("ui should be defined");

		adapted.ui.notify("hello", "info");
		expect(notify).toHaveBeenCalledWith("hello", "info");

		adapted.ui.setStatus?.("mcp", "ready");
		expect(setStatus).toHaveBeenCalledWith("mcp", "ready");

		const formResult = await adapted.ui.form?.({ title: "t", fields: [] });
		expect(form).toHaveBeenCalled();
		expect(formResult?.action).toBe("submit");

		adapted.ui.custom?.(() => "rendered", { placement: "footer" });
		expect(custom).toHaveBeenCalled();

		const colored = adapted.ui.theme?.fg?.("accent", "ready");
		expect(fg).toHaveBeenCalledWith("accent", "ready");
		expect(colored).toBe("ready");
	});

	it("omits optional UI members that Pi does not expose", () => {
		const notify = vi.fn();
		const ctx: ExtensionContext = {
			cwd: "/work",
			hasUI: true,
			ui: { notify, setStatus: vi.fn(), confirm: vi.fn(), select: vi.fn(), widget: vi.fn() } as unknown as ExtensionContext["ui"],
			model: undefined,
			modelRegistry: { getAvailable: () => [] } as unknown as ExtensionContext["modelRegistry"],
			signal: undefined,
			sessionManager: {} as ExtensionContext["sessionManager"],
			isIdle: () => true,
			abort: () => {},
			hasPendingMessages: () => false,
			shutdown: () => {},
			getContextUsage: () => undefined,
			compact: () => {},
			getSystemPrompt: () => "",
		};

		const adapted = adaptPiContext(ctx);
		expect(adapted.ui).toBeDefined();
		if (!adapted.ui) throw new Error("ui should be defined");
		// form/custom/theme are not present on the source ui
		expect(adapted.ui.form).toBeUndefined();
		expect(adapted.ui.custom).toBeUndefined();
		expect(adapted.ui.theme).toBeUndefined();
	});
});
