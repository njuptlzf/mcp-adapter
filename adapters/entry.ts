/**
 * Agent-agnostic MCP adapter entry point.
 *
 * `createMcpAdapter` performs all generic registration and lifecycle wiring
 * for any agent that implements the `AgentAPI` contract. It does not load
 * configuration or metadata cache — those are supplied by the caller
 * (e.g. the Pi-specific wrapper in `index.ts`).
 */

import type { AgentAPI, AgentContext, ToolInfo } from "../interfaces/agent-api.ts";
import type { MetadataCache } from "../metadata-cache.ts";
import type { McpConfig } from "../types.ts";
import type { McpExtensionState } from "../state.ts";
import { Type } from "typebox";
import {
	showStatus,
	showTools,
	reconnectServers,
	authenticateServer,
	logoutServer,
	openMcpAuthPanel,
	openMcpPanel,
	openMcpSetup,
} from "../commands.ts";
import {
	buildProxyDescription,
	createDirectToolExecutor,
	getMissingConfiguredDirectToolServers,
	resolveDirectTools,
} from "../direct-tools.ts";
import { flushMetadataCache, initializeMcp, updateStatusBar } from "../init.ts";
import {
	executeAuthComplete,
	executeAuthStart,
	executeCall,
	executeConnect,
	executeDescribe,
	executeList,
	executeSearch,
	executeStatus,
	executeUiMessages,
} from "../proxy-modes.ts";
import { getConfigPathFromArgv, truncateAtWord } from "../utils.ts";
import { initializeOAuth, shutdownOAuth } from "../mcp-auth-flow.ts";
import {
	createMcpDirectToolCallRenderer,
	renderMcpProxyToolCall,
	renderMcpToolResult,
} from "../tool-result-renderer.ts";

/**
 * Register tools, commands, flags, and session lifecycle with the supplied
 * agent API. All registration happens synchronously before returning.
 *
 * @param agentapi - Generic agent API to register against.
 * @param ctx      - Registration-time agent context (reserved for fallback use).
 * @param config   - Loaded MCP configuration.
 * @param cache    - Loaded metadata cache (may be null).
 */
export function createMcpAdapter(
	agentapi: AgentAPI,
	_ctx: AgentContext,
	config: McpConfig,
	cache: MetadataCache | null,
): void {
	let state: McpExtensionState | null = null;
	let initPromise: Promise<McpExtensionState> | null = null;
	let lifecycleGeneration = 0;

	async function shutdownState(currentState: McpExtensionState | null, reason: string): Promise<void> {
		if (!currentState) return;

		if (currentState.uiServer) {
			currentState.uiServer.close(reason);
			currentState.uiServer = null;
		}

		let flushError: unknown;
		try {
			flushMetadataCache(currentState);
		} catch (error) {
			flushError = error;
		}

		try {
			await currentState.lifecycle.gracefulShutdown();
		} catch (error) {
			if (flushError) {
				console.error("MCP: graceful shutdown failed after metadata flush error", error);
			} else {
				throw error;
			}
		}

		if (flushError) {
			throw flushError;
		}
	}

	const prefix = config.settings?.toolPrefix ?? "server";
	const envRaw = process.env.MCP_DIRECT_TOOLS;
	const directSpecs =
		envRaw === "__none__"
			? []
			: resolveDirectTools(
					config,
					cache,
					prefix,
					envRaw?.split(",").map((s) => s.trim()).filter(Boolean),
				);
	const missingConfiguredDirectToolServers = getMissingConfiguredDirectToolServers(config, cache);
	const shouldRegisterProxyTool =
		config.settings?.disableProxyTool !== true
		|| directSpecs.length === 0
		|| missingConfiguredDirectToolServers.length > 0;

	for (const spec of directSpecs) {
		agentapi.registerTool({
			name: spec.prefixedName,
			label: `MCP: ${spec.originalName}`,
			description: spec.description || "(no description)",
			promptSnippet: truncateAtWord(spec.description, 100) || `MCP tool from ${spec.serverName}`,
			parameters: Type.Unsafe((spec.inputSchema || { type: "object", properties: {} }) as never),
			execute: createDirectToolExecutor(() => state, () => initPromise, spec),
			renderCall: createMcpDirectToolCallRenderer(spec.prefixedName),
			renderResult: renderMcpToolResult,
		});
	}

	const getAgentTools = (): ToolInfo[] => agentapi.getAllTools();

	agentapi.registerFlag("mcp-config", {
		description: "Path to MCP config file",
		type: "string",
	});

	agentapi.on("session_start", async (_event, sessionCtx) => {
		const runtimeCtx = sessionCtx as AgentContext;
		const generation = ++lifecycleGeneration;
		const previousState = state;
		state = null;
		initPromise = null;

		try {
			await Promise.all([shutdownState(previousState, "session_restart"), shutdownOAuth()]);
		} catch (error) {
			console.error("MCP: failed to shut down previous session state", error);
		}

		if (generation !== lifecycleGeneration) {
			return;
		}

		await initializeOAuth().catch((err) => {
			console.error("MCP OAuth initialization failed:", err);
		});

		const promise = initializeMcp(agentapi, runtimeCtx);
		initPromise = promise;

		promise
			.then(async (nextState) => {
				if (generation !== lifecycleGeneration || initPromise !== promise) {
					try {
						await shutdownState(nextState, "stale_session_start");
					} catch (error) {
						console.error("MCP: failed to clean stale session state", error);
					}
					return;
				}

				state = nextState;
				updateStatusBar(nextState);
				initPromise = null;
			})
			.catch((err) => {
				if (generation !== lifecycleGeneration) {
					return;
				}
				if (initPromise !== promise && initPromise !== null) {
					return;
				}
				console.error("MCP initialization failed:", err);
				initPromise = null;
			});
	});

	agentapi.on("session_shutdown", async () => {
		++lifecycleGeneration;
		const currentState = state;
		state = null;
		initPromise = null;

		try {
			await Promise.all([shutdownState(currentState, "session_shutdown"), shutdownOAuth()]);
		} catch (error) {
			console.error("MCP: session shutdown cleanup failed", error);
		}
	});

	agentapi.registerCommand("mcp", {
		description: "Show MCP server status",
		handler: async (args, cmdCtx) => {
			const cmdCtxTyped = cmdCtx as AgentContext;
			if (!state && initPromise) {
				try {
					state = await initPromise;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (cmdCtxTyped.hasUI) cmdCtxTyped.ui.notify(`MCP initialization failed: ${message}`, "error");
					return;
				}
			}
			if (!state) {
				if (cmdCtxTyped.hasUI) cmdCtxTyped.ui.notify("MCP not initialized", "error");
				return;
			}

			const parts = (args as string | undefined)?.trim()?.split(/\s+/) ?? [];
			const subcommand = parts[0] ?? "";
			const targetServer = parts[1];
			const rest = parts.slice(1).join(" ");

			switch (subcommand) {
				case "reconnect":
					await reconnectServers(state, cmdCtxTyped, targetServer);
					break;
				case "tools":
					await showTools(state, cmdCtxTyped);
					break;
				case "setup": {
					const result = await openMcpSetup(state, agentapi, cmdCtxTyped, getConfigPathFromArgv(), "setup");
					if (result?.configChanged) {
						await cmdCtxTyped.reload();
						return;
					}
					break;
				}
				case "logout": {
					const serverName = rest;
					if (!serverName) {
						if (cmdCtxTyped.hasUI) cmdCtxTyped.ui.notify("Usage: /mcp logout <server>", "error");
						return;
					}
					await logoutServer(serverName, state, cmdCtxTyped);
					break;
				}
				case "status":
				case "":
				default:
					if (cmdCtxTyped.hasUI) {
						const result = await openMcpPanel(state, agentapi, cmdCtxTyped, getConfigPathFromArgv());
						if (result?.configChanged) {
							await cmdCtxTyped.reload();
							return;
						}
					} else {
						await showStatus(state, cmdCtxTyped);
					}
					break;
			}
		},
	});

	agentapi.registerCommand("mcp-auth", {
		description: "Authenticate with an MCP server (OAuth)",
		handler: async (args, cmdCtx) => {
			const cmdCtxTyped = cmdCtx as AgentContext;
			const serverName = (args as string | undefined)?.trim();
			if (!serverName && !cmdCtxTyped.hasUI) {
				return;
			}

			if (!state && initPromise) {
				try {
					state = await initPromise;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (cmdCtxTyped.hasUI) cmdCtxTyped.ui.notify(`MCP initialization failed: ${message}`, "error");
					return;
				}
			}
			if (!state) {
				if (cmdCtxTyped.hasUI) cmdCtxTyped.ui.notify("MCP not initialized", "error");
				return;
			}

			if (!serverName) {
				await openMcpAuthPanel(state, agentapi, cmdCtxTyped, getConfigPathFromArgv());
				return;
			}

			await authenticateServer(serverName, state.config, cmdCtxTyped);
		},
	});

	if (shouldRegisterProxyTool) {
		agentapi.registerTool({
			name: "mcp",
			label: "MCP",
			description: buildProxyDescription(config, cache, directSpecs),
			promptSnippet: "MCP gateway - connect to MCP servers and call their tools",
			renderCall: renderMcpProxyToolCall,
			parameters: Type.Object({
				tool: Type.Optional(Type.String({ description: "Tool name to call (e.g., 'xcodebuild_list_sims')" })),
				args: Type.Optional(Type.String({ description: "Arguments as JSON string (e.g., '{\"key\": \"value\"}')" })),
				connect: Type.Optional(Type.String({ description: "Server name to connect (lazy connect + metadata refresh)" })),
				describe: Type.Optional(Type.String({ description: "Tool name to describe (shows parameters)" })),
				search: Type.Optional(Type.String({ description: "Search tools by name/description" })),
				regex: Type.Optional(Type.Boolean({ description: "Treat search as regex (default: substring match)" })),
				includeSchemas: Type.Optional(Type.Boolean({ description: "Include parameter schemas in search results (default: true)" })),
				server: Type.Optional(Type.String({ description: "Filter to specific server (also disambiguates tool calls)" })),
				action: Type.Optional(Type.String({ description: "Action: 'ui-messages' to retrieve prompts/intents from UI sessions, 'auth-start'/'auth-complete' for remote/headless OAuth" })),
			}),
			renderResult: renderMcpToolResult,
			async execute(_toolCallId, params: {
				tool?: string;
				args?: string;
				connect?: string;
				describe?: string;
				search?: string;
				regex?: boolean;
				includeSchemas?: boolean;
				server?: string;
				action?: string;
			}, _signal, _onUpdate, _ctx) {
				let parsedArgs: Record<string, unknown> | undefined;
				if (params.args) {
					try {
						parsedArgs = JSON.parse(params.args);
						if (typeof parsedArgs !== "object" || parsedArgs === null || Array.isArray(parsedArgs)) {
							const gotType = Array.isArray(parsedArgs) ? "array" : parsedArgs === null ? "null" : typeof parsedArgs;
							throw new Error(`Invalid args: expected a JSON object, got ${gotType}`);
						}
					} catch (error) {
						if (error instanceof SyntaxError) {
							throw new Error(`Invalid args JSON: ${error.message}`, { cause: error });
						}
						throw error;
					}
				}

				if (!state && initPromise) {
					try {
						state = await initPromise;
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						return {
							content: [{ type: "text" as const, text: `MCP initialization failed: ${message}` }],
							details: { error: "init_failed", message },
						};
					}
				}
				if (!state) {
					return {
						content: [{ type: "text" as const, text: "MCP not initialized" }],
						details: { error: "not_initialized" },
					};
				}

				if (params.action === "ui-messages") {
					return executeUiMessages(state);
				}
				if (params.action === "auth-start" && params.server) {
					return executeAuthStart(state, params.server);
				}
				if (params.action === "auth-complete" && params.server) {
					return executeAuthComplete(state, params.server, params.args ?? "");
				}
				if (params.tool) {
					return executeCall(state, params.tool, parsedArgs, params.server, getAgentTools);
				}
				if (params.connect) {
					return executeConnect(state, params.connect);
				}
				if (params.describe) {
					return executeDescribe(state, params.describe);
				}
				if (params.search) {
					return executeSearch(state, params.search, params.regex, params.server, params.includeSchemas);
				}
				if (params.server) {
					return executeList(state, params.server);
				}
				return executeStatus(state);
			},
		});
	}
}
