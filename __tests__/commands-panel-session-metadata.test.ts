import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openMcpPanel } from "../commands.ts";
import { computeServerHash } from "../metadata-cache.ts";

const previousAgentDir = process.env.PI_CODING_AGENT_DIR;

afterEach(() => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
});

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("MCP panel", () => {
  it("lists tools a server returned this session even when its listing is not cacheable", async () => {
    // No persistent cache file: the only listing is this session's private one.
    process.env.PI_CODING_AGENT_DIR = mkdtempSync(join(tmpdir(), "pi-mcp-panel-agent-"));
    const github = { url: "https://api.githubcopilot.com/mcp/", directTools: ["get_me"] };
    let rendered = "";
    const ui = {
      notify: vi.fn(),
      custom: vi.fn((factory: any) => {
        const panel = factory({ requestRender() {} }, undefined, undefined, () => {});
        rendered = stripAnsi(panel.render(100).join("\n"));
        panel.handleInput("\x03");
      }),
    };
    const state = {
      programmaticConfig: false,
      config: { mcpServers: { github } },
      authStorageOptions: {},
      manager: { getConnection: () => ({ status: "connected" }) },
      failureTracker: new Map(),
      failureMessages: new Map(),
      sessionMetadata: new Map([["github", {
        configHash: computeServerHash(github),
        tools: [{ name: "get_me" }, { name: "list_issues" }],
        resources: [],
        cacheScope: "private",
        cachedAt: Date.now(),
      }]]),
    } as any;

    await openMcpPanel(state, { getFlag: () => undefined } as any, { hasUI: true, mode: "tui", cwd: tmpdir(), ui } as any);

    expect(rendered).not.toContain("(not cached)");
    expect(rendered).toContain("1/2");
  });
});
