import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  DEFAULT_AGENT_RESOLVER,
  resolveAgentGlobalConfigPath,
  type AgentPathResolver,
} from "../interfaces/agent-paths.ts";
import { getAgentGlobalConfigPath } from "../config.ts";

describe("agent path resolution integration", () => {
  const originalPiDir = process.env.PI_CODING_AGENT_DIR;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalPiDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalPiDir;
    }
  });

  it("getConfigSources is intentionally not part of the public surface (resolver is)", async () => {
    const mod = await import("../config.ts");
    expect((mod as unknown as { getConfigSources?: unknown }).getConfigSources).toBeUndefined();
  });

  it("default resolver honors PI_CODING_AGENT_DIR and returns the agent-specific path", () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "pi-mcp-agent-paths-"));
    process.env.PI_CODING_AGENT_DIR = tmpRoot;
    const expected = resolve(tmpRoot, "mcp.json");
    expect(getAgentGlobalConfigPath()).toBe(expected);
    expect(resolveAgentGlobalConfigPath(DEFAULT_AGENT_RESOLVER)).toBe(expected);
  });

  it("a non-Pi resolver returns a path distinct from the Pi default", () => {
    const customPath = "/tmp/claude/mcp.json";
    const stubResolver: AgentPathResolver = {
      agentId: "claude",
      globalConfigPath: () => customPath,
    };
    const result = getAgentGlobalConfigPath(stubResolver);
    expect(result).toBe(customPath);
    expect(result).not.toBe(getAgentGlobalConfigPath());
  });
});
