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
 * Resolve the global MCP config directory for Qoder, honoring
 * `process.env.MCP_AGENT_DIR` (D-03 + T-06-01).
 *
 * Precedence (mirrors `agent-dir.ts` lines 7-18):
 *   1. `MCP_AGENT_DIR` env var, trimmed.
 *      - "~"            → `homedir()`
 *      - "~/<rest>"     → `resolve(homedir(), envVar.slice(2))`  (anchored —
 *                         prevents traversal via `~/../../etc`)
 *      - other          → `resolve(envVar)` (must be absolute)
 *   2. default         → `<homedir>/.qoder/agent`
 *
 * Empty-after-trim is treated as unset (returns default).
 */
export function resolveQoderGlobalConfigPath(): string {
  const configured = process.env.MCP_AGENT_DIR?.trim();
  if (!configured) {
    return join(homedir(), ".qoder", "agent");
  }
  if (configured === "~") {
    return homedir();
  }
  if (configured.startsWith("~/")) {
    return resolve(homedir(), configured.slice(2));
  }
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
    globalConfigPath: () => {
      const configured = process.env.MCP_AGENT_DIR?.trim();
      if (!configured) {
        return join(homedir(), ".kilo");
      }
      if (configured === "~") {
        return homedir();
      }
      if (configured.startsWith("~/")) {
        return resolve(homedir(), configured.slice(2));
      }
      return resolve(configured);
    },
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
