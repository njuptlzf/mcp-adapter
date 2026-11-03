import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BearerCommandResolver } from "../bearer-command-resolver.ts";
import { resolveCommandSecret } from "../utils.ts";

// POSIX-only syntax: cmd.exe neither expands `$VAR` nor ships `printf`, so on
// Windows this resolves only when `!command` values run through Git Bash.
const POSIX_COMMAND = `!printf '%s' "$PI_MCP_TEST_SECRET"`;

describe("!command secrets use a POSIX shell", () => {
  beforeEach(() => {
    process.env.PI_MCP_TEST_SECRET = "posix-shell-secret";
  });

  afterEach(() => {
    delete process.env.PI_MCP_TEST_SECRET;
  });

  it("resolves header, env and client-secret commands with POSIX syntax", () => {
    expect(resolveCommandSecret(POSIX_COMMAND, "test secret")).toBe("posix-shell-secret");
  });

  it("resolves bearer token commands with POSIX syntax", async () => {
    const resolver = new BearerCommandResolver(POSIX_COMMAND, "test bearer token");
    await expect(resolver.resolve()).resolves.toBe("posix-shell-secret");
  });
});
