import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { createMcpPanel } from "../mcp-panel.ts";

const mocks = vi.hoisted(() => ({ createMcpPanel: vi.fn() }));

vi.mock("../mcp-panel.ts", () => ({ createMcpPanel: mocks.createMcpPanel }));

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

describe("saving direct tools for a project server from the panel", () => {
  let root: string;
  let home: string;
  let cwd: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "mcp-panel-approval-"));
    home = join(root, "home");
    cwd = join(root, "project");
    mkdirSync(cwd, { recursive: true });
    vi.resetModules();
    vi.stubEnv("HOME", home);
    vi.stubEnv("PI_PACKAGE_DIR", "");
    vi.stubEnv("PI_CODING_AGENT_DIR", join(home, ".pi", "agent"));
    vi.stubEnv("PI_MCP_CONFIG_MODE", "merge");
    writeJson(join(home, ".pi", "agent", "mcp-adapter.json"), { mcpServers: { github: { url: "https://example.test/mcp", auth: "bearer" } } });
    writeJson(join(cwd, ".mcp.json"), { mcpServers: { github: { url: "https://example.test/mcp" } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  // One session: the trust pass at startup answers the approval prompt, then the panel saves a direct tool.
  async function sessionThenNextPrompts(answer: "Allow" | "Don't allow"): Promise<number> {
    const { loadMcpConfig } = await import("../config.ts");
    const { applyProjectServerTrustToConfig } = await import("../project-server-trust.ts");
    const { openMcpPanel } = await import("../commands.ts");
    const ctx = (select: unknown) => ({ cwd, hasUI: true, mode: "tui", isProjectTrusted: () => true, ui: { select } }) as any;

    const { config } = await applyProjectServerTrustToConfig(loadMcpConfig(undefined, cwd), ctx(vi.fn(async () => answer)));
    mocks.createMcpPanel.mockImplementationOnce((...args: Parameters<typeof createMcpPanel>) => {
      args[5]({ cancelled: false, changes: new Map([["github", ["get_me"]]]), disabledChanges: new Map() });
      return { render: () => [], invalidate: () => {}, handleInput: () => {} };
    });
    const ui = {
      notify: vi.fn(),
      custom: vi.fn((factory: any) => { factory({ requestRender() {} }, undefined, undefined, () => {}); }),
    };
    await openMcpPanel(
      { programmaticConfig: false, config, authStorageOptions: {}, manager: { getConnection: () => undefined }, failureTracker: new Map(), failureMessages: new Map() } as any,
      { getFlag: () => undefined } as any,
      { ...ctx(vi.fn()), ui } as any,
    );
    expect(loadMcpConfig(undefined, cwd).mcpServers.github.directTools).toEqual(["get_me"]);

    const nextSelect = vi.fn(async () => "Allow");
    await applyProjectServerTrustToConfig(loadMcpConfig(undefined, cwd), ctx(nextSelect));
    return nextSelect.mock.calls.length;
  }

  it("keeps the approval the user already gave", async () => {
    expect(await sessionThenNextPrompts("Allow")).toBe(0);
  });

  it("does not approve a server the user did not allow", async () => {
    expect(await sessionThenNextPrompts("Don't allow")).toBe(1);
  });

  it("does not carry the approval over a change other than direct tools", async () => {
    const { loadMcpConfig } = await import("../config.ts");
    const { applyProjectServerTrustToConfig, keepProjectServerApprovals } = await import("../project-server-trust.ts");
    const ctx = (select: unknown) => ({ cwd, hasUI: true, mode: "tui", isProjectTrusted: () => true, ui: { select } }) as any;
    const before = loadMcpConfig(undefined, cwd);
    await applyProjectServerTrustToConfig(before, ctx(vi.fn(async () => "Allow")));

    writeJson(join(cwd, ".mcp.json"), { mcpServers: { github: { url: "https://other.test/mcp", directTools: ["get_me"] } } });
    const after = loadMcpConfig(undefined, cwd);
    keepProjectServerApprovals(ctx(vi.fn()), before, after, ["github"]);

    const nextSelect = vi.fn(async () => "Allow");
    await applyProjectServerTrustToConfig(after, ctx(nextSelect));
    expect(nextSelect).toHaveBeenCalledTimes(1);
  });
});
