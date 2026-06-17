/**
 * @deprecated Legacy agent-coupled MockAgent class.
 *
 * Preserved for historical comparison only. New tests should use the
 * generic MockAgentAPI from `__tests__/fixtures/mock-agent-api.ts`.
 *
 * Per D-08 (Phase 7 CONTEXT): this file is the deprecation tombstone
 * for the inline MockAgent that lived in
 * `tests/compatibility/non-pi-agent.test.ts` (lines 7-30 at the time
 * of extraction). The original file is left untouched per the plan;
 * future plans may revisit it.
 */
import { describe, expect, it } from "vitest";
import type {
	AgentAPI,
	ToolInfo,
	ToolRegistration,
} from "../../interfaces/agent-api.ts";

/**
 * Legacy MockAgent with agent-coupled assumptions baked in.
 *
 * Kept here for comparison with the new generic MockAgentAPI.
 * DO NOT use in new tests.
 *
 * @deprecated Use MockAgentAPI from __tests__/fixtures/mock-agent-api.ts
 */
// biome-ignore lint/complexity/noBannedTypes: preserved verbatim from legacy source for historical comparison
export class MockAgent implements AgentAPI {
	readonly tools = new Map<string, ToolRegistration>();
	readonly commands = new Map<string, Function>();
	readonly flags = new Map<string, string>();
	private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
	readonly messages: unknown[] = [];

	registerTool(tool: ToolRegistration) {
		this.tools.set(tool.name, tool);
	}
	// biome-ignore lint/complexity/noBannedTypes: preserved verbatim from legacy source
	registerCommand(name: string, cfg: Function) {
		this.commands.set(name, cfg);
	}
	// biome-ignore lint/suspicious/noExplicitAny: preserved verbatim from legacy source
	registerFlag(name: string, _cfg: any) {
		this.flags.set(name, "");
	}
	on(event: string, handler: (...args: unknown[]) => void) {
		const list = this.listeners.get(event) ?? [];
		list.push(handler);
		this.listeners.set(event, list);
	}
	emit(event: string, ...args: unknown[]) {
		this.listeners.get(event)?.forEach((h) => h(...args));
	}
	getAllTools(): ToolInfo[] {
		return [...this.tools.values()] as unknown as ToolInfo[];
	}
	getFlag(name: string) {
		return this.flags.get(name);
	}
	sendMessage(message: unknown) {
		this.messages.push(message);
	}
	async exec(command: string, args: string[]) {
		return { command, args };
	}
}

describe("legacy MockAgent (deprecated)", () => {
	it("is preserved for comparison; new code uses MockAgentAPI from __tests__/fixtures/", () => {
		// Trivial smoke test — this file's existence is the deprecation
		// tombstone. The class is exported for historical comparison only.
		expect(typeof MockAgent).toBe("function");
	});
});
