/**
 * adapters/universal-host.ts — Universal MCP stdio host disguised as a Pi
 * `ExtensionAPI`.
 *
 * Stage 2 (fork-host, not fork-engine): instead of the fork's parallel engine
 * (`adapters/entry.ts`) driving registration through the fork `AgentAPI`
 * abstraction, this class implements the *Pi* `ExtensionAPI` surface so the
 * upstream `index.ts` engine (`installMcpAdapter`) can run unchanged against a
 * non-Pi, MCP-stdio host.
 *
 * It is deliberately NOT declared as `implements ExtensionAPI` — the npm
 * `@earendil-works/pi-coding-agent` types degrade `ExtensionAPI` to `any`, so
 * the precise surface below is the fork-owned contract. The caller
 * (`bin/mcp-server.ts`) casts to `ExtensionAPI` at the boundary.
 *
 * Surface implemented (evidence in upstream `index.ts`/`init.ts`/`utils.ts`):
 *   registerTool / registerCommand / registerFlag / getFlag / on / events /
 *   getAllTools / setActiveTools / getActiveTools / unregisterTool /
 *   sendMessage / exec (+ `tools`/`activeTools` stores for MCP ListTools
 *   filtering).
 */

import { EventEmitter } from "node:events";
import type {
	AgentChannel,
	CommandConfig,
	FlagConfig,
	ToolInfo,
	ToolRegistration,
} from "../interfaces/host-types.ts";

type EventHandler = (...args: unknown[]) => void | Promise<void>;

/** Shape of an MCP-status event bus; satisfies upstream's `McpStatusEventBus`. */
export type UniversalStatusEventBus = Pick<EventEmitter, "emit" | "on" | "removeAllListeners">;

/** The fork-owned `ExtensionAPI` contract that upstream `installMcpAdapter` needs. */
export interface UniversalHostSurface {
	registerTool(tool: ToolRegistration): void;
	registerCommand(name: string, config: CommandConfig): void;
	registerFlag(name: string, config: FlagConfig): void;
	getFlag(name: string): string | undefined;
	on(event: string, handler: EventHandler): void;
	getAllTools(): ToolInfo[];
	setActiveTools(names: string[]): void;
	getActiveTools(): string[];
	unregisterTool(name: string): boolean;
	sendMessage(message: unknown, options?: unknown): void;
	exec(command: string, args: string[], options?: unknown): Promise<unknown>;
}

/**
 * A host that presents the Pi `ExtensionAPI` surface backed by in-memory
 * stores, so `index.ts`'s engine can register tools/commands/flags and wire
 * session lifecycle events without a real Pi runtime.
 */
export class UniversalMcpHost implements UniversalHostSurface {
	/** Registered tools by name. Public so MCP `ListTools`/`CallTool` handlers can enumerate. */
	readonly tools = new Map<string, ToolRegistration>();
	/** Registered tools that are currently "active" (surface-visible). */
	private activeTools = new Set<string>();
	/** Registered commands by name (no-op surface for MCP stdio). */
	readonly commands = new Map<string, CommandConfig>();
	/** Registered flags by name. Value mutable so `getFlag` reflects later updates. */
	readonly flags = new Map<string, FlagConfig & { value?: string }>();
	/** Event handlers keyed by event name. */
	private readonly handlers = new Map<string, Set<EventHandler>>();
	/** Status event bus (upstream sets `state.statusEvents = pi.events`). */
	readonly events: UniversalStatusEventBus = new EventEmitter();

	private channel: AgentChannel | undefined;
	private static readonly PREFIX = "[mcp-adapter]";

	// ------------------------------------------------------------------
	// ExtensionAPI surface
	// ------------------------------------------------------------------

	registerTool(tool: ToolRegistration): void {
		this.tools.set(tool.name, tool);
		// Pi auto-activates a registered tool; mirror that so `getActiveTools()`
		// returns the full registered surface unless the engine explicitly
		// `setActiveTools`/`unregisterTool` narrows it.
		this.activeTools.add(tool.name);
	}

	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}

	registerFlag(name: string, config: FlagConfig): void {
		this.flags.set(name, { ...config });
	}

	getFlag(name: string): string | undefined {
		return this.flags.get(name)?.value;
	}

	on(event: string, handler: EventHandler): void {
		let set = this.handlers.get(event);
		if (!set) {
			set = new Set();
			this.handlers.set(event, set);
		}
		set.add(handler);
	}

	getAllTools(): ToolInfo[] {
		return [...this.tools.values()].map((t) => ({ name: t.name }));
	}

	setActiveTools(names: string[]): void {
		this.activeTools = new Set(names);
	}

	getActiveTools(): string[] {
		return [...this.activeTools];
	}

	unregisterTool(name: string): boolean {
		this.activeTools.delete(name);
		return this.tools.delete(name);
	}

	sendMessage(message: unknown, _options?: unknown): void {
		if (this.channel) {
			void this.channel.send(message);
		}
		// No channel — no-op. stderr routing is handled by the channel in main().
	}

	/**
	 * Spawn a child process via node:child_process.spawn.
	 * Used by upstream `openUrl` (OAuth browser launch) and panels.
	 * No path from an untrusted MCP tool result to exec.
	 */
	async exec(command: string, args: string[], _options?: unknown): Promise<unknown> {
		const cp = (await import("node:child_process")) as typeof import("node:child_process");
		return await new Promise<{
			code: number | null;
			stdout: string;
			stderr: string;
		}>((resolvePromise, reject) => {
			const child = cp.spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
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

	// ------------------------------------------------------------------
	// Companion methods (not part of ExtensionAPI)
	// ------------------------------------------------------------------

	/** Attach a universal AgentChannel for bidirectional communication. */
	attachChannel(channel: AgentChannel): void {
		this.channel = channel;
	}

	/** Drive a simulated `session_start` event with the supplied runtime context. */
	async fireSessionStart(ctx: unknown): Promise<void> {
		await this.fire("session_start", "session_start", ctx);
	}

	/** Drive a simulated `session_shutdown` event. */
	async fireSessionShutdown(): Promise<void> {
		await this.fire("session_shutdown");
	}

	/** Drive a simulated `input` event (keep-alive convergence hook). */
	async fireInput(): Promise<void> {
		await this.fire("input");
	}

	/** Drive a simulated `tool_result` event with the result details. */
	async fireToolResult(details: unknown): Promise<void> {
		await this.fire("tool_result", { details });
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	/**
	 * Invoke every handler registered for `event`, catching handler errors so
	 * a single failing listener cannot break the host. Logs error prefix +
	 * event name + handler count only — never the event args.
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
						`${UniversalMcpHost.PREFIX} handler error for event '${event}' (${set.size} handlers): ${(err as Error).message}`,
					);
				}
			}),
		);
	}
}