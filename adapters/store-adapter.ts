/**
 * Shared in-memory store adapter base class implementing `AgentAPI`.
 *
 * Consolidates the ~90% identical logic from QoderAdapter (346 lines) and
 * KiloAdapter (298 lines) into a single base class. Subclasses only provide
 * their unique `sendMessage` routing via the STORE-02 constructor-injection
 * pattern (`AgentProfile.sendMessage`).
 *
 * Provides:
 *   - 4 public readonly Maps (tools, commands, flags, handlers)
 *   - 7/8 AgentAPI methods (all except sendMessage, which delegates to
 *     AgentProfile.sendMessage + channel + buffer fallback)
 *   - exec via node:child_process.spawn (dynamic import, tree-shakable)
 *   - Event simulators (fireSessionStart, fireSessionShutdown, fireToolRegistered)
 *   - attachChannel / detachChannel + bufferedMessages (32-limit FIFO)
 *
 * What is NOT here (agent-specific, stays in subclasses):
 *   - attachQuery / detachQuery / getQueryRef (Qoder)
 *   - attachSendMessage / detachSendMessage (Kilo)
 *   - Agent-specific UISystem shapes (Qoder vs Kilo)
 *   - adaptXxxContext / adaptXxxUI functions
 *   - QoderRuntimeInput / KiloRuntimeInput types
 *
 * Design decisions:
 *   - STORE-01: single base class for all in-memory-store agents
 *   - STORE-02: sendMessage routing injected via AgentProfile.sendMessage
 *   - STORE-03: AgentProfile carries per-agent id, displayName, prefix, ui, sendMessage
 *   - STORE-04: PiAdapter unchanged (pass-through pattern, fundamentally different)
 *
 * Threat-model notes:
 *   - T-10-01 (Information Disclosure): fire() logs errors with profile.prefix +
 *     event name + handler count only — never the args, which may carry tokens.
 *   - T-10-02 (Elevation of Privilege): exec() dynamically imports node:child_process;
 *     only called from trusted host code; no path from MCP tool result to exec.
 *   - T-10-03 (Tampering): sendMessage prioritizes channel over profile.sendMessage;
 *     channel.send is typed; no message modification.
 */

import type {
	AgentAPI,
	AgentContext,
	CommandConfig,
	FlagConfig,
	ToolInfo,
	ToolRegistration,
	UISystem,
} from "../interfaces/agent-api.ts";
import type { AgentChannel } from "../interfaces/agent-channel.ts";

/** Maximum number of messages buffered when no channel/send mechanism is attached (test-friendly). */
const SEND_BUFFER_LIMIT = 32;

/**
 * Per-agent configuration profile (STORE-03).
 *
 * Each agent provides a lightweight profile object that the base class uses
 * to configure console logging, UI, and agent-specific message routing.
 */
export interface AgentProfile {
	/** Stable identifier (e.g. "qoder", "kilo"). */
	id: string;
	/** Human-readable name (e.g. "Qoder", "Kilo"). */
	displayName: string;
	/** Console log prefix (e.g. "[mcp-adapter/qoder]"). */
	prefix: string;
	/** Pre-built UISystem. If absent, a minimal notify-only default is constructed. */
	ui?: UISystem;
	/**
	 * Agent-specific message routing (STORE-02).
	 *
	 * Called from `sendMessage` when no channel is attached.
	 * Return `true` if the message was handled; `false` to fall through
	 * to the internal 32-limit FIFO buffer.
	 */
	sendMessage?: (message: unknown, options?: unknown) => boolean;
}

/** Shared in-memory store adapter implementing `AgentAPI`. */
export class StoreAgentAdapter implements AgentAPI {
	/** Registered tools by name. */
	readonly tools = new Map<string, ToolRegistration>();
	/** Registered commands by name. */
	readonly commands = new Map<string, CommandConfig>();
	/** Registered flags by name. Value is mutable so `getFlag` reflects later updates. */
	readonly flags = new Map<string, FlagConfig & { value?: string }>();
	/** Event handlers keyed by event name. Values are Sets to prevent double-registration. */
	readonly handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();

	/** Universal channel, set via `attachChannel`. Takes priority over profile.sendMessage. */
	private channel: AgentChannel | undefined;
	/** Buffered messages captured when no channel/send mechanism is attached (max 32). */
	private bufferedMessages: unknown[] = [];

	/** Per-agent configuration profile. */
	protected readonly profile: AgentProfile;

	/** Minimal UISystem — uses `profile.ui` if provided; otherwise builds a notify-only default. */
	readonly ui: UISystem;

	constructor(profile: AgentProfile) {
		this.profile = profile;
		this.ui = profile.ui ?? {
			notify: (message: string, level: "info" | "warning" | "error"): void => {
				const consoleMethod: "info" | "warn" | "error" =
					level === "error" ? "error" : level === "warning" ? "warn" : "info";
				console[consoleMethod](`${profile.prefix} ${message}`);
			},
		};
	}

	// ----- Companion methods -----

	/**
	 * Attach a universal `AgentChannel` for bidirectional communication.
	 * Takes priority over profile.sendMessage — when a channel is attached,
	 * `sendMessage` routes through `channel.send`.
	 */
	attachChannel(channel: AgentChannel): void {
		this.channel = channel;
	}

	/**
	 * Detach the universal channel, calling `close()` if available, and
	 * clear the buffered-message queue.
	 */
	detachChannel(): void {
		this.channel?.close?.();
		this.channel = undefined;
		this.clearBuffer();
	}

	/** Clear the buffered-message queue (protected — for use by subclasses). */
	protected clearBuffer(): void {
		this.bufferedMessages.length = 0;
	}

	// ----- 8 AgentAPI methods -----

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
		// Only reflect tools registered through the adapter.
		return [...this.tools.values()].map((t) => ({ name: t.name }));
	}

	getFlag(name: string): string | undefined {
		const entry = this.flags.get(name);
		return entry ? entry.value : undefined;
	}

	/**
	 * Send a message via the agent (STORE-02 injection pattern).
	 *
	 * Priority:
	 *   1. Channel (if attached) → channel.send
	 *   2. profile.sendMessage?.(message, options) → if returns true, handled
	 *   3. Internal 32-limit FIFO buffer
	 */
	sendMessage(message: unknown, options?: unknown): void {
		if (this.channel) {
			void this.channel.send(message, options);
			return;
		}
		const handled = this.profile.sendMessage?.(message, options) ?? false;
		if (handled) return;
		// No channel and sendMessage didn't handle — buffer (test-friendly).
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
	 * T-10-02: this method MUST only be invoked from trusted host code
	 * (auth-flow, setup, lifecycle). It must NEVER be reachable from MCP
	 * tool result content. `node:child_process` is imported dynamically
	 * so the module stays tree-shakable when `exec` is unused.
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
	 *
	 * T-10-01: handler errors are caught and logged via `console.error` with
	 * the profile.prefix + event name + handler count only — never the args
	 * themselves, which may carry tokens, message content, or secrets.
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
						`${this.profile.prefix} handler error for event '${event}' (${set.size} handlers): ${(err as Error).message}`,
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
