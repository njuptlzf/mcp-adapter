/**
 * Qoder-specific adapter that implements the generic `AgentAPI` /
 * `AgentContext` / `UISystem` interfaces on top of the Qoder SDK
 * (`@qoder-ai/qoder-agent-sdk`).
 *
 * Strategy (D-02, D-07, D-08, D-09, T-06-02, T-06-04): in-memory store +
 * companion methods. Qoder has no synchronous programmatic registration API
 * equivalent to Pi's `ExtensionAPI.registerTool`, so tools, commands, and
 * flags are kept in the adapter's private maps. The host later bridges
 * `adapter.tools.values()` into `createSdkMcpServer({ tools: [...] })` when
 * the live SDK session is constructed.
 *
 * The optional UI surface is intentionally minimal (D-07): only `notify`.
 * `form`, `setStatus`, `custom`, and `theme` are explicitly `undefined` so
 * callers can assert their absence.
 *
 * **Threat-model notes**
 *   - T-06-02 (Information Disclosure): no raw logger calls outside of the
 *     explicitly-allowed channels. Handler errors are logged with the event
 *     name + handler count only — never the args, which may carry tokens.
 *     `ui.notify` only emits the `[mcp-adapter/qoder]` prefix + caller-
 *     supplied message (the caller already opted in by calling notify).
 *   - T-06-04 (Elevation of Privilege): `exec` uses `node:child_process.spawn`
 *     with stdio piped. It must only be invoked from trusted host code
 *     (auth-flow, setup) — never from MCP tool result content. The adapter
 *     exposes no method that lets MCP tool results reach `exec`.
 *   - T-06-SC (Tampering): no Pi-Coding-Agent imports. The Pi adapter and
 *     Qoder adapter are isolated.
 */

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
import type { SamplingProvider } from "../interfaces/sampling.ts";
import type { Query } from "@qoder-ai/qoder-agent-sdk";

/** Maximum number of messages buffered when no Query is attached (test-friendly). */
const SEND_BUFFER_LIMIT = 32;

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

/** Adapter implementing `AgentAPI` for Qoder. */
export class QoderAdapter implements AgentAPI {
	/** Registered tools by name. The host later bridges these into `createSdkMcpServer`. */
	readonly tools = new Map<string, ToolRegistration>();
	/** Registered commands by name. Surfaced via Qoder's `/` slash-command system. */
	readonly commands = new Map<string, CommandConfig>();
	/** Registered flags by name. Value is mutable so `getFlag` reflects later updates. */
	readonly flags = new Map<string, FlagConfig & { value?: string }>();
	/** Event handlers keyed by event name. Values are Sets to prevent double-registration. */
	readonly handlers = new Map<
		string,
		Set<(...args: unknown[]) => unknown>
	>();

	/** Live SDK query handle, set via `attachQuery`. */
	private queryRef: Query | undefined;
	/** Buffered messages captured when no Query is attached (max 32). */
	private readonly bufferedMessages: unknown[] = [];

	/** Minimal UISystem per D-07: only `notify`. */
	readonly ui: UISystem = {
		notify: (message: string, level: "info" | "warning" | "error"): void => {
			const consoleMethod: "info" | "warn" | "error" =
				level === "error" ? "error" : level === "warning" ? "warn" : "info";
			// T-06-02: caller explicitly opted into console via notify — message
			// content is intentional. No token / secret scanning here.
			console[consoleMethod](`[mcp-adapter/qoder] ${message}`);
		},
		setStatus: undefined,
		form: undefined,
		custom: undefined,
		theme: undefined,
	};

	// ----- Companion methods (NOT part of AgentAPI; host-driven per D-09) -----

	/**
	 * Attach a live Qoder SDK `Query` so subsequent `sendMessage` calls route
	 * into the active session via `Query.streamInput`. Called by the host
	 * after `query()` returns successfully.
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
		this.bufferedMessages.length = 0;
	}

	// ----- 8 AgentAPI methods (D-02 full parity) -----

	registerTool(tool: ToolRegistration): void {
		this.tools.set(tool.name, tool);
	}

	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}

	registerFlag(name: string, config: FlagConfig): void {
		// Spread so the `value` field can be mutated later without touching
		// the caller's object reference.
		this.flags.set(name, { ...config });
	}

	on(
		event: string,
		handler: (...args: unknown[]) => void | Promise<void>,
	): void {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		// Set.add is idempotent — registering the same handler twice is a no-op.
		set.add(handler as (...args: unknown[]) => unknown);
	}

	getAllTools(): ToolInfo[] {
		// Only reflect tools registered through the adapter. Qoder-native
		// tools are merged by Qoder's session on its own; the adapter does
		// not need to enumerate them.
		return [...this.tools.values()].map((t) => ({ name: t.name }));
	}

	getFlag(name: string): string | undefined {
		const entry = this.flags.get(name);
		return entry ? entry.value : undefined;
	}

	sendMessage(message: unknown, _options?: unknown): void {
		if (this.queryRef) {
			const q = this.queryRef as unknown as {
				streamInput?: (
					stream: AsyncIterable<unknown>,
				) => Promise<void>;
			};
			if (typeof q.streamInput === "function") {
				// Wrap the single message in an async iterable so the SDK can consume it.
				void q.streamInput(
					(async function* () {
						yield message;
					})(),
				);
				return;
			}
		}
		// No Query attached or no streamInput — buffer (test-friendly).
		if (this.bufferedMessages.length < SEND_BUFFER_LIMIT) {
			this.bufferedMessages.push(message);
		} else {
			// Drop oldest, keep newest.
			this.bufferedMessages.shift();
			this.bufferedMessages.push(message);
		}
	}

	/**
	 * Spawn a child process via `node:child_process.spawn`. Returns
	 * `{ code, stdout, stderr }` once the process exits.
	 *
	 * **T-06-04**: this method MUST only be invoked from trusted host code
	 * (auth-flow, setup, lifecycle). It must NEVER be reachable from MCP
	 * tool result content. The adapter exposes no path that lets MCP tool
	 * results reach this method.
	 *
	 * `node:child_process` is imported dynamically so the module stays
	 * tree-shakable when `exec` is unused.
	 */
	async exec(command: string, args: string[]): Promise<unknown> {
		const cp = (await import("node:child_process")) as typeof import("node:child_process");
		return await new Promise<{
			code: number | null;
			stdout: string;
			stderr: string;
		}>((resolvePromise, reject) => {
			const child = cp.spawn(command, args, {
				stdio: ["ignore", "pipe", "pipe"],
			});
			const stdoutChunks: Buffer[] = [];
			const stderrChunks: Buffer[] = [];
			child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
			child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
			child.once("error", reject);
			child.once("close", (code) => {
				resolvePromise({
					code,
					stdout: Buffer.concat(stdoutChunks).toString("utf8"),
					stderr: Buffer.concat(stderrChunks).toString("utf8"),
				});
			});
		});
	}

	// ----- Public event simulators (D-09) -----

	/** Drive a simulated `session_start` event with the supplied runtime context. */
	async fireSessionStart(runtimeCtx: AgentContext): Promise<void> {
		await this.fire("session_start", "session_start", runtimeCtx);
	}

	/** Drive a simulated `session_shutdown` event. */
	async fireSessionShutdown(): Promise<void> {
		await this.fire("session_shutdown", "session_shutdown");
	}

	/** Drive a simulated `tool_registered` event with the tool name. */
	async fireToolRegistered(name: string): Promise<void> {
		await this.fire("tool_registered", "tool_registered", name);
	}

	// ----- Private helpers -----

	/**
	 * Invoke every handler registered for `event` with the supplied args.
	 *
	 * T-06-02: handler errors are caught and logged via `console.error` with
	 * the event name + handler count only — never the args themselves, which
	 * may carry tokens, message content, or secrets.
	 */
	private async fire(event: string, ...args: unknown[]): Promise<void> {
		const set = this.handlers.get(event);
		if (!set || set.size === 0) return;
		const handlers = [...set];
		await Promise.all(
			handlers.map(async (h) => {
				try {
					await Promise.resolve(h(...args));
				} catch (err) {
					console.error(
						`[mcp-adapter/qoder] handler error for event '${event}' (${set.size} handlers): ${(err as Error).message}`,
					);
				}
			}),
		);
	}

	// ----- Test-introspection helpers (NOT part of AgentAPI) -----

	/** Read-only view of the buffered messages (for tests). */
	getBufferedMessages(): readonly unknown[] {
		return this.bufferedMessages;
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