/**
 * Kilo-specific adapter — thin wrapper extending `StoreAgentAdapter`.
 *
 * Strategy (STORE-01, STORE-02): the shared in-memory store logic (4 Maps,
 * 7/8 AgentAPI methods, event simulators, exec, bufferedMessages, channel
 * lifecycle) lives in the base class `StoreAgentAdapter`. KiloAdapter only
 * provides Kilo-specific `sendMessage` routing via `sendMessageFn` callback
 * and the `attachSendMessage` / `detachSendMessage` companion methods.
 *
 * The optional UI surface is intentionally minimal: only `notify`.
 * `setStatus` is a no-op (Kilo has no status bar). `theme.fg` is an identity
 * function (Kilo's terminal doesn't support ANSI colors).
 */

import { StoreAgentAdapter } from "./store-adapter.ts";
import type {
	AgentContext,
	FormConfig,
	FormResult,
	UISystem,
} from "../interfaces/agent-api.ts";
import type { SamplingProvider } from "../interfaces/sampling.ts";

/**
 * Shape of the runtime input that `adaptKiloContext` accepts. Intentionally
 * loose — Kilo's session object is far larger, and we only project the
 * fields `AgentContext` cares about.
 */
export interface KiloRuntimeInput {
	cwd: string;
	hasUI: boolean;
	model?: unknown;
	modelRegistry?: unknown;
	signal?: AbortSignal;
	reload?: () => Promise<void>;
	samplingProvider?: SamplingProvider;
}

/** Thin KiloAdapter wrapper extending StoreAgentAdapter (STORE-01, STORE-02). */
export class KiloAdapter extends StoreAgentAdapter {
	/** Callback for sending messages, set via `attachSendMessage`. */
	private sendMessageFn: ((message: unknown, options?: unknown) => void) | undefined;

	constructor() {
		super({
			id: "kilo",
			displayName: "Kilo",
			prefix: "[mcp-adapter/kilo]",
			ui: {
				notify: (message: string, level: "info" | "warning" | "error"): void => {
					const consoleMethod: "info" | "warn" | "error" =
						level === "error" ? "error" : level === "warning" ? "warn" : "info";
					console[consoleMethod](`[mcp-adapter/kilo] ${message}`);
				},
				setStatus: (_key: string, _value: string | undefined): void => {
					// Kilo doesn't expose a status bar; silently ignore.
				},
				form: undefined,
				custom: undefined,
				theme: {
					fg: (_color: string, text: string): string => text,
				},
			},
			sendMessage: (message, options) => {
				// Agent-specific routing: sendMessageFn → fall through
				if (this.sendMessageFn) {
					this.sendMessageFn(message, options);
					return true; // handled
				}
				return false; // fall through to StoreAgentAdapter buffer
			},
		});
	}

	// ----- Kilo-specific companion methods -----

	/**
	 * Attach a send-message callback so subsequent `sendMessage` calls route
	 * into the active Kilo session. Called by the host after hook injection.
	 *
	 * Legacy companion method — prefer `attachChannel` for new host code.
	 */
	attachSendMessage(
		fn: (message: unknown, options?: unknown) => void,
	): void {
		this.sendMessageFn = fn;
	}

	/**
	 * Detach the send-message callback and clear the buffered-message queue.
	 */
	detachSendMessage(): void {
		this.sendMessageFn = undefined;
		this.clearBuffer();
	}
}

/**
 * Convert a Kilo runtime input into a generic `AgentContext`.
 *
 * When `input.hasUI` is true, the adapter's minimal `UISystem` is attached.
 * When `input.hasUI` is false, `ui` is left undefined so callers can detect
 * headless mode.
 */
export function adaptKiloContext(
	input: KiloRuntimeInput,
	adapter?: KiloAdapter,
): AgentContext {
	const ctx: AgentContext = {
		cwd: input.cwd,
		hasUI: input.hasUI,
		model: input.model,
		modelRegistry: input.modelRegistry,
		samplingProvider: input.samplingProvider,
		signal: input.signal,
		reload: input.reload,
	};
	if (input.hasUI && adapter) {
		ctx.ui = adapter.ui;
	}
	return ctx;
}

/**
 * Convenience accessor: returns the adapter's UISystem so callers can grab
 * it without instantiating a second copy.
 */
export function adaptKiloUI(adapter: KiloAdapter): UISystem {
	return adapter.ui;
}

export type { FormConfig, FormResult };
