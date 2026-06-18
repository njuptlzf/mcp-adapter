import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAPI, AgentContext, ToolInfo } from "../interfaces/agent-api.ts";
import { createMcpAdapter } from "../adapters/entry.ts";

const mocks = vi.hoisted(() => ({
	initializeMcp: vi.fn(),
	updateStatusBar: vi.fn(),
	flushMetadataCache: vi.fn(),
	initializeOAuth: vi.fn().mockResolvedValue(undefined),
	shutdownOAuth: vi.fn().mockResolvedValue(undefined),
	loadMcpConfig: vi.fn(() => ({ mcpServers: {} })),
	loadMetadataCache: vi.fn(() => null),
	buildProxyDescription: vi.fn(() => "MCP gateway"),
	createDirectToolExecutor: vi.fn(() => vi.fn()),
	getMissingConfiguredDirectToolServers: vi.fn(() => []),
	resolveDirectTools: vi.fn(() => []),
	showStatus: vi.fn(),
	showTools: vi.fn(),
	reconnectServers: vi.fn(),
	authenticateServer: vi.fn(),
	logoutServer: vi.fn(),
	openMcpAuthPanel: vi.fn(),
	openMcpPanel: vi.fn(),
	openMcpSetup: vi.fn(),
	executeCall: vi.fn(),
	executeConnect: vi.fn(),
	executeDescribe: vi.fn(),
	executeList: vi.fn(),
	executeSearch: vi.fn(),
	executeStatus: vi.fn(),
	executeUiMessages: vi.fn(),
	getConfigPathFromArgv: vi.fn(() => undefined),
	truncateAtWord: vi.fn((text: string) => text),
}));

vi.mock("../init.ts", () => ({
	initializeMcp: mocks.initializeMcp,
	updateStatusBar: mocks.updateStatusBar,
	flushMetadataCache: mocks.flushMetadataCache,
}));

vi.mock("../mcp-auth-flow.ts", () => ({
	initializeOAuth: mocks.initializeOAuth,
	shutdownOAuth: mocks.shutdownOAuth,
}));

vi.mock("../config.ts", () => ({
	loadMcpConfig: mocks.loadMcpConfig,
}));

vi.mock("../metadata-cache.ts", () => ({
	loadMetadataCache: mocks.loadMetadataCache,
}));

vi.mock("../direct-tools.ts", () => ({
	buildProxyDescription: mocks.buildProxyDescription,
	createDirectToolExecutor: mocks.createDirectToolExecutor,
	getMissingConfiguredDirectToolServers: mocks.getMissingConfiguredDirectToolServers,
	resolveDirectTools: mocks.resolveDirectTools,
}));

vi.mock("../commands.ts", () => ({
	showStatus: mocks.showStatus,
	showTools: mocks.showTools,
	reconnectServers: mocks.reconnectServers,
	authenticateServer: mocks.authenticateServer,
	logoutServer: mocks.logoutServer,
	openMcpAuthPanel: mocks.openMcpAuthPanel,
	openMcpPanel: mocks.openMcpPanel,
	openMcpSetup: mocks.openMcpSetup,
}));

vi.mock("../proxy-modes.ts", () => ({
	executeCall: mocks.executeCall,
	executeConnect: mocks.executeConnect,
	executeDescribe: mocks.executeDescribe,
	executeList: mocks.executeList,
	executeSearch: mocks.executeSearch,
	executeStatus: mocks.executeStatus,
	executeUiMessages: mocks.executeUiMessages,
}));

vi.mock("../utils.ts", () => ({
	getConfigPathFromArgv: mocks.getConfigPathFromArgv,
	truncateAtWord: mocks.truncateAtWord,
}));

function createAgentApi(): AgentAPI & { _handlers: Map<string, (...args: unknown[]) => unknown> } {
	const handlers = new Map<string, (...args: unknown[]) => unknown>();
	return {
		registerTool: vi.fn(),
		registerCommand: vi.fn(),
		registerFlag: vi.fn(),
		on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
			handlers.set(event, handler);
		}),
		getAllTools: vi.fn(() => []),
		getFlag: vi.fn((name: string) => (name === "mcp-config" ? "/tmp/cfg.json" : undefined)),
		sendMessage: vi.fn(),
		exec: vi.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
		_handlers: handlers,
	} as unknown as AgentAPI & { _handlers: Map<string, (...args: unknown[]) => unknown> };
}

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function createState() {
	return {
		manager: { getAllConnections: () => new Map() },
		lifecycle: { gracefulShutdown: vi.fn().mockResolvedValue(undefined) },
		toolMetadata: new Map(),
		config: { mcpServers: {} },
		failureTracker: new Map(),
		uiResourceHandler: {},
		consentManager: {},
		uiServer: null,
		completedUiSessions: [],
		openBrowser: vi.fn(),
	} as any;
}

describe("createMcpAdapter", () => {
	const originalDirectTools = process.env.MCP_DIRECT_TOOLS;

	beforeEach(() => {
		delete process.env.MCP_DIRECT_TOOLS;
		vi.resetModules();
		for (const value of Object.values(mocks)) {
			if (typeof value === "function" && "mockReset" in value) {
				value.mockReset();
			}
		}

		mocks.initializeOAuth.mockResolvedValue(undefined);
		mocks.shutdownOAuth.mockResolvedValue(undefined);
		mocks.loadMcpConfig.mockReturnValue({ mcpServers: {} });
		mocks.loadMetadataCache.mockReturnValue(null);
		mocks.buildProxyDescription.mockReturnValue("MCP gateway");
		mocks.createDirectToolExecutor.mockReturnValue(vi.fn());
		mocks.getMissingConfiguredDirectToolServers.mockReturnValue([]);
		mocks.resolveDirectTools.mockReturnValue([]);
		mocks.getConfigPathFromArgv.mockReturnValue(undefined);
		mocks.truncateAtWord.mockImplementation((text: string) => text);
	});

	afterEach(() => {
		if (originalDirectTools === undefined) {
			delete process.env.MCP_DIRECT_TOOLS;
		} else {
			process.env.MCP_DIRECT_TOOLS = originalDirectTools;
		}
	});

	it("registers the mcp-config flag, mcp/mcp-auth commands, and proxy tool", () => {
		const agentapi = createAgentApi();
		createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

		expect(agentapi.registerFlag).toHaveBeenCalledWith("mcp-config", expect.any(Object));
		expect(agentapi.registerCommand).toHaveBeenCalledWith("mcp", expect.any(Object));
		expect(agentapi.registerCommand).toHaveBeenCalledWith("mcp-auth", expect.any(Object));
		expect(agentapi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: "mcp" }));
	});

	it("registers direct tools when resolveDirectTools returns specs", () => {
		mocks.resolveDirectTools.mockReturnValue([
			{
				serverName: "demo",
				originalName: "search",
				prefixedName: "demo_search",
				description: "Search demo",
				inputSchema: { type: "object", properties: {} },
			},
		]);

		const agentapi = createAgentApi();
		createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

		expect(agentapi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: "demo_search" }));
	});

	it("wires session_start to initializeMcp with the runtime AgentContext", async () => {
		const state = createState();
		mocks.initializeMcp.mockResolvedValue(state);

		const agentapi = createAgentApi();
		createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

		const sessionStart = agentapi._handlers.get("session_start");
		expect(sessionStart).toBeTypeOf("function");

		const runtimeCtx: AgentContext = { cwd: "/session", hasUI: true, ui: { notify: vi.fn() } };
		await sessionStart?.({}, runtimeCtx);
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.initializeMcp).toHaveBeenCalledTimes(1);
		expect(mocks.initializeMcp).toHaveBeenCalledWith(agentapi, runtimeCtx);
		expect(mocks.updateStatusBar).toHaveBeenCalledWith(state);
	});

	it("wires session_shutdown to shut down state and OAuth", async () => {
		const state = createState();
		mocks.initializeMcp.mockResolvedValue(state);

		const agentapi = createAgentApi();
		createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

		const sessionStart = agentapi._handlers.get("session_start");
		const sessionShutdown = agentapi._handlers.get("session_shutdown");

		await sessionStart?.({}, { cwd: "/work", hasUI: false });
		await Promise.resolve();
		await Promise.resolve();

		mocks.shutdownOAuth.mockClear();
		await sessionShutdown?.();

		expect(mocks.shutdownOAuth).toHaveBeenCalledTimes(1);
		expect(mocks.flushMetadataCache).toHaveBeenCalledWith(state);
	});

	it("shuts down stale init results when a new session starts", async () => {
		const first = createDeferred<any>();
		const second = createDeferred<any>();
		mocks.initializeMcp
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);

		const agentapi = createAgentApi();
		createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

		const sessionStart = agentapi._handlers.get("session_start");
		await sessionStart?.({}, {});
		expect(mocks.initializeMcp).toHaveBeenCalledTimes(1);
		expect(mocks.shutdownOAuth).toHaveBeenCalledTimes(1);

		await sessionStart?.({}, {});
		expect(mocks.initializeMcp).toHaveBeenCalledTimes(2);
		expect(mocks.shutdownOAuth).toHaveBeenCalledTimes(2);

		const activeState = createState();
		second.resolve(activeState);
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.updateStatusBar).toHaveBeenCalledWith(activeState);
		expect(activeState.lifecycle.gracefulShutdown).not.toHaveBeenCalled();

		const staleState = createState();
		first.resolve(staleState);
		await Promise.resolve();
		await Promise.resolve();

		expect(mocks.updateStatusBar).not.toHaveBeenCalledWith(staleState);
		expect(mocks.flushMetadataCache).toHaveBeenCalledWith(staleState);
		expect(staleState.lifecycle.gracefulShutdown).toHaveBeenCalledTimes(1);
	});

	it("uses agentapi.getAllTools() for native tool lookup in the proxy tool", async () => {
		mocks.executeCall.mockImplementation(async (_state, _toolName, _args, _server, getAgentTools) => {
			if (getAgentTools) {
				getAgentTools();
			}
			return {
				content: [{ type: "text" as const, text: "ok" }],
				details: {},
			};
		});

		const agentapi = createAgentApi();
		const nativeTool: ToolInfo = { name: "read" };
		agentapi.getAllTools.mockReturnValue([nativeTool]);

		createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

		const proxyToolCall = (agentapi.registerTool as ReturnType<typeof vi.fn>).mock.calls.find(
			(call: any[]) => call[0].name === "mcp",
		);
		expect(proxyToolCall).toBeDefined();

		const state = createState();
		mocks.initializeMcp.mockResolvedValue(state);
		const sessionStart = agentapi._handlers.get("session_start");
		await sessionStart?.({}, { cwd: "/work", hasUI: false });
		await Promise.resolve();
		await Promise.resolve();

		await proxyToolCall[0].execute("id", { tool: "read" }, undefined, undefined, {});
		expect(mocks.executeCall).toHaveBeenCalledWith(state, "read", undefined, undefined, expect.any(Function));
		expect(agentapi.getAllTools).toHaveBeenCalled();
	});
});
