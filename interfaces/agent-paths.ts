import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { getAgentPath } from "../agent-dir.ts";

export type AgentId = "pi" | "claude" | "cursor" | "qoder" | (string & {});

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

/**
 * Resolve the global MCP config directory for Qoder, honoring
 * `process.env.MCP_AGENT_DIR` (D-03 + T-06-01).
 *
 * Precedence:
 *   1. `MCP_AGENT_DIR` env var, trimmed (tilde-expanded via resolveEnvAgentDir).
 *   2. default → `<homedir>/.qoder/agent`
 */
export function resolveQoderGlobalConfigPath(): string {
  return resolveEnvAgentDir("MCP_AGENT_DIR", join(homedir(), ".qoder", "agent"));
}

export function createPiResolver(): AgentPathResolver {
  return {
    agentId: "pi",
    globalConfigPath: () => getAgentPath("mcp.json"),
    projectConfigName: () => ".pi/mcp.json",
  };
}

/**
 * Qoder resolver. Default global config directory is `~/.qoder/agent/`
 * (overridable via `MCP_AGENT_DIR`). Qoder reads `.mcp.json` at the project
 * root, mirroring Pi's contract (per docs.qoder.com).
 *
 * No `DEFAULT_QODER_RESOLVER` is exported — Qoder remains opt-in; the
 * project's default resolver is still Pi for backward compatibility.
 */
export function createQoderResolver(): AgentPathResolver {
  return {
    agentId: "qoder",
    globalConfigPath: () => resolveQoderGlobalConfigPath(),
    projectConfigName: () => ".mcp.json",
  };
}

/**
 * Kilo resolver. Default global config directory is `~/.kilo/`
 * (overridable via `MCP_AGENT_DIR` env var). Kilo reads `.mcp.json`
 * at the project root.
 */
export function createKiloResolver(): AgentPathResolver {
  return {
    agentId: "kilo",
    globalConfigPath: () => resolveEnvAgentDir("MCP_AGENT_DIR", join(homedir(), ".kilo")),
    projectConfigName: () => ".mcp.json",
  };
}

/**
 * Universal resolver for the mcp-adapter universal MCP stdio server.
 *
 * Per D-02: config path discovery is --config > MCP_CONFIG_PATH > .mcp.json
 * in cwd > ~/.config/mcp/mcp.json. No agent-specific global paths.
 *
 * Unlike createKiloResolver / createQoderResolver, this resolver has no
 * env var override for the global config directory. MCP_CONFIG_PATH is
 * handled by the caller (loadMcpConfig / bin entry point), not by the
 * resolver.
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
