import { afterEach, describe, expect, it } from "vitest";
import { readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { executeGuardedDescribe } from "../proxy-modes.ts";
import type { McpExtensionState } from "../state.ts";
import type { McpOutputGuardDetails } from "../mcp-output-guard.ts";

const spillDirectories = new Set<string>();
afterEach(async () => {
  await Promise.all([...spillDirectories].map(path => rm(path, { recursive: true, force: true })));
  spillDirectories.clear();
});

function stateFor(maxBytes = 1024): McpExtensionState {
  return {
    config: {
      mcpServers: { demo: { command: "unused" } },
      settings: { outputGuard: { maxBytes, maxLines: 2000 } },
    },
    toolMetadata: new Map([["demo", [{
      name: "demo_inspect", originalName: "inspect",
      description: "Résumé 🧪 ".repeat(1000),
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    }]]]),
    manager: { getConnection: () => undefined, isConnecting: () => false },
    failureTracker: new Map(),
  } as unknown as McpExtensionState;
}

function trackOutput(result: Awaited<ReturnType<typeof executeGuardedDescribe>>): McpOutputGuardDetails | undefined {
  const guard = result.details.outputGuard as McpOutputGuardDetails | undefined;
  if (guard?.fullOutputPath) spillDirectories.add(dirname(guard.fullOutputPath));
  return guard;
}

describe("model-facing describe output limits", () => {
  it("bounds UTF-8 output and exposes a readable, complete spill file", async () => {
    const state = stateFor();
    const result = await executeGuardedDescribe(state, "demo_inspect");
    const guard = trackOutput(result);
    const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(1024);
    expect(guard?.truncated).toBe(true);
    expect(guard?.fullOutputPath).toBeTruthy();
    expect(text).toContain(guard!.fullOutputPath!);
    const full = await readFile(guard!.fullOutputPath!, "utf8");
    expect(full).toContain(state.toolMetadata.get("demo")![0]!.description);
    expect(full).toContain("query");
    expect(result.details).toMatchObject({ mode: "describe", server: "demo", tool: { name: "demo_inspect" } });
  });

  it("preserves an unabridged schema at the end of an oversized description", async () => {
    const state = stateFor();
    const schema = {
      type: "object", properties: { payload: { $ref: "#/$defs/Payload" } },
      $defs: { Payload: { type: "object", additionalProperties: {}, description: "last-schema-sentinel" } },
    };
    state.toolMetadata.get("demo")![0]!.inputSchema = schema;
    const result = await executeGuardedDescribe(state, "demo_inspect");
    const guard = trackOutput(result);
    expect(guard?.fullOutputPath).toBeTruthy();
    const full = await readFile(guard!.fullOutputPath!, "utf8");
    const json = full.match(/^```json\n([\s\S]*?)\n```/m);
    expect(json).not.toBeNull();
    expect(JSON.parse(json![1]!)).toEqual(schema);
  });

  it("honors the existing outputGuard:false setting", async () => {
    const state = stateFor();
    state.config.settings!.outputGuard = false;
    const result = await executeGuardedDescribe(state, "demo_inspect");
    trackOutput(result);
    expect(result.details.outputGuard).toBeUndefined();
    const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
    expect(text).toContain(state.toolMetadata.get("demo")![0]!.description);
    expect(Buffer.byteLength(text)).toBeGreaterThan(1024);
  });

  it("keeps a failed lookup's diagnostics intact", async () => {
    const result = await executeGuardedDescribe(stateFor(), "demo_missing");
    trackOutput(result);
    expect(result.details).toMatchObject({ mode: "describe", error: "tool_not_found" });
    expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("demo_missing") });
  });
});
