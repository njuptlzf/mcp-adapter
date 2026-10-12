/**
 * config-watch.ts — fork-only: detect and self-heal post-startup config changes (issue #34).
 *
 * Problem: consumers (e.g. the DSH codebase-memory plugin) may register or rewrite
 * the adapter's config manifest AFTER the stdio server has already loaded it at
 * process start. The engine treats a programmatically supplied config as a frozen
 * snapshot, so a running process with 0 servers never picks up a manifest written
 * moments later and does not self-heal.
 *
 * This module:
 *  - fingerprints every file the config loader reads (content hash, not mtime, so
 *    idempotent rewrites of the same bytes never trigger restarts);
 *  - polls, and when a change lands it exits the process with code 0. Clients that
 *    supervise the adapter respawn it (issue #34 notes a plain kill is a complete
 *    remedy, and every respawned process re-reads the fresh config);
 *  - exposes `statusNotes()` / `notFoundHint()` so `mcp({})` and tool-not-found
 *    results honestly report the config path and the fact that the on-disk config
 *    diverges from what this process loaded;
 *  - `restartWithFreshConfig()` is the shared implementation behind
 *    `mcp({ action: "reload" })` and the stdio `ctx.reload` hook.
 *
 * ponytail: ceiling — poll-based (3s), not fs.watch (rename-atomic writes and
 * Windows quirks make watch+debounce strictly more code for no benefit here);
 * a scheduled restart can cut an in-flight tool call — the supervisor reconnects.
 * Host-discovered configs (~/.claude.json) and agent-plugin sources are not
 * fingerprinted; the reload action still applies them because it re-runs the
 * full loader.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadMcpConfig } from "./config.ts";

const ABSENT = "absent";
const DEFAULT_POLL_MS = 3000;
const DEFAULT_RESTART_DELAY_MS = 250;

export interface ConfigWatchOptions {
  /** Config files to fingerprint (the loader's read paths, deduped). */
  paths: string[];
  /** --config / MCP_CONFIG_PATH override given to loadMcpConfig, if any. */
  overridePath?: string;
  /** Working directory used for config discovery. */
  cwd?: string;
  /** Server count this process actually loaded at startup. */
  loadedServerCount: number;
  /** Auto-restart on drift; false keeps polling but only warns (MCP_CONFIG_WATCH=0). */
  autoRestart?: boolean;
  pollMs?: number;
  restartDelayMs?: number;
  /** Injected in tests; production exits so the supervisor respawns the adapter. */
  onRestart?: () => void;
  logger?: (line: string) => void;
}

export interface ConfigWatchHandle {
  hasDrift(): boolean;
  freshServerCount(): number | null;
  statusNotes(): string[];
  notFoundHint(registeredServerCount: number): string;
  restartWithFreshConfig(reason: string): string;
  stop(): void;
}

function fingerprint(path: string): string {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return ABSENT;
  }
}

class ConfigWatch implements ConfigWatchHandle {
  private readonly paths: string[];
  private readonly baseline: Map<string, string>;
  private readonly overridePath: string | undefined;
  private readonly cwd: string;
  private readonly loadedServerCount: number;
  private readonly autoRestart: boolean;
  private readonly restartDelayMs: number;
  private readonly onRestart: () => void;
  private readonly logger: (line: string) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pendingRestart = false;
  private warnedDrift = false;

  constructor(options: ConfigWatchOptions) {
    this.paths = [...new Set(options.paths)];
    this.baseline = new Map(this.paths.map((path) => [path, fingerprint(path)] as const));
    this.overridePath = options.overridePath;
    this.cwd = options.cwd ?? process.cwd();
    this.loadedServerCount = options.loadedServerCount;
    this.autoRestart = options.autoRestart !== false;
    this.restartDelayMs = options.restartDelayMs ?? DEFAULT_RESTART_DELAY_MS;
    this.onRestart = options.onRestart ?? (() => process.exit(0));
    this.logger = options.logger ?? ((line: string) => console.error(line));
    const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    if (pollMs > 0) {
      this.timer = setInterval(() => this.checkNow(), pollMs);
    }
  }

  /** Poll tick: drift ⇒ auto-restart, or warn once when restarts are disabled. */
  checkNow(): void {
    if (!this.hasDrift()) {
      this.warnedDrift = false;
      return;
    }
    if (!this.autoRestart) {
      if (!this.warnedDrift) {
        this.warnedDrift = true;
        this.logger('[config-watch] Watched config changed after startup; auto-restart disabled. Run mcp({ action: "reload" }) to apply.');
      }
      return;
    }
    this.restartWithFreshConfig("Watched config file(s) changed after startup");
  }

  hasDrift(): boolean {
    return this.paths.some((path) => fingerprint(path) !== this.baseline.get(path));
  }

  /** Server count the full loader sees right now, or null when it throws. */
  freshServerCount(): number | null {
    try {
      return Object.keys(loadMcpConfig(this.overridePath, this.cwd).mcpServers ?? {}).length;
    } catch {
      return null;
    }
  }

  restartWithFreshConfig(reason: string): string {
    const fresh = this.freshServerCount();
    this.logger(
      `[config-watch] ${reason}. Config now lists ${fresh ?? "an unknown number of"} server(s); `
      + `this process started with ${this.loadedServerCount}. Exiting (code 0) so the client supervisor respawns the adapter with the current config.`,
    );
    if (!this.pendingRestart) {
      this.pendingRestart = true;
      setTimeout(() => this.onRestart(), this.restartDelayMs);
    }
    return `Restarting the adapter to apply the current config (now ${fresh ?? "?"} server(s), process started with ${this.loadedServerCount}). `
      + "Stdout closes now; if your client supervises the adapter it respawns within seconds, otherwise start a new adapter process yourself.";
  }

  statusNotes(): string[] {
    const target = this.paths.length === 1
      ? this.paths[0] ?? "(no config paths)"
      : `${this.paths.length} files: ${this.paths.join(", ")}`;
    const notes = [`Config: ${target} — loaded ${this.loadedServerCount} server(s) at startup (${this.autoRestart ? "auto-restart watching" : "auto-restart disabled by MCP_CONFIG_WATCH"}).`];
    if (this.hasDrift()) {
      const fresh = this.freshServerCount();
      notes.push(`⚠ Watched config changed after this process started${fresh !== null ? ` (now lists ${fresh} server(s))` : ""} — run mcp({ action: "reload" }) to restart and load it.`);
    }
    return notes;
  }

  notFoundHint(registeredServerCount: number): string {
    if (!this.hasDrift()) return "";
    const fresh = this.freshServerCount();
    if (registeredServerCount === 0 && fresh !== null && fresh > 0) {
      return ` No MCP servers are registered in this process, but the watched config now lists ${fresh} — the config was written after this process started. Run mcp({ action: "reload" }) to restart the adapter with the current config.`;
    }
    return ' Note: the watched config file(s) changed after this process started — run mcp({ action: "reload" }) to apply.';
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

let current: ConfigWatch | null = null;

export function startConfigWatch(options: ConfigWatchOptions): ConfigWatch {
  current?.stop();
  current = new ConfigWatch(options);
  return current;
}

export function getConfigWatch(): ConfigWatch | null {
  return current;
}

export function stopConfigWatch(): void {
  current?.stop();
  current = null;
}
