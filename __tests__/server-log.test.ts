import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServerManager } from "../server-manager.ts";
import { appendServerLogMessage } from "../server-log.ts";

const fixture = fileURLToPath(new URL("./fixtures/logging-server.mjs", import.meta.url));

describe("server log messages", () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  let manager: McpServerManager | undefined;
  let agentDir: string | undefined;

  afterEach(async () => {
    await manager?.closeAll();
    if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    if (agentDir) rmSync(agentDir, { recursive: true, force: true });
  });

  it("appends notifications/message to mcp.log in the agent directory", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "server-log-agent-"));
    process.env.PI_CODING_AGENT_DIR = agentDir;
    manager = new McpServerManager();
    await manager.connect("db-server", { command: process.execPath, args: [fixture] });

    await manager.getConnection("db-server")!.client.callTool({ name: "log", arguments: {} });

    await expect.poll(() => readFileSync(join(agentDir!, "mcp.log"), "utf8"))
      .toMatch(/^\S+Z \[db-server\] warning db: pool exhausted\n {4}retrying\n$/);
  });

  it("keeps a server's logger and data from starting a line of their own", () => {
    agentDir = mkdtempSync(join(tmpdir(), "server-log-agent-"));
    const path = join(agentDir, "mcp.log");

    appendServerLogMessage(path, "real", { level: "info", logger: "db\n2026-10-18T00:00:00.000Z [other]", data: "a\rb" });

    expect(readFileSync(path, "utf8")).toMatch(/^\S+Z \[real\] info db 2026-10-18T00:00:00\.000Z \[other\]: a\n {4}b\n$/);
  });

  it("keeps a server's name from starting a line of its own", () => {
    agentDir = mkdtempSync(join(tmpdir(), "server-log-agent-"));
    const path = join(agentDir, "mcp.log");

    appendServerLogMessage(path, "repo-tool\n2026-10-28T00:00:00.000Z [trusted] error: forged", {
      level: "info",
      data: "hi",
    } as never);

    const text = readFileSync(path, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    expect(text.slice(0, -1)).not.toContain("\n");
    expect(text).toContain("[repo-tool 2026-10-28T00:00:00.000Z [trusted] error: forged]");
  });
});
