import type { AgentAPI, AgentContext, ToolRegistration, ToolInfo, CommandConfig, FlagConfig } from "../../interfaces/agent-api";

export class MockAgent implements AgentAPI {
  readonly tools = new Map<string, ToolRegistration>();
  readonly commands = new Map<string, CommandConfig>();
  readonly flags = new Map<string, string>();
  private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  readonly messages: unknown[] = [];

  registerTool(tool: ToolRegistration) { this.tools.set(tool.name, tool); }
  registerCommand(name: string, cfg: CommandConfig) { this.commands.set(name, cfg); }
  registerFlag(name: string, _cfg: FlagConfig) { this.flags.set(name, ""); }
  on(event: string, handler: (...args: unknown[]) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(handler);
    this.listeners.set(event, list);
  }
  emit(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.forEach(h => h(...args));
  }
  getAllTools(): ToolInfo[] { return [...this.tools.values()] as unknown as ToolInfo[]; }
  getFlag(name: string) { return this.flags.get(name); }
  sendMessage(message: unknown) { this.messages.push(message); }
  async exec(command: string, args: string[]) { return { command, args }; }
}

export function makeContext(overrides?: Partial<AgentContext>): AgentContext {
  return { cwd: process.cwd(), hasUI: false, ...overrides };
}