/**
 * interfaces/host-types.ts — Fork-owned shared types for the universal
 * MCP-stdio host and its protocol forwarders.
 *
 * Stage 2 consolidation: these are the only types from the retired
 * `interfaces/agent-api.ts` / `interfaces/agent-channel.ts` parallel-engine
 * abstraction that the upstream-engine host still needs. They are pure,
 * agent-agnostic data shapes (no `AgentAPI` contract, no adapter registry).
 */

/** A registered tool's information, as exposed by a host. */
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
 * The subset of host UI capabilities the upstream engine / init.ts consume.
 * `notify` is the minimum; all else is optional.
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
	/** Optional theming helpers. */
	theme?: { fg?(color: string, text: string): string } | undefined;
}

/** A tool registration stored by the host and exposed over MCP `tools/list`. */
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

/** Configuration for a registered command (no-op surface on MCP stdio). */
export interface CommandConfig {
	description?: string;
	handler: (...args: unknown[]) => unknown;
	[key: string]: unknown;
}

/** Configuration for a registered flag. */
export interface FlagConfig {
	description?: string;
	type?: string;
	[key: string]: unknown;
}

/**
 * Universal bidirectional communication channel between the host and its
 * owning process. `send` is host → owner; `close` is optional.
 */
export interface AgentChannel {
	send(message: unknown, options?: unknown): void | Promise<void>;
	close?(): void | Promise<void>;
}