/**
 * Kilo-specific adapter that implements the generic `AgentAPI` /
 * `AgentContext` / `UISystem` interfaces for the Kilo coding agent.
 *
 * Strategy: in-memory store + companion methods, mirroring the QoderAdapter
 * pattern. Kilo has no synchronous programmatic registration API equivalent
 * to Pi's `ExtensionAPI.registerTool`, so tools, commands, and flags are
 * kept in the adapter's private maps. The host later bridges
 * `adapter.tools.values()` into Kilo's runtime when the session is
 * constructed (e.g. via hook injection).
 *
 * The optional UI surface is intentionally minimal: only `notify`.
 * `form`, `setStatus`, `custom`, and `theme` are explicitly `undefined` so
 * callers can assert their absence.
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
import type { AgentChannel } from "../interfaces/agent-channel.ts";

/** Maximum number of messages buffered when no send mechanism is available (test-friendly). */
const SEND_BUFFER_LIMIT = 32;

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

/** Adapter implementing `AgentAPI` for Kilo. */
export class KiloAdapter implements AgentAPI {
	/** Registered tools by name. The host later bridges these into Kilo's runtime. */
	readonly tools = new Map<string, ToolRegistration>();
	/** Registered commands by name. */
	readonly commands = new Map<string, CommandConfig>();
	/** Registered flags by name. Value is mutable so `getFlag` reflects later updates. */
	readonly flags = new Map<string, FlagConfig & { value?: string }>();
	/** Event handlers keyed by event name. Values are Sets to prevent double-registration. */
	readonly handlers = new Map<
		string,
		Set<(...args: unknown[]) => unknown>
	>();

	/** Callback for sending messages, set via `attachSendMessage`. */
	private sendMessageFn: ((message: unknown, options?: unknown) => void) | undefined;
	/** Universal channel, set via `attachChannel`. Takes priority over `sendMessageFn`. */
	private channel: AgentChannel | undefined;
	/** Buffered messages captured when no send function is attached (max 32). */
	private readonly bufferedMessages: unknown[] = [];

	/** Minimal UISystem: notify + setStatus + no-op theme. */
	readonly ui: UISystem = {
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
	};

	// ----- Companion methods (NOT part of AgentAPI; host-driven) -----

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
		this.bufferedMessages.length = 0;
	}

	/**
	 * Attach a universal `AgentChannel` for bidirectional communication.
	 * Takes priority over `attachSendMessage` — when a channel is attached,
	 * `sendMessage` routes through `channel.send`.
	 */
	attachChannel(channel: AgentChannel): void {
		this.channel = channel;
	}

	/**
	 * Detach the universal channel, calling `close()` if available, then
	 * fall back to the legacy detach behavior.
	 */
	detachChannel(): void {
		this.channel?.close?.();
		this.channel = undefined;
		this.detachSendMessage();
	}

	// ----- 8 AgentAPI methods -----

	registerTool(tool: ToolRegistration): void {
		this.tools.set(tool.name, tool);
	}

	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}

	registerFlag(name: string, config: FlagConfig): void {
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
		set.add(handler as (...args: unknown[]) => unknown);
	}

	getAllTools(): ToolInfo[] {
		return [...this.tools.values()].map((t) => ({ name: t.name }));
	}

	getFlag(name: string): string | undefined {
		const entry = this.flags.get(name);
		return entry ? entry.value : undefined;
	}

	sendMessage(message: unknown, options?: unknown): void {
		if (this.channel) {
			void this.channel.send(message, options);
			return;
		}
		if (this.sendMessageFn) {
			this.sendMessageFn(message, options);
			return;
		}
		// No channel or send function attached — buffer (test-friendly).
		if (this.bufferedMessages.length < SEND_BUFFER_LIMIT) {
			this.bufferedMessages.push(message);
		} else {
			this.bufferedMessages.shift();
			this.bufferedMessages.push(message);
		}
	}

	/**
	 * Spawn a child process via `node:child_process.spawn`. Returns
	 * `{ code, stdout, stderr }` once the process exits.
	 *
	 * **Security**: this method MUST only be invoked from trusted host code
	 * (auth-flow, setup, lifecycle). It must NEVER be reachable from MCP
	 * tool result content.
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

	// ----- Public event simulators -----

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
	 * Handler errors are caught and logged with the event name + handler
	 * count only — never the args themselves.
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
						`[mcp-adapter/kilo] handler error for event '${event}' (${set.size} handlers): ${(err as Error).message}`,
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
