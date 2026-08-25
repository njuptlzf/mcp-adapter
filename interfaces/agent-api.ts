/**
 * Agent-agnostic interface definitions for the universal MCP adapter.
 *
 * These interfaces are intentionally minimal and use `unknown`/optional
 * members where different agents diverge. Concrete adapters (e.g.
 * `PiAdapter`) implement the cross-cutting shape and bridge to agent-native
 * types.
 *
 * Design notes (locked from CONTEXT.md):
 *  - D-01: `sendMessage` uses `unknown` parameter types for cross-agent flexibility.
 *  - D-02: `exec` returns `Promise<unknown>` to avoid brittle cross-agent unions.
 *  - D-03: All core `AgentAPI` methods are required to enforce a minimum contract.
 *  - D-04: `UISystem.notify` is required — every agent should support notifications.
 *  - D-05: `UISystem.setStatus`, `form`, `custom` are optional.
 *  - D-06: `UISystem.theme.fg` is optional — not all agents expose theming.
 */

import type { SamplingProvider } from "./sampling.ts";
import type { AgentPathResolver } from "./agent-paths.ts";
import { createPiResolver, createUniversalResolver } from "./agent-paths.ts";
import { PiAdapter } from "../adapters/pi-adapter.ts";

/** A registered tool's information, as exposed by `AgentAPI.getAllTools`. */
export interface ToolInfo {
	name: string;
	[key: string]: unknown;
}

/** A form field definition for `UISystem.form` calls. */
export interface FormField {
	name: string;
	type: string;
	label?: string;
	placeholder?: string;
	default?: unknown;
	[key: string]: unknown;
}

/** Configuration for `UISystem.form` prompts. */
export interface FormConfig {
	title: string;
	message?: string;
	fields: FormField[];
	submitLabel?: string;
	secondaryLabel?: string;
	cancelLabel?: string;
}

/** Result returned by `UISystem.form`. */
export interface FormResult {
	action: "submit" | "secondary" | "cancel";
	values?: Record<string, unknown> | undefined;
}

/** A custom UI renderer function. */
export type UIRenderer = (...args: unknown[]) => unknown;

/** Options for a custom UI renderer. */
export interface UIOptions {
	[key: string]: unknown;
}

/**
 * UI capabilities exposed by an agent. The minimum contract is `notify`; all
 * other members are agent-specific and must be guarded with optional chaining
 * or `typeof === "function"` checks.
 */
export interface UISystem {
	/** Show a transient notification. Required. */
	notify(message: string, level: "info" | "warning" | "error"): void;
	/** Set or clear a status bar entry. */
	setStatus?(key: string, value: string | undefined): void;
	/** Show an interactive form and await a result. */
	form?: ((config: FormConfig) => Promise<FormResult>) | undefined;
	/** Register a custom UI renderer. */
	custom?: ((renderer: UIRenderer, options?: UIOptions) => void) | undefined;
	/** Optional theming helpers (e.g. Pi's `theme.fg`). */
	theme?: { fg?(color: string, text: string): string } | undefined;
}

/**
 * Context handed to an MCP adapter during initialization. The `ui` field is
 * only populated when `hasUI` is true; callers must still guard it.
 *
 * When `mcpConfigPath` is set, it takes priority over AgentPathResolver
 * for config discovery (per PATH-01). Leave undefined for resolver-based resolution.
 */
export interface AgentContext {
	cwd: string;
	hasUI: boolean;
	ui?: UISystem | undefined;
	model?: unknown;
	modelRegistry?: unknown;
	samplingProvider?: SamplingProvider | undefined;
	signal?: AbortSignal;
	reload?: (() => Promise<void>) | undefined;
	mcpConfigPath?: string | undefined;
}

/** Registration shape for `AgentAPI.registerTool`. */
export interface ToolRegistration {
	name: string;
	label?: string;
	description?: string;
	promptSnippet?: string;
	parameters?: unknown;
	execute: (...args: any[]) => unknown;
	renderCall?: (...args: any[]) => unknown;
	renderResult?: (...args: any[]) => unknown;
	[key: string]: unknown;
}

/** Configuration for `AgentAPI.registerCommand`. */
export interface CommandConfig {
	description?: string;
	handler: (...args: unknown[]) => unknown;
	[key: string]: unknown;
}

/** Configuration for `AgentAPI.registerFlag`. */
export interface FlagConfig {
	description?: string;
	type?: string;
	[key: string]: unknown;
}

/**
 * Core agent API surface required by the universal MCP adapter.
 *
 * All methods are required to enforce a minimum contract across agents.
 * Per-agent extensions belong on the concrete adapter class, not here.
 */
export interface AgentAPI {
	registerTool(tool: ToolRegistration): void;
	registerCommand(name: string, config: CommandConfig): void;
	registerFlag(name: string, config: FlagConfig): void;
	on(event: string, handler: (...args: unknown[]) => void | Promise<void>): void;
	getAllTools(): ToolInfo[];
	getFlag(name: string): string | undefined;
	/**
	 * Send a message via the agent. Parameter and option shapes vary by
	 * agent; both are typed as `unknown` for cross-agent compatibility.
	 */
	sendMessage(message: unknown, options?: unknown): void;
	/** Run a shell command via the agent. */
	exec(command: string, args: string[]): Promise<unknown>;
}

/**
 * Descriptor for a registered AgentAPI adapter.
 *
 * Per D-07 (Phase 7 CONTEXT): static registry in interfaces/agent-api.ts;
 * consumers (test runner, Capability Gate, README matrix, report writer)
 * all read from AGENT_ADAPTERS. Adding a new adapter = push one descriptor;
 * no other file in the project needs to change.
 */
export interface AgentAdapterDescriptor {
	/** Stable identifier matching `AgentId` from `interfaces/agent-paths.ts`. */
	id: string;
	/** Human-readable name (e.g. for README matrix / report headers). */
	displayName: string;
	/** Factory returning a fresh adapter instance per beforeEach for test isolation. */
	factory: () => AgentAPI;
	/** Path resolver factory for this adapter. */
	resolverFactory: () => AgentPathResolver;
	/** Optional env hints — env vars or files that indicate this adapter is loaded. */
	envHints?: ReadonlyArray<{ envVar?: string; filePath?: string }>;
	/** Capability flags for the README matrix column. */
	capabilities?: { ui?: boolean; sampling?: boolean; renderer?: boolean };
	/**
	 * Optional verification context builder used by `scripts/deploy-verify.ts`.
	 *
	 * Agents that require a live native runtime (e.g. Pi's ExtensionAPI) can omit
	 * this; the verification script will skip them. SDK-bridge and stdio-server
	 * adapters should provide a minimal context so the universal deployment flow
	 * can be exercised end-to-end without a live agent host.
	 */
	createVerificationContext?: (
		input: { cwd: string; hasUI: boolean },
		adapter: AgentAPI,
	) => AgentContext;
}

/**
 * Static registry of every supported AgentAPI adapter.
 *
 * Single source of truth — test runner (`__tests__/adapter-contract.test.ts`),
 * Capability Gate (Plan 07-02), README matrix (Plan 07-04), and report
 * matrix all consume this array.
 *
 * Per D-07: new adapter = import + push one descriptor; nothing else changes.
 */
export const AGENT_ADAPTERS: AgentAdapterDescriptor[] = [
	{
		id: "universal-mcp",
		displayName: "Universal MCP",
		// D-04: inline AgentAPI implementation — no shared base class, no
		// adapter base class import. Each entry point has its own inline
		// implementation. This factory provides in-memory tool/command/flag
		// storage and event simulators for createMcpAdapter.
		factory: () => {
			const tools = new Map<string, ToolRegistration>();
			const commands = new Map<string, CommandConfig>();
			const flags = new Map<string, FlagConfig & { value?: string }>();
			const handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();

			const adapter: AgentAPI & {
				attachChannel: (channel: unknown) => void;
				fireSessionStart: (ctx: AgentContext) => Promise<void>;
				fireSessionShutdown: () => Promise<void>;
			} = {
				registerTool(tool: ToolRegistration): void {
					tools.set(tool.name, tool);
				},
				registerCommand(name: string, config: CommandConfig): void {
					commands.set(name, config);
				},
				registerFlag(name: string, config: FlagConfig): void {
					flags.set(name, { ...config });
				},
				on(event: string, handler: (...args: unknown[]) => void | Promise<void>): void {
					let set = handlers.get(event);
					if (!set) {
						set = new Set();
						handlers.set(event, set);
					}
					set.add(handler as (...args: unknown[]) => unknown);
				},
				getAllTools(): ToolInfo[] {
					return [...tools.values()].map((t) => ({ name: t.name }));
				},
				getFlag(name: string): string | undefined {
					return flags.get(name)?.value;
				},
				// No-op: messages go to stderr in bin/mcp-server.ts, not here.
				// This factory is for testing / parametric contract tests.
				sendMessage(_message: unknown, _options?: unknown): void {},
				// Mock for testing — does not spawn a real process.
				// T-10-02 pattern: no path from MCP tool result to exec.
				async exec(_command: string, _args: string[]): Promise<unknown> {
					return { code: 0, stdout: "", stderr: "" };
				},
				// No-op stubs for contract test compatibility.
				// createMcpAdapter calls adapter.on("session_start", ...) but
				// does not call fireSessionStart directly; these are provided
				// for any test that drives session lifecycle events.
				attachChannel(_channel: unknown): void {},
				async fireSessionStart(_ctx: AgentContext): Promise<void> {},
				async fireSessionShutdown(): Promise<void> {},
			};
			return adapter;
		},
		resolverFactory: createUniversalResolver,
		envHints: [{ envVar: "MCP_CONFIG_PATH" }],
		// Static capabilities — actual capabilities are runtime-discovered
		// via server.getClientCapabilities() when an MCP Client connects.
		capabilities: { ui: false, sampling: false, renderer: false },
		// universal-mcp verification context: minimal, no agent-specific runtime needed.
		createVerificationContext: (input, _adapter) => ({ cwd: input.cwd, hasUI: input.hasUI }),
	},
	{
		id: "pi",
		displayName: "Pi",
		// PiAdapter is a pass-through wrapper around Pi's `ExtensionAPI`; the
		// parametric test provides a tiny in-memory `ExtensionAPI` placeholder
		// (single-instance scoped to one `factory()` call) so the contract
		// tests can observe a register → read-back round-trip without a live
		// Pi runtime. See `__tests__/adapter-contract.test.ts` for usage.
		factory: () => {
			const toolStore: ToolRegistration[] = [];
			const flagStore = new Map<string, string | undefined>();
			return new PiAdapter({
				registerTool: (tool: ToolRegistration) => {
					toolStore.push(tool);
				},
				registerCommand: () => {},
				registerFlag: (name: string) => {
					flagStore.set(name, undefined);
				},
				on: () => {},
				getAllTools: () => toolStore.map((t) => ({ name: t.name })),
				getFlag: (name: string) => flagStore.get(name),
				sendMessage: () => {},
				exec: async () => ({ code: 0, stdout: "", stderr: "" }),
			} as unknown as ConstructorParameters<typeof PiAdapter>[0]);
		},
		resolverFactory: createPiResolver,
		envHints: [{ envVar: "PI_CODING_AGENT_DIR" }],
		capabilities: { ui: true, sampling: true, renderer: true },
	},
];
