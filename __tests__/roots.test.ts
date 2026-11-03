import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { McpServerManager } from "../server-manager.ts";

const fixture = fileURLToPath(new URL("./fixtures/roots-server.mjs", import.meta.url));

describe("roots", () => {
  let manager: McpServerManager | undefined;
  let sessionDir: string | undefined;

  afterEach(async () => {
    await manager?.closeAll();
    if (sessionDir) rmSync(sessionDir, { recursive: true, force: true });
  });

  it("answers roots/list with the session directory", async () => {
    sessionDir = mkdtempSync(join(tmpdir(), "roots-session-"));
    manager = new McpServerManager(sessionDir);
    await manager.connect("roots", { command: process.execPath, args: [fixture] });

    const result = await manager.getConnection("roots")!.client.callTool({ name: "roots", arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;

    expect(JSON.parse(text)).toEqual([{ uri: pathToFileURL(sessionDir).href, name: basename(sessionDir) }]);
  });

  it("does not offer roots to a server configured with roots: false", async () => {
    sessionDir = mkdtempSync(join(tmpdir(), "roots-session-"));
    manager = new McpServerManager(sessionDir);
    await manager.connect("roots", { command: process.execPath, args: [fixture], roots: false });

    await expect(manager.getConnection("roots")!.client.callTool({ name: "roots", arguments: {} }))
      .rejects.toThrow(/Method not found/);
  });
});
