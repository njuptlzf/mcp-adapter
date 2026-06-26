/**
 * Qoder-specific adapter — thin wrapper extending `StoreAgentAdapter`.
 *
 * Strategy (STORE-01, STORE-02): the shared in-memory store logic (4 Maps,
 * 7/8 AgentAPI methods, event simulators, exec, bufferedMessages, channel
 * lifecycle) lives in the base class `StoreAgentAdapter`. QoderAdapter only
 * provides Qoder-specific `sendMessage` routing via `Query.streamInput` and
 * the `attachQuery` / `detachQuery` / `getQueryRef` companion methods.
 *
 * The optional UI surface is intentionally minimal (D-07): only `notify`.
 * `form`, `setStatus`, `custom`, and `theme` are explicitly `undefined` so
 * callers can assert their absence.
 *
 * **Threat-model notes**
 *   - T-06-02 (Information Disclosure): all handler error logging lives in
 *     StoreAgentAdapter.fire() and uses `profile.prefix` + event name only.
 *   - T-06-04 (Elevation of Privilege): `exec` lives in StoreAgentAdapter.
 *   - T-06-SC (Tampering): no Pi-Coding-Agent imports. The Pi adapter and
 *     Qoder adapter are isolated.
 */

import { StoreAgentAdapter } from "./store-adapter.ts";
import type {
	AgentContext,
	FormConfig,
	FormResult,
	UISystem,
} from "../interfaces/agent-api.ts";
import type { SamplingProvider } from "../interfaces/sampling.ts";
import type { Query } from "@qoder-ai/qoder-agent-sdk";

/**
 * Shape of the runtime input that `adaptQoderContext` accepts. Intentionally
 * loose — Qoder's session object is far larger, and we only project the
 * fields `AgentContext` cares about.
 */
export interface QoderRuntimeInput {
	cwd: string;
	hasUI: boolean;
	model?: unknown;
	modelRegistry?: unknown;
	signal?: AbortSignal;
	reload?: () => Promise<void>;
	samplingProvider?: SamplingProvider;
}

/** Thin QoderAdapter wrapper extending StoreAgentAdapter (STORE-01, STORE-02). */
export class QoderAdapter extends StoreAgentAdapter {
	/** Live SDK query handle, set via `attachQuery`. */
	private queryRef: Query | undefined;

	constructor() {
		super({
			id: "qoder",
			displayName: "Qoder",
			prefix: "[mcp-adapter/qoder]",
			ui: {
				notify: (message: string, level: "info" | "warning" | "error"): void => {
					const consoleMethod: "info" | "warn" | "error" =
						level === "error" ? "error" : level === "warning" ? "warn" : "info";
					console[consoleMethod](`[mcp-adapter/qoder] ${message}`);
				},
				setStatus: undefined,
				form: undefined,
				custom: undefined,
				theme: undefined,
			},
			sendMessage: (message, _options) => {
				// Agent-specific routing: Query.streamInput → buffer fallback
				if (this.queryRef) {
					const q = this.queryRef as unknown as {
						streamInput?: (
							stream: AsyncIterable<unknown>,
						) => Promise<void>;
					};
					if (typeof q.streamInput === "function") {
						void q.streamInput(
							(async function* () {
								yield message;
							})(),
						);
						return true; // handled
					}
				}
				return false; // fall through to StoreAgentAdapter buffer
			},
		});
	}

	// ----- Qoder-specific companion methods -----

	/**
	 * Attach a live Qoder SDK `Query` so subsequent `sendMessage` calls route
	 * into the active session via `Query.streamInput`. Called by the host
	 * after `query()` returns successfully.
	 *
	 * Legacy companion method — prefer `attachChannel` for new host code.
	 */
	attachQuery(q: Query): void {
		this.queryRef = q;
	}

	/**
	 * Detach the live Query and clear the buffered-message queue.
	 * Per T-06-04: nothing leaks across sessions.
	 */
	detachQuery(): void {
		this.queryRef = undefined;
		this.clearBuffer();
	}

	/** Read-only view of the live query reference (for tests; undefined if detached). */
	getQueryRef(): Query | undefined {
		return this.queryRef;
	}
}

/**
 * Convert a Qoder runtime input into a generic `AgentContext`.
 *
 * Per D-08 and T-06-03: does NOT construct a `QoderSamplingProvider` here.
 * The host passes one in via `input.samplingProvider` (Plan 02 will ship
 * the sampling provider; this adapter stays decoupled from auth surfaces).
 *
 * When `input.hasUI` is true, the adapter's minimal `UISystem` is attached.
 * When `input.hasUI` is false, `ui` is left undefined so callers can detect
 * headless mode.
 */
export function adaptQoderContext(
	input: QoderRuntimeInput,
	adapter?: QoderAdapter,
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
export function adaptQoderUI(adapter: QoderAdapter): UISystem {
	return adapter.ui;
}

// Keep unused-import errors away for ambient FormConfig/FormResult consumers
// in downstream files (these are re-exported via the adapter's public API).
export type { FormConfig, FormResult };