import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { getAgentPath } from "../agent-dir.ts";

export type AgentId = "pi" | "claude" | "cursor" | "universal-mcp" | (string & {});

export interface AgentPathResolver {
  readonly agentId: AgentId;
  /** Absolute path to the agent's global MCP config file (e.g. ~/.pi/agent/mcp.json). */
  globalConfigPath(): string;
  /** Optional per-agent project override filename. Default: ".{agentId}/mcp.json". */
  projectConfigName?(): string;
}

/**
 * Resolve an agent directory from an env var, with tilde expansion.
 * Returns `defaultDir` when the env var is unset or empty-after-trim.
 */
function resolveEnvAgentDir(envVar: string, defaultDir: string): string {
  const configured = process.env[envVar]?.trim();
  if (!configured) return defaultDir;
  if (configured === "~") return homedir();
  if (configured.startsWith("~/")) return resolve(homedir(), configured.slice(2));
  return resolve(configured);
}

export function createPiResolver(): AgentPathResolver {
  return {
    agentId: "pi",
    globalConfigPath: () => getAgentPath("mcp.json"),
    projectConfigName: () => ".pi/mcp.json",
  };
}

/**
 * Universal resolver for the mcp-adapter universal MCP stdio server.
 *
 * Per D-02: config path discovery is --config > MCP_CONFIG_PATH > .mcp.json
 * in cwd > ~/.config/mcp/mcp.json. No agent-specific global paths.
 *
 * This resolver has no env var override for the global config directory.
 * MCP_CONFIG_PATH is handled by the caller (loadMcpConfig / bin entry point),
 * not by the resolver.
 */
export function createUniversalResolver(): AgentPathResolver {
  return {
    agentId: "universal-mcp",
    globalConfigPath: () => join(homedir(), ".config", "mcp", "mcp.json"),
    projectConfigName: () => ".mcp.json",
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
