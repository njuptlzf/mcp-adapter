/**
 * Generic, agent-agnostic AgentAPI mock.
 *
 * Per D-08 (Phase 7 CONTEXT): replaces the legacy agent-coupled MockAgent
 * with a fully generic implementation. Storage mirrors QoderAdapter's
 * Map-based shape so the same tests work uniformly against:
 *   - parametric real adapters expanded via AGENT_ADAPTERS (D-04/D-09)
 *   - this generic mock for server-compat cases that need an injectable
 *     AgentAPI without spawning a real agent host (D-06)
 *
 * Note: zero references to any specific agent ecosystem (per D-08
 * must-have "zero references in the new fixture"). Identifiers like
 * "AgentAPI" / "ToolRegistration" come from the agent-agnostic
 * interface module.
 *
 * Used by:
 *   - __tests__/adapter-contract.test.ts (server-compat cases, D-06)
 *   - __tests__/capability-gate.test.ts (Plan 07-02)
 */
import type {
	AgentAPI,
	CommandConfig,
	FlagConfig,
	ToolInfo,
	ToolRegistration,
} from "../../interfaces/agent-api.ts";

type StoredFlag = FlagConfig & { value?: string };
type EventHandler = (...args: unknown[]) => unknown;

export class MockAgentAPI implements AgentAPI {
	readonly tools = new Map<string, ToolRegistration>();
	readonly commands = new Map<string, CommandConfig>();
	readonly flags = new Map<string, StoredFlag>();
	readonly handlers = new Map<string, Set<EventHandler>>();
	readonly messages: Array<{ message: unknown; options?: unknown }> = [];
	readonly execResults: Array<{ command: string; args: string[]; result: unknown }> = [];
	defaultExecResult: unknown = { code: 0, stdout: "", stderr: "" };

	registerTool(tool: ToolRegistration): void {
		this.tools.set(tool.name, tool);
	}

	registerCommand(name: string, config: CommandConfig): void {
		this.commands.set(name, config);
	}

	registerFlag(name: string, config: FlagConfig): void {
		// Spread so the value field can be mutated later without touching
		// the caller's reference.
		this.flags.set(name, { ...config });
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

	getFlag(name: string): string | undefined {
		const flag = this.flags.get(name);
		return flag ? flag.value : undefined;
	}

	sendMessage(message: unknown, options?: unknown): void {
		this.messages.push({ message, options });
	}

	async exec(command: string, args: string[]): Promise<unknown> {
		const r = this.defaultExecResult;
		this.execResults.push({ command, args, result: r });
		return r;
	}
}
