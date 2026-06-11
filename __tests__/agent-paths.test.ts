import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getAgentPath } from "../agent-dir.ts";
import {
  DEFAULT_AGENT_RESOLVER,
  createPiResolver,
  resolveAgentGlobalConfigPath,
  type AgentPathResolver,
} from "../interfaces/agent-paths.ts";

describe("AgentPathResolver", () => {
  const originalHome = process.env.HOME;
  const originalPiDir = process.env.PI_CODING_AGENT_DIR;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (originalPiDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalPiDir;
    }
  });

  it("createPiResolver returns a resolver whose globalConfigPath equals getAgentPath('mcp.json')", () => {
    const resolver = createPiResolver();
    expect(resolver.agentId).toBe("pi");
    expect(resolver.globalConfigPath()).toBe(getAgentPath("mcp.json"));
  });

  it("a custom resolver can be passed to resolveAgentGlobalConfigPath and returns the custom path", () => {
    const customResolver: AgentPathResolver = {
      agentId: "claude",
      globalConfigPath: () => "/tmp/claude/mcp.json",
    };
    expect(resolveAgentGlobalConfigPath(customResolver)).toBe("/tmp/claude/mcp.json");
  });

  it("resolveAgentGlobalConfigPath honors overridePath and applies resolve() semantics", () => {
    const home = mkdtempSync(join(tmpdir(), "pi-mcp-paths-home-"));
    process.env.HOME = home;
    const override = "./relative/mcp.json";
    const result = resolveAgentGlobalConfigPath(undefined, override);
    expect(result).toBe(resolve(override));
  });

  it("DEFAULT_AGENT_RESOLVER is exported and equals createPiResolver()", () => {
    expect(DEFAULT_AGENT_RESOLVER).toBeDefined();
    expect(DEFAULT_AGENT_RESOLVER.agentId).toBe("pi");
    expect(DEFAULT_AGENT_RESOLVER.globalConfigPath()).toBe(createPiResolver().globalConfigPath());
  });
});
