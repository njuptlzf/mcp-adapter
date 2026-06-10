import { resolve } from "node:path";
import { getAgentPath } from "../agent-dir.ts";

export type AgentId = "pi" | "claude" | "cursor" | (string & {});

export interface AgentPathResolver {
  readonly agentId: AgentId;
  /** Absolute path to the agent's global MCP config file (e.g. ~/.pi/agent/mcp.json). */
  globalConfigPath(): string;
  /** Optional per-agent project override filename. Default: ".{agentId}/mcp.json". */
  projectConfigName?(): string;
}

export function createPiResolver(): AgentPathResolver {
  return {
    agentId: "pi",
    globalConfigPath: () => getAgentPath("mcp.json"),
    projectConfigName: () => ".pi/mcp.json",
  };
}

export const DEFAULT_AGENT_RESOLVER: AgentPathResolver = createPiResolver();

/**
 * Resolve the global MCP config path for a given agent.
 * `overridePath` (if provided) wins — same semantics as the previous getPiGlobalConfigPath.
 */
export function resolveAgentGlobalConfigPath(
  resolver: AgentPathResolver = DEFAULT_AGENT_RESOLVER,
  overridePath?: string,
): string {
  if (overridePath) {
    return resolve(overridePath);
  }
  return resolver.globalConfigPath();
}
