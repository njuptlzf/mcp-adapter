/**
 * __tests__/config-watch.test.ts — issue #34 self-heal behavior.
 * Real timers with tiny intervals; the loader's fresh count is asserted only via
 * substrings because loadMcpConfig also merges machine-global sources.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getConfigWatch, startConfigWatch, stopConfigWatch } from "../config-watch.ts";

const VALID_CONFIG = JSON.stringify({ mcpServers: { demo: { command: "node", args: ["server.js"] } } });
const TWO_SERVERS = JSON.stringify({
  mcpServers: {
    demo: { command: "node", args: ["server.js"] },
    other: { command: "node", args: ["other.js"] },
  },
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("config-watch", () => {
  let dir: string;
  let cfg: string;
  let logs: string[];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cfgwatch-"));
    cfg = join(dir, "mcp.json");
    logs = [];
  });

  afterEach(() => {
    stopConfigWatch();
    rmSync(dir, { recursive: true, force: true });
  });

  function makeWatch(options?: { autoRestart?: boolean; pollMs?: number; restartDelayMs?: number; onRestart?: () => void }) {
    return startConfigWatch({
      paths: [cfg],
      cwd: dir,
      loadedServerCount: 1,
      pollMs: 0,
      logger: (line) => logs.push(line),
      onRestart: options?.onRestart ?? (() => {}),
      ...options,
    });
  }

  it("reports no drift and no hint when the config is unchanged", () => {
    writeFileSync(cfg, VALID_CONFIG);
    const watch = makeWatch();
    expect(watch.hasDrift()).toBe(false);
    expect(watch.notFoundHint(0)).toBe("");
    expect(watch.notFoundHint(1)).toBe("");
    const notes = watch.statusNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("loaded 1 server(s) at startup");
    expect(notes[0]).toContain(cfg);
  });

  it("detects drift, adds a status warning and a reload hint", () => {
    writeFileSync(cfg, VALID_CONFIG);
    const watch = makeWatch();
    writeFileSync(cfg, TWO_SERVERS);
    expect(watch.hasDrift()).toBe(true);
    const notes = watch.statusNotes();
    expect(notes).toHaveLength(2);
    expect(notes[1]).toContain('mcp({ action: "reload" })');
    expect(watch.notFoundHint(0)).toContain('action: "reload"');
    expect(watch.notFoundHint(5)).toContain("changed after this process started");
  });

  it("does not treat an identical-content rewrite as drift", () => {
    writeFileSync(cfg, VALID_CONFIG);
    const watch = makeWatch();
    writeFileSync(cfg, VALID_CONFIG);
    expect(watch.hasDrift()).toBe(false);
  });

  it("treats a config file appearing after startup as drift", () => {
    const watch = makeWatch(); // cfg absent at baseline
    writeFileSync(cfg, VALID_CONFIG);
    expect(watch.hasDrift()).toBe(true);
  });

  it("restartWithFreshConfig logs, returns guidance, and fires onRestart once", async () => {
    writeFileSync(cfg, VALID_CONFIG);
    let restarts = 0;
    const watch = makeWatch({ restartDelayMs: 5, onRestart: () => { restarts += 1; } });
    const text = watch.restartWithFreshConfig("test reason");
    expect(text).toContain("Restarting the adapter");
    expect(logs[0]).toContain("test reason");
    await sleep(40);
    expect(restarts).toBe(1);
    watch.restartWithFreshConfig("second call");
    await sleep(40);
    expect(restarts).toBe(1); // pendingRestart dedupe — exit is already scheduled
  });

  it("polls and auto-restarts on drift", async () => {
    writeFileSync(cfg, VALID_CONFIG);
    let restarts = 0;
    makeWatch({ pollMs: 10, restartDelayMs: 5, onRestart: () => { restarts += 1; } });
    writeFileSync(cfg, TWO_SERVERS);
    await sleep(80);
    expect(restarts).toBe(1);
  });

  it("warns once without restarting when autoRestart is disabled", async () => {
    writeFileSync(cfg, VALID_CONFIG);
    let restarts = 0;
    makeWatch({ autoRestart: false, pollMs: 10, onRestart: () => { restarts += 1; } });
    writeFileSync(cfg, TWO_SERVERS);
    await sleep(60);
    writeFileSync(cfg, VALID_CONFIG); // back to baseline, drift gone
    await sleep(60);
    writeFileSync(cfg, TWO_SERVERS); // drift again → second warning allowed
    await sleep(60);
    expect(restarts).toBe(0);
    const warnLines = logs.filter((line) => line.includes("auto-restart disabled"));
    expect(warnLines).toHaveLength(2);
  });

  it("manages the module singleton", () => {
    writeFileSync(cfg, VALID_CONFIG);
    const watch = makeWatch();
    expect(getConfigWatch()).toBe(watch);
    stopConfigWatch();
    expect(getConfigWatch()).toBeNull();
  });
});
