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
	values?: Record<string, unknown>;
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
	form?(config: FormConfig): Promise<FormResult>;
	/** Register a custom UI renderer. */
	custom?(renderer: UIRenderer, options?: UIOptions): void;
	/** Optional theming helpers (e.g. Pi's `theme.fg`). */
	theme?: { fg?(color: string, text: string): string };
}

/**
 * Context handed to an MCP adapter during initialization. The `ui` field is
 * only populated when `hasUI` is true; callers must still guard it.
 */
export interface AgentContext {
	cwd: string;
	hasUI: boolean;
	ui?: UISystem;
	model?: unknown;
	modelRegistry?: unknown;
	samplingProvider?: SamplingProvider;
	signal?: AbortSignal;
	reload?: () => Promise<void>;
}

/** Registration shape for `AgentAPI.registerTool`. */
export interface ToolRegistration {
	name: string;
	label?: string;
	description?: string;
	promptSnippet?: string;
	parameters?: unknown;
	execute: (...args: unknown[]) => unknown;
	renderCall?: (...args: unknown[]) => unknown;
	renderResult?: (...args: unknown[]) => unknown;
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
