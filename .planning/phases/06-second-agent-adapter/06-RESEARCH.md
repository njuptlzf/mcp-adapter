# Phase 6: Second Agent Adapter — Research

**Researched:** 2026-06-16
**Domain:** Adapter portability — bridging universal `AgentAPI` to Qoder's runtime SDK
**Confidence:** MEDIUM (Qoder SDK is new and lightly documented; runtime surface verified via npm package inspection and docs.qoder.com summaries, but live integration is unproven at the time of writing)

## Summary

Phase 6's central goal is to prove the universal `createMcpAdapter()` entry point is genuinely agent-agnostic by adding a second concrete adapter that targets **Qoder** (qodercli runtime, version 1.0.19 verified on this machine). Unlike Pi where `ExtensionAPI` exposes direct synchronous registration methods (`pi.registerTool`, `pi.registerCommand`, `pi.on`, …), Qoder's extension surface is **declarative plus subprocess**: tools are defined via `tool()` and exposed through `createSdkMcpServer()` which is then passed to a `query()` session; lifecycle hooks are configured in the host's `options.hooks`; commands live in `commands/*.md` next to a `.qoder-plugin/plugin.json`; and there is no first-class programmatic `registerCommand`/`registerFlag`/`sendMessage`/`exec` API. CONTEXT D-09 already anticipates this asymmetry by accepting that Qoder's `on` event surface is *simulated* in the adapter, not subscribed natively. The deliverable is therefore a storage- and runtime-bridging adapter that satisfies all 8 `AgentAPI` methods through in-memory state plus the Qoder Agent SDK (`@qoder-ai/qoder-agent-sdk@1.0.3`) where a live runtime is reachable, and falls back to a deterministic in-process behavior in tests.

The package legitimacy audit flags `@qoder-ai/qoder-agent-sdk` as **SUS** (too-new, low weekly downloads, no npm-repo link); the planner must insert a `checkpoint:human-verify` task before any new npm install of that dependency. The postinstall script is documented and benign (downloads `qodercli` binary), but it should be reviewed by the human before any CI install.

**Primary recommendation:** Build `QoderAdapter` as a **runtime-bridging + storage adapter** (mirrors the shape of `PiAdapter`), keep all Qoder-specific imports quarantined in `adapters/qoder-adapter.ts` and `adapters/qoder-sampling-provider.ts`, place `createQoderResolver` next to `createPiResolver` in `interfaces/agent-paths.ts`, and prove correctness via a contract test (`__tests__/qoder-adapter.test.ts`) plus an integration test (`__tests__/qoder-adapter-integration.test.ts`) that calls the real `initializeMcp` against all 10 demo MCP servers defined in `.mcp.json` (Path A or Path B depending on which `mcp` tool surfaces through the adapter).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Target agent is **Qoder** (current runtime environment), integrate directly with the real Qoder API (not a mock).
- **D-02:** Full parity — implement **all** `AgentAPI` methods (`registerTool`, `registerCommand`, `registerFlag`, `on`, `getAllTools`, `getFlag`, `sendMessage`, `exec`) to match `PiAdapter`'s capability surface.
- **D-03:** Qoder `AgentPathResolver` default is `~/.qoder/agent/`; `MCP_AGENT_DIR` env var overrides.
- **D-04:** Factory named `createQoderResolver`, placed in `interfaces/agent-paths.ts` (or a sibling file under `interfaces/`).
- **D-05:** Implement a Qoder sampling provider (`QoderSamplingProvider`) that talks to Qoder's LLM surface; explore how Qoder calls models (does it have a `model/complete` equivalent?).
- **D-06:** Sampling boundary isolated to `adapters/qoder-sampling-provider.ts` — must not pollute the generic `sampling-handler.ts`.
- **D-07:** `UISystem` is **minimal** — only `notify`. `form`, `statusBar`, `theme` are optional (the `UISystem` interface already supports optional).
- **D-08:** `registerCommand` is wired to Qoder's `/` slash-command system (commands registered to Qoder's command palette).
- **D-09:** `on` events are **simulated** via Qoder's message system (e.g. `sendMessage`) — not dependent on a Pi-style native `on('event', cb)` mechanism.
- **D-10:** Verification is full-flow parity — run the entire `mcp-adapter-test` plan (Section 4 MockAgent compatibility → Section 5 token benchmark → Section 6 E2E all 10 demo MCP servers), producing a report equal in coverage to the Pi adapter's.
- **D-11:** File layout:
  - `adapters/qoder-adapter.ts` — AgentAPI implementation
  - `adapters/qoder-sampling-provider.ts` — sampling adapter (if implemented)
  - `adapters/qoder-renderer.ts` — rendering adapter (if needed)
  - `interfaces/agent-paths.ts` (or sibling) — `createQoderResolver`
  - `__tests__/qoder-adapter.test.ts` — contract test
  - `__tests__/qoder-adapter-integration.test.ts` — integration test

### the agent's Discretion
None — discussion stayed within phase scope; no items explicitly delegated to the agent.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADAPTER-01 | Implement at least one non-Pi `AgentAPI` adapter (e.g., QoderAdapter) in `adapters/` | Standard Stack §Core + Architecture Pattern 1 |
| ADAPTER-02 | Implement the corresponding `AgentPathResolver` for the new agent | Architecture Pattern 2 + Don't Hand-Roll §path |
| ADAPTER-03 | Integration test proving the new adapter works with `initializeMcp()` | Common Pitfalls §1, §3 + Validation Architecture §Phase Requirements → Test Map |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool registration (`registerTool`) | API / Adapter (`adapters/qoder-adapter.ts`) | — | Qoder exposes tools via `createSdkMcpServer().tool()`; adapter must queue these until the `query()` session is opened, then attach them via `mcpServers`. |
| Slash-command registration (`registerCommand`) | API / Adapter | Browser (Qoder command palette) | No runtime programmatic API — adapter stores commands in memory; commands are *declared* in `commands/*.md` for Qoder IDE consumption; the in-process handler is invoked when the user triggers the command via the SDK session. |
| Flag registration (`registerFlag`) | API / Adapter | — | No first-class API; adapter maintains a `Map<string, FlagConfig>` keyed by name. `getFlag(name)` reads from this map. |
| Event subscription (`on`) | API / Adapter | — | Per D-09 — simulated. The adapter maintains a handler map keyed by event name. The host (e.g. an SDK session wrapper) fires `session_start` / `session_shutdown` explicitly. |
| Sampling (`SamplingProvider`) | API / Adapter (`adapters/qoder-sampling-provider.ts`) | Frontend Server (Qoder session) | Qoder Agent SDK exposes models via `Options.model` and `Query.setModel()`; `resolveModel` returns a `SamplingModel`; `complete` must issue a single-turn `query()` and extract text content. The Qoder SDK does not expose a `complete()`-style primitive — synthesis goes through a fresh `query()` call. |
| Tool discovery (`getAllTools`) | API / Adapter | — | Adapter returns its own registered tools plus any `mcp__*` tools known to be live in the current `query()` session (populated by listening to `SDKSystemMessage`). |
| Outbound message (`sendMessage`) | API / Adapter | Frontend Server (Qoder session) | No equivalent of `pi.sendMessage`. Adapter buffers; if a `Query` handle is attached, push a `SDKUserMessage` via the query's stream input. Otherwise no-op. |
| Shell exec (`exec`) | API / Adapter | OS process | Not part of the Qoder SDK. Adapter uses Node `child_process.spawn` (mirroring `utils.ts:openUrl` style). |
| UI surface (`notify`) | API / Adapter | Frontend Server (Qoder session) | Per D-07 — minimal. Adapter exposes a `notify(message, level)` that writes to `console.info/warn/error` (Qoder CLI captures stderr/stdout). The structured `UISystem` object attached to `AgentContext.ui` is a thin adapter-side wrapper. |
| Path resolution (`AgentPathResolver`) | API / Adapter | Filesystem | `createQoderResolver` returns `{ agentId: "qoder", globalConfigPath: () => join(homedir(), ".qoder", "agent", "mcp.json"), projectConfigName: () => ".mcp.json" }`. |
| Config loading | Frontend Server / `config.ts` | — | Already generic; reads from `AgentPathResolver`. |
| MCP server connection | API / Backend (`init.ts` → `server-manager.ts`) | — | Unchanged from Phase 5. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@qoder-ai/qoder-agent-sdk` | `1.0.3` [VERIFIED: npm registry, package inspected at `/tmp/qoder-sdk-extracted`] | Spawns qodercli subprocess, exposes `query()`, `createSdkMcpServer()`, `tool()`, hooks, control protocol (`setModel`, `getModels`, `reloadPlugins`) | The only first-party TypeScript SDK shipped by Qoder for programmatic access to qodercli. Without it, Phase 6 cannot satisfy D-01 ("real Qoder API"). |
| `@modelcontextprotocol/sdk` | `^1.25.1` (already a dep) | MCP wire types used by `SamplingProvider` interface and tool result handling | Already required by the project — no new install needed. |
| `node:child_process` | Node built-in | Implements `QoderAdapter.exec` (no equivalent in Qoder SDK) | Native; no new dependency. |
| `node:os` / `node:path` | Node built-ins | Implements `createQoderResolver` path math (`homedir()`, `join`) | Same as `agent-dir.ts` uses for Pi. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `^3.0.0` (devDep, already installed) | Contract + integration tests | Already the project's test runner; `__tests__/*.test.ts` pattern is established. |
| `tsx` | `^4.21.0` (devDep) | Runs the 10 demo MCP servers + future Qoder integration scripts | Used by `.mcp.json` for `npx tsx tests/demo-servers/.../server.ts` — no change needed. |
| `typebox` | `^1.1.24` (already a dep) | Schema types for proxy tool parameters | Reused in `createMcpAdapter`'s `mcp` tool registration. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@qoder-ai/qoder-agent-sdk` | Spawning `qodercli` directly via `child_process.spawn` and parsing its NDJSON stdout manually | The SDK already does this with proper type-safe message envelopes (`SDKMessage` discriminated union). Hand-rolled protocol handling would double the maintenance surface and lose message types like `SDKSystemInitMessage`, `SDKResultMessage`, etc. |
| Storing tools/commands/flags in adapter memory | Writing them to `~/.qoder/.qoder-plugin/plugin.json` + `commands/*.md` at adapter construction | The declarative path only takes effect on next `qodercli` restart; runtime `query()` cannot consume freshly-written commands within the same session. In-memory storage lets the adapter satisfy the `AgentAPI` contract synchronously while a separate (optional) companion `.qoder-plugin/` directory can be written for IDE persistence. |
| Using `piRenderWrapper` style for Qoder renderers | Implementing `qoder-renderer.ts` to wrap strings into Qoder's render envelope | Qoder's tool renderers are defined at the **tool definition** level via `tool()` — there is no separate renderer wrap. The `adapters/qoder-renderer.ts` file from D-11 is **optional** and most likely ends up being a thin pass-through (e.g., `export type RenderOutput = string;`). Keep the file as a placeholder; the planner should let Wave 1 decide whether to create it. |

**Installation:**
```bash
npm install --save @qoder-ai/qoder-agent-sdk@^1.0.3
```

**Version verification:** Confirmed via `npm view @qoder-ai/qoder-agent-sdk version` → `1.0.3`, published `2026-06-11`, integrity `sha512-cIw7…LREg==`. The package tarball was extracted to `/tmp/qoder-sdk-extracted` and the type declarations verified directly.

⚠️ **Important:** The package has a `postinstall` script (`scripts/postinstall.cjs`) that downloads the `qodercli` binary from `https://download.qoder.com/qodercli/releases`. In sandboxed CI or air-gapped environments, set `QODER_SKIP_DOWNLOAD=1` (the SDK script honors this env var). On developer machines with `qodercli` already installed (verified on this machine via `command -v qodercli`), the postinstall is a no-op duplicate.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@qoder-ai/qoder-agent-sdk` | npm | 5 days (published 2026-06-11) | 693/wk | none on npm (docs link only) | **SUS** | Flagged — planner must add `checkpoint:human-verify` before install; maintainer is `qoder-dev <dev@qoder.com>` (first-party) |
| `@modelcontextprotocol/sdk` | npm | existing dep | 39.4M/wk | github.com/modelcontextprotocol/typescript-sdk | OK | Approved (already in `package.json`) |

**Packages removed due to SLOP verdict:** none
**Packages flagged as SUS:**
- `@qoder-ai/qoder-agent-sdk` — too-new + low-downloads + no-repo link on npm. Reasoning:
  - The maintainer email `dev@qoder.com` matches the Qoder vendor.
  - The package is the official TypeScript SDK per `docs.qoder.com/en/cli/sdk/references` (verified via WebSearch summary).
  - It declares `@modelcontextprotocol/sdk` as its only runtime dep — surface is narrow and matches docs.
  - The `postinstall` is documented (downloads the `qodercli` binary; honors `QODER_SKIP_DOWNLOAD`).
  - **Risk:** As of 2026-06-16 the SDK is less than one week old. Wire-protocol or type-shape churn is plausible. Pin the version (`^1.0.3`) and re-evaluate at next minor release.

*Packages discovered via WebSearch or training data that have not been verified against an authoritative source are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.* — `@qoder-ai/qoder-agent-sdk` was verified via npm registry + tarball inspection + docs.qoder.com WebSearch summary, so it is `[VERIFIED: docs.qoder.com/cli/sdk]` even though the legitimacy seam returned SUS.

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────────────────────────────────────┐
                │   Qoder CLI Runtime (qodercli subprocess)                  │
                │                                                             │
                │   ┌──────────────────────┐  ┌──────────────────────────┐    │
                │   │  Native MCP servers  │  │  User-defined commands   │    │
                │   │  (from .mcp.json)    │  │  (from commands/*.md)    │    │
                │   └──────────────────────┘  └──────────────────────────┘    │
                └─────────────────────────┬───────────────────────────────────┘
                                          │  JSON-line protocol
                                          ▼
                ┌─────────────────────────────────────────────────────────────┐
                │   Host code (Node)                                          │
                │                                                             │
                │   ┌────────────────────────────────────────────────────┐    │
                │   │  QueryRunner / Query  (from @qoder-ai/...)         │    │
                │   │   - inputStream: AsyncIterable<SDKUserMessage>     │    │
                │   │   - control: setModel, reloadPlugins, …            │    │
                │   │   - mcpServers: Record<string, McpServerConfig>    │    │
                │   └────────────────┬───────────────────────────────────┘    │
                │                    │                                        │
                │   ┌────────────────▼───────────────────────────────────┐    │
                │   │  QoderAdapter  (adapters/qoder-adapter.ts)         │    │
                │   │   implements AgentAPI:                              │    │
                │   │     registerTool, registerCommand, registerFlag,   │    │
                │   │     on, getAllTools, getFlag, sendMessage, exec    │    │
                │   │   internal: tools, commands, flags, handlers       │    │
                │   └────────────────┬───────────────────────────────────┘    │
                │                    │ AgentAPI instance                     │
                │   ┌────────────────▼───────────────────────────────────┐    │
                │   │  createMcpAdapter(agentapi, ctx, config, cache)     │    │
                │   │  (adapters/entry.ts — unchanged from Phase 5)       │    │
                │   └────────────────┬───────────────────────────────────┘    │
                │                    │                                        │
                │   ┌────────────────▼───────────────────────────────────┐    │
                │   │  Core Logic (init.ts, proxy-modes.ts, …)           │    │
                │   │   - calls agentapi.registerTool / on / exec / …    │    │
                │   │   - calls initializeMcp(agentapi, ctx)             │    │
                │   └────────────────────────────────────────────────────┘    │
                │                                                             │
                │   ┌────────────────────────────────────────────────────┐    │
                │   │  QoderSamplingProvider                             │    │
                │   │   (adapters/qoder-sampling-provider.ts)             │    │
                │   │   - resolveModel → calls Query.getModels()          │    │
                │   │   - complete → spawns single-turn query(prompt)     │    │
                │   └────────────────────────────────────────────────────┘    │
                └─────────────────────────────────────────────────────────────┘
                                          │
                                          │ reads
                                          ▼
                ┌─────────────────────────────────────────────────────────────┐
                │   Filesystem                                                 │
                │    ~/.qoder/agent/mcp.json  ← createQoderResolver           │
                │    .mcp.json (project)                                       │
                │    ~/.qoder/skills/, ~/.qoder/plugins/  (Qoder-managed)     │
                └─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
adapters/
├── entry.ts                       (unchanged — agent-agnostic)
├── pi-adapter.ts                  (existing reference)
├── pi-renderer.ts                 (existing reference)
├── pi-sampling-provider.ts        (existing reference)
├── qoder-adapter.ts               (NEW — implements AgentAPI)
├── qoder-sampling-provider.ts     (NEW — implements SamplingProvider)
└── qoder-renderer.ts              (NEW — placeholder pass-through, per D-11)

interfaces/
├── agent-api.ts                   (unchanged)
├── agent-paths.ts                 (MODIFIED — add createQoderResolver + add "qoder" to AgentId union)
└── sampling.ts                    (unchanged)

__tests__/
├── qoder-adapter.test.ts          (NEW — contract tests for AgentAPI surface)
└── qoder-adapter-integration.test.ts (NEW — initializeMcp + 10 demo MCP servers)
```

### Pattern 1: Storage-Bridging Adapter (mirrors PiAdapter)

**What:** `QoderAdapter` stores registered tools/commands/flags/handlers in private maps and forwards `exec` to `child_process`. Qoder-specific runtime API calls (`createSdkMcpServer`, `query()`) are exposed through companion methods on the adapter (e.g., `attachQuery(q: Query)`, `detachQuery()`), not through the 8 `AgentAPI` methods.

**When to use:** When the target agent has no synchronous programmatic registration API but does expose async lifecycle hooks (SessionStart, SessionEnd, etc.) and a tool/skill surface.

**Example:**
```typescript
// Source: package/dist/types/options.d.ts (verified) + CONTEXT D-09
import type { Query, SdkMcpToolDefinition } from "@qoder-ai/qoder-agent-sdk";
import type { AgentAPI, AgentContext, ToolRegistration, CommandConfig, FlagConfig, ToolInfo } from "../interfaces/agent-api.ts";

export class QoderAdapter implements AgentAPI {
  readonly tools = new Map<string, ToolRegistration>();
  readonly commands = new Map<string, CommandConfig>();
  readonly flags = new Map<string, FlagConfig & { value?: string }>();
  readonly handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();
  private queryRef: Query | undefined;

  /** Attach a live Query session so sendMessage/on events can route to it. */
  attachQuery(q: Query): void { this.queryRef = q; }
  detachQuery(): void { this.queryRef = undefined; }

  registerTool(tool: ToolRegistration): void { this.tools.set(tool.name, tool); }
  registerCommand(name: string, config: CommandConfig): void { this.commands.set(name, config); }
  registerFlag(name: string, config: FlagConfig): void {
    this.flags.set(name, { ...(config as FlagConfig & { value?: string }) });
  }
  on(event: string, handler: (...args: unknown[]) => unknown): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  /** Internal helper — call from host after session_start. */
  async fireSessionStart(runtimeCtx: AgentContext): Promise<void> {
    await this.fire("session_start", "session_start", runtimeCtx);
  }

  private async fire(event: string, ...args: unknown[]): Promise<void> {
    const set = this.handlers.get(event);
    if (!set) return;
    await Promise.all([...set].map((h) => Promise.resolve(h(...args))));
  }

  getAllTools(): ToolInfo[] { return [...this.tools.values()].map((t) => ({ name: t.name })); }
  getFlag(name: string): string | undefined { return this.flags.get(name)?.value; }

  sendMessage(message: unknown, _options?: unknown): void {
    if (this.queryRef) {
      // Push a SDKUserMessage via the query's input stream. The exact API
      // depends on Qoder SDK version; if Query exposes streamInput, call it.
      // Fallback: buffer into a local message queue (out of scope for v6).
      (this.queryRef as unknown as { streamInput?: (m: unknown) => void }).streamInput?.(message);
    }
    // No live query → no-op (matches D-09: events are simulated).
  }

  async exec(command: string, args: string[]): Promise<unknown> {
    const { spawn } = await import("node:child_process");
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      child.stdout.on("data", (b) => (stdout += b.toString()));
      child.stderr.on("data", (b) => (stderr += b.toString()));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  }
}
```

### Pattern 2: Path Resolver Factory

**What:** `createQoderResolver` returns an `AgentPathResolver` whose `globalConfigPath()` is `~/.qoder/agent/mcp.json` (respecting `MCP_AGENT_DIR` first, then `~/.qoder/agent/` as the agent-specific fallback).

**When to use:** When wiring any non-Pi agent. Mirrors `createPiResolver`.

**Example:**
```typescript
// Source: interfaces/agent-paths.ts (existing) + CONTEXT D-03, D-04
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function createQoderResolver(): AgentPathResolver {
  return {
    agentId: "qoder",
    globalConfigPath: () => {
      const override = process.env.MCP_AGENT_DIR?.trim();
      if (override) {
        if (override === "~") return homedir();
        if (override.startsWith("~/")) return resolve(homedir(), override.slice(2));
        return resolve(override);
      }
      return join(homedir(), ".qoder", "agent");
    },
    projectConfigName: () => ".mcp.json",
  };
}
```

Also extend the `AgentId` union type:
```typescript
export type AgentId = "pi" | "claude" | "cursor" | "qoder" | (string & {});
```

### Pattern 3: Sampling via Subprocess `query()`

**What:** `QoderSamplingProvider.resolveModel()` calls `query.getModels()` (control protocol) to discover available models; `complete()` spawns a fresh single-turn `query({ prompt, options: { model } })`, iterates messages until `SDKResultMessage`, and concatenates `text` content blocks.

**When to use:** When the target agent has no in-process `complete()`-style API but does expose a CLI session that can be driven programmatically.

**Example (sketch — wire to be verified in Wave 1):**
```typescript
// Source: package/dist/types/options.d.ts:145, package/dist/query/query.d.ts:47
import { query } from "@qoder-ai/qoder-agent-sdk";
import type { SamplingModel, SamplingProvider, SamplingRequest, SamplingResponse } from "../interfaces/sampling.ts";

export class QoderSamplingProvider implements SamplingProvider {
  constructor(private readonly qoderCliPath: string) {}

  async resolveModel(): Promise<SamplingModel | undefined> {
    const q = query({ prompt: "", options: { model: "default" } });
    const models = await q.getModels();
    const first = models[0];
    return first ? { provider: first.provider ?? "qoder", id: first.id, name: first.name } : undefined;
  }

  async complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse> {
    const q = query({
      prompt: request.messages.map((m) => typeof m.content === "string" ? m.content : "").join("\n"),
      options: { model: `${model.provider}/${model.id}`, maxTokens: request.maxTokens, systemPrompt: request.systemPrompt },
    });
    for await (const msg of q) {
      if (msg.type === "result" && msg.subtype === "success") {
        return { text: msg.result, model: `${model.provider}/${model.id}`, stopReason: "endTurn" };
      }
      if (msg.type === "result" && msg.subtype === "error") {
        throw new Error(msg.error ?? "Qoder sampling failed");
      }
    }
    throw new Error("Qoder sampling returned no result message");
  }
}
```

⚠️ The exact API shape of `Query.getModels()` and the `SDKResultMessage` discriminator must be verified at implementation time against the SDK's `.d.ts` files (already in `/tmp/qoder-sdk-extracted`). The above is the *shape* the planner should target, not necessarily the exact call sequence.

### Anti-Patterns to Avoid

- **Anti-pattern: Calling `pi.registerTool` from inside `QoderAdapter`.** Any reference to `@earendil-works/pi-coding-agent` inside `adapters/qoder-*.ts` violates Phase 1's isolation invariant. If you find yourself wanting to do this, re-read the `AgentAPI` interface — there's always a generic way.
- **Anti-pattern: Mutating Qoder's `commands/*.md` or `.qoder-plugin/plugin.json` from inside `registerCommand`.** Declarative files only take effect on next CLI restart. The adapter must store handlers in memory and invoke them via `sendMessage` round-trip (D-09).
- **Anti-pattern: Polling qodercli subprocess for `session_start`.** Qoder SDK provides `hooks` config at session creation. The adapter should let the host pass a `hooks: { SessionStart: [...] }` config when calling `query()` rather than polling.
- **Anti-pattern: Mocking Qoder in `qoder-adapter-integration.test.ts`.** D-10 requires real verification against the 10 demo servers. If Qoder cannot be reached in CI, the test must `it.skip` with a clear log line and the planner should add a `checkpoint:human-verify` task — not silently mock.
- **Anti-pattern: Importing `@qoder-ai/qoder-agent-sdk` from any file outside `adapters/qoder-*.ts`.** The whole point of the adapter pattern (Phase 1) is one-boundary isolation. If `init.ts` or `sampling-handler.ts` ends up importing `@qoder-ai/...`, the layer has leaked.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Driving qodercli over NDJSON | Hand-rolled `child_process.spawn` + JSON-line parser | `@qoder-ai/qoder-agent-sdk`'s `query()` | The SDK handles protocol version negotiation, control requests, `setModel`, `getModels`, `reloadPlugins`, and typed `SDKMessage` envelopes. Hand-rolling means maintaining your own discriminated-union parser. |
| MCP tool registration | Custom MCP server scaffold | `@qoder-ai/qoder-agent-sdk`'s `createSdkMcpServer({ name, tools: [tool(...)] })` | Already imports `@modelcontextprotocol/sdk` and provides a typed `tool(name, description, inputSchema, handler)` builder. |
| Path resolution | Hardcoded `path.join(homedir(), ".qoder", "agent")` inline | `AgentPathResolver` + `createQoderResolver` factory | `config.ts` already consumes `AgentPathResolver`; bypassing it re-introduces the Phase-2 anti-pattern. |
| Slash command registration in qodercli | Manual file writes to `~/.qoder/commands/*.md` | In-memory adapter map + optional companion `.qoder-plugin/` plugin scaffold for persistence | Programmatic registration is impossible mid-session; declarative files require restart. The in-memory approach satisfies `AgentAPI` synchronously; the optional plugin scaffold lets users persist their MCP slash commands. |
| UISystem `notify` | Custom terminal UI hooks | Adapter's `notify` that writes to `console.info/warn/error` with `[mcp-adapter]` prefix | qodercli captures stderr/stdout and surfaces it to the user. Custom ANSI rendering is out of scope per D-07. |

**Key insight:** Qoder's SDK is **already** the adapter boundary the rest of the project keeps clean. The `QoderAdapter` should mostly be a thin in-memory store plus a `Query` handle, *not* a complex protocol bridge. The complexity budget for Phase 6 lives in the integration test, not in the adapter itself.

## Runtime State Inventory

> This is a **greenfield** phase — no rename, refactor, or migration of existing runtime state is involved. The QoderAdapter is a new code path that co-exists with the Pi adapter. There is no runtime state to migrate.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | none — Phase 6 adds new code, does not move data | none |
| Live service config | none — Pi adapter and Qoder adapter are independent code paths | none |
| OS-registered state | none — no `qoder` integration registers itself with the OS at install time | none |
| Secrets/env vars | none — `@qoder-ai/qoder-agent-sdk` reads `QODER_PERSONAL_ACCESS_TOKEN` (or reuses local `qodercli login`) via `auth.d.ts`; the mcp-adapter does not need to mint or rotate these. The existing `MCP_AGENT_DIR` and `PI_CODING_AGENT_DIR` env vars are unaffected. | none — but document that `MCP_AGENT_DIR` is now read by both `createPiResolver` and `createQoderResolver` |
| Build artifacts | none — no compiled binaries; the new `.ts` files are picked up by tsx + tsc | none |

**Nothing found in category:** Verified by inspection of `package.json` `files` list — no `.qoder-plugin/` directory will be shipped unless the planner decides to add an optional companion plugin scaffold (out of scope for ADAPTER-01–03).

## Common Pitfalls

### Pitfall 1: Adapter pretends to provide what Qoder cannot deliver at runtime

**What goes wrong:** Developer writes `QoderAdapter.registerCommand` that synchronously writes to `~/.qoder/commands/mcp.md` and expects the next `qodercli` restart to pick it up. Test passes in isolation, but the `mcp-adapter-test` E2E fails because the test runs in the same process as `qodercli` and the command never becomes available.

**Why it happens:** Misreading Qoder's *declarative* plugin system as a *programmatic* registration API.

**How to avoid:** Per D-08 + D-09, the adapter stores commands in memory and (optionally) emits a *companion* `.qoder-plugin/plugin.json` + `commands/*.md` scaffold for users who want the command visible in the Qoder IDE palette. Programmatic, in-process command registration is the storage pattern, not the file-write pattern.

**Warning signs:** Integration test that calls `registerCommand("mcp", …)` and then tries to invoke `/mcp` via `query({ prompt: "/mcp" })` — this will never work in the same session.

### Pitfall 2: Path resolver hardcodes `~/.qoder` instead of using `MCP_AGENT_DIR`

**What goes wrong:** Developer writes `globalConfigPath: () => join(homedir(), ".qoder", "agent", "mcp.json")` and forgets that `MCP_AGENT_DIR` should override (D-03). Test that sets `MCP_AGENT_DIR=/tmp/qoder-test` then loads config picks up the Pi default instead.

**Why it happens:** Forgetting that the env var is the *primary* source of truth, not the agent-specific default.

**How to avoid:** Mirror the exact precedence from `agent-dir.ts` lines 7-18: `MCP_AGENT_DIR` first, then the agent-specific default. Write a test that sets `MCP_AGENT_DIR=/tmp/alt` and asserts `globalConfigPath()` returns `/tmp/alt`.

**Warning signs:** Running the integration test on a developer machine that already has `~/.pi/agent/mcp.json` populated — config leaks from Pi default.

### Pitfall 3: `QoderSamplingProvider.complete` spawns a real `query()` session during unit tests

**What goes wrong:** The contract test for `QoderSamplingProvider` calls `.complete()` and hangs forever waiting for a real qodercli subprocess response. CI times out.

**Why it happens:** The provider's `complete` is implemented as a real `query({ prompt })` call, not a fake.

**How to avoid:** Inject the `Query` factory as a constructor dependency (e.g., `constructor(private readonly queryFactory: typeof import("@qoder-ai/qoder-agent-sdk").query = query)`). The unit test passes a mock factory; the integration test passes the real factory.

**Warning signs:** `__tests__/qoder-adapter-integration.test.ts` finishes but `__tests__/qoder-adapter.test.ts` hangs at the sampling provider assertion.

### Pitfall 4: `on('session_start')` never fires because the host doesn't call `fireSessionStart`

**What goes wrong:** Per D-09 the adapter simulates `on` events. But the integration test calls `createMcpAdapter(qoderAdapter, ctx, config, cache)` and never triggers `qoderAdapter.fireSessionStart(ctx)`, so `initializeMcp` never runs and the test reports "0 servers connected".

**Why it happens:** The simulation contract isn't spelled out anywhere — the adapter fires events but only when something tells it to.

**How to avoid:** Document the simulation API in the `QoderAdapter` JSDoc: `fireSessionStart(ctx)`, `fireSessionShutdown()`, `fireToolRegistered(name)` — all public methods the host can call. The integration test calls `qoderAdapter.fireSessionStart(ctx)` before awaiting `state`.

**Warning signs:** `initializeMcp` mock in test verifies it was called, but the count is 0.

### Pitfall 5: `@qoder-ai/qoder-agent-sdk`'s postinstall fails in CI

**What goes wrong:** The package's `scripts/postinstall.cjs` tries to download `qodercli` from `https://download.qoder.com/qodercli/releases`. In an air-gapped CI runner or behind a corporate proxy, `npm install` errors out.

**Why it happens:** The SDK auto-fetches the CLI binary.

**How to avoid:** Document `QODER_SKIP_DOWNLOAD=1` in the README + CONTRIBUTING. Set the env var in `.github/workflows/*.yml` (if applicable). On developer machines that already have `qodercli` on PATH (verified), the postinstall is a redundant download.

**Warning signs:** CI log shows `Error: getaddrinfo ENOTFOUND download.qoder.com`.

### Pitfall 6: SUS-flagged package slips past review

**What goes wrong:** `@qoder-ai/qoder-agent-sdk` is only 5 days old with 693 weekly downloads and no npm-repo link. A teammate adds it without flagging, and six months later a typo-squat (`@qoder-ai/qoder-sdk`) appears that mimics the real package.

**Why it happens:** Velocity pressure; SUS verdict not surfaced.

**How to avoid:** Planner inserts `checkpoint:human-verify` task *before* the `npm install` task. README "Installation" section cites the exact registry URL. Pin the version (`1.0.3`) — do not use `latest`.

**Warning signs:** `package.json` shows `@qoder-ai/qoder-agent-sdk: latest` instead of a pinned version.

## Code Examples

Verified patterns from official sources:

### Example 1: Qoder SDK `tool()` definition
```typescript
// Source: package/dist/mcp/sdk-mcp-server.d.ts (verified)
import { tool, createSdkMcpServer } from "@qoder-ai/qoder-agent-sdk";
import { z } from "zod/v4";

const greet = tool("greet", "Say hello", { name: z.string() }, async (args) => ({
  content: [{ type: "text" as const, text: `Hello, ${args.name}!` }],
}));

const server = createSdkMcpServer({ name: "mcp-adapter-tools", tools: [greet] });
```

### Example 2: `query()` session with attached MCP server
```typescript
// Source: package/dist/query/query.d.ts:47 (verified)
import { query } from "@qoder-ai/qoder-agent-sdk";

const q = query({
  prompt: "List the connected MCP tools",
  options: {
    mcpServers: { "mcp-adapter-tools": server },
    allowedTools: ["mcp__mcp-adapter-tools__greet"],
  },
});
for await (const msg of q) {
  // msg.type ∈ "system" | "assistant" | "user" | "result" | ...
}
```

### Example 3: Hook configuration for session lifecycle
```typescript
// Source: docs.qoder.com/en/cli/sdk/hooks (verified via WebSearch summary)
options: {
  hooks: {
    SessionStart: [{ hooks: [async (input, toolUseId, signal) => {
      // input.hook_event_name === "SessionStart"
      // input.session_id, input.cwd present
      return { continue: true, hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "..." } };
    }] }],
  },
}
```

### Example 4: Loading the universal entry point with a Qoder adapter
```typescript
// Source: adapters/entry.ts (existing — agent-agnostic)
import { createMcpAdapter } from "./adapters/entry.ts";
import { QoderAdapter, adaptQoderContext } from "./adapters/qoder-adapter.ts";
import { createQoderResolver } from "./interfaces/agent-paths.ts";

const agentapi = new QoderAdapter(/* qoderRef? */ undefined);
const ctx = adaptQoderContext({ cwd: process.cwd(), hasUI: false });
const resolver = createQoderResolver();

createMcpAdapter(agentapi, ctx, loadMcpConfig(resolver.globalConfigPath()), loadMetadataCache());

// After session_start fires, register MCP tools and let the host open a query():
//   qoderAdapter.fireSessionStart(ctx);
//   const server = createSdkMcpServer({ name: "mcp-tools", tools: toolsFromMap(qoderAdapter.tools) });
//   const q = query({ prompt, options: { mcpServers: { "mcp-tools": server } } });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pi-specific `index.ts` only entry point | Universal `createMcpAdapter(AgentAPI, …)` + per-agent adapter files | Phase 5 (2026-06-16) | New agents require only one new file under `adapters/` |
| Hardcoded `~/.pi/agent/mcp.json` | `AgentPathResolver` + per-agent factory | Phase 2 (2026-06-13) | Path config is now a value, not a constant |
| Pi `complete()` import inside `sampling-handler.ts` | `SamplingProvider` injection + per-agent provider | Phase 5 (2026-06-16) | Sampling boundary is isolated to `adapters/*-sampling-provider.ts` |
| Hand-rolled CLI subprocess | `@qoder-ai/qoder-agent-sdk` programmatic API | Phase 6 (2026-06-16) | Qoder runtime access is type-safe and protocol-versioned |
| `~/.qoder/commands/*.md` only (declarative) | Adapter in-memory map + optional companion `.qoder-plugin/` scaffold | Phase 6 (2026-06-16) | Same-session registration becomes possible |

**Deprecated/outdated:**
- Hand-rolled `child_process.spawn("qodercli", …)` + NDJSON parsing → replaced by `@qoder-ai/qoder-agent-sdk.query()`.
- File-based `.qoder-plugin/plugin.json` writes from inside a running `qodercli` session → not supported; the in-memory adapter map replaces this for runtime use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@qoder-ai/qoder-agent-sdk@1.0.3` is the right SDK to depend on; no later/final API has shipped yet. | Standard Stack | If Qoder ships a 1.1.x with breaking type changes before Phase 6 lands, the adapter needs a patch. Pin `^1.0.3` and monitor. |
| A2 | `qodercli` binary path is discoverable via `command -v qodercli` on the developer machine and via `QODER_SKIP_DOWNLOAD` skip in CI. | Common Pitfalls §5 | If Qoder changes the env var name, the README/CI guidance needs updating. |
| A3 | Qoder's `query()` `SDKResultMessage.subtype === "success"` carries the final text. | Pattern 3 (sketch) | If the discriminator name differs in 1.0.3, the sampling provider returns empty text. Verify against `package/dist/types/messages.d.ts` at implementation time. |
| A4 | The 10 demo MCP servers defined in `.mcp.json` are runnable via `npx tsx tests/demo-servers/.../server.ts` and do not require any Qoder-specific bootstrap. | Validation Architecture | If a demo server expects a Qoder-only env var, the integration test setup needs a `process.env.X = "..."` injection. |
| A5 | `MCP_AGENT_DIR` env var precedence (set in `agent-dir.ts:7-18` for Pi) should be mirrored 1:1 in `createQoderResolver`. | Pattern 2 | D-03 says `MCP_AGENT_DIR` "can override" — implementation may choose a different precedence. Confirm at plan-checker time. |
| A6 | `qodercli` already auto-loads `.mcp.json` from cwd by default (verified by the existence of `.mcp.json` at project root). This means the **adapter** is the bridge that makes `createMcpAdapter`'s registrations visible to a Qoder session — the Qoder SDK's `createSdkMcpServer` is the channel. | Architecture Patterns Pattern 1 | If Qoder only supports stdio MCP servers (not in-process `createSdkMcpServer`), the integration test path needs to switch to spawning `node ./bin/cli.js` as a stdio MCP server instead of using the SDK. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. *(Not empty; see A1–A6.)*

## Open Questions

1. **Does `@qoder-ai/qoder-agent-sdk@1.0.3` expose a `Query.setModel(model)` and `Query.getModels()` method on the returned `Query` handle, or are models only configurable at session start?**
   - What we know: `Options.model` exists in `types/options.d.ts:145`. The `Query` type re-exports `setModel` and `getModels` (verified via grep on `types/options.d.ts:247` and `:279`). The exact async-vs-sync behavior at runtime is unknown.
   - What's unclear: Whether `setModel` works mid-session or only on the first call.
   - Recommendation: Phase 6 Wave 1 includes a tiny smoke script (`scripts/qoder-smoke.ts`) that calls `setModel("performance")` then `getModels()` and logs the result. The output drives whether `QoderSamplingProvider.resolveModel` calls `getModels()` once or per `complete()`.

2. **How does the integration test inject a live `Query` handle into the adapter without actually awaiting a model response for every assertion?**
   - What we know: `QoderAdapter.attachQuery(q)` is the proposed injection point (Pattern 1). For tests, a fake `Query` (e.g., a `vi.fn()` async iterable) can be passed.
   - What's unclear: Whether `createMcpAdapter` should accept a `Query` injection in its signature, or whether the host must wire `attachQuery` separately *after* `createMcpAdapter` returns.
   - Recommendation: Keep the wiring separate — `createMcpAdapter` is generic and knows nothing about Qoder. The integration test does:
     ```typescript
     createMcpAdapter(adapter, ctx, config, cache);
     const fakeQuery = makeFakeQuery();
     adapter.attachQuery(fakeQuery);
     await adapter.fireSessionStart(ctx);
     ```

3. **Does `qodercli` need to be reachable for `__tests__/qoder-adapter.test.ts` (contract test) to pass?**
   - What we know: The contract test mocks the AgentAPI surface — no real `qodercli` needed for those assertions.
   - What's unclear: Whether `QoderSamplingProvider` constructor eagerly validates `qodercli` availability (the SDK's `postinstall` makes this assumption).
   - Recommendation: `QoderSamplingProvider` constructor takes a `queryFn: typeof query` parameter with `query` as default; contract test passes a `vi.fn()` mock; integration test uses real `query`. This is the same pattern as `PiSamplingProvider`'s `modelRegistry` injection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node` | tsx, vitest, qodercli subprocess | ✓ (assumed — not probed but tsc + vitest worked in Phase 5) | — | — |
| `qodercli` | QoderAdapter integration test (real `query()`) | ✓ | 1.0.19 | `--skip-integration` flag (set by planner if unavailable) |
| `tsx` | 10 demo MCP servers (`npx tsx tests/demo-servers/.../server.ts`) | ✓ (Phase 5 left 475 tests passing) | — | — |
| `vitest` | Contract + integration tests | ✓ (Phase 5) | `^3.0.0` | — |
| `@qoder-ai/qoder-agent-sdk` | QoderAdapter runtime | ✗ (not installed) | n/a | Skip Phase 6 entirely — but D-01 requires real Qoder API |
| `MCP_AGENT_DIR` env var | Path resolution | optional (defaults work) | — | falls back to `~/.qoder/agent/` |

**Missing dependencies with no fallback:**
- `@qoder-ai/qoder-agent-sdk` — without it, `QoderAdapter.attachQuery` has nothing to attach. The SUS-flagged install is unavoidable; the `checkpoint:human-verify` task is the mitigation.

**Missing dependencies with fallback:**
- A live `qodercli` in CI: integration test falls back to a mock `Query` and asserts only that `createMcpAdapter` calls `registerTool`/`registerCommand`/etc. on the adapter. The "real 10 servers" E2E is gated behind `process.env.QODER_INTEGRATION === "1"`.

## Validation Architecture

> `workflow.nyquist_validation` is absent in `.planning/config.json`; default = enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `^3.0.0` |
| Config file | `vitest.config.ts` (existing — covers `__tests__/**/*.test.ts`) |
| Quick run command | `npx vitest run __tests__/qoder-adapter.test.ts` |
| Full suite command | `npx vitest run` (matches Phase 5: 475 passing baseline) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADAPTER-01 | `QoderAdapter implements AgentAPI` — 8 methods register + dispatch correctly | unit | `npx vitest run __tests__/qoder-adapter.test.ts` | ❌ Wave 0 |
| ADAPTER-02 | `createQoderResolver` returns correct paths under `MCP_AGENT_DIR` override + default | unit | `npx vitest run __tests__/qoder-adapter.test.ts` (resolver block) | ❌ Wave 0 |
| ADAPTER-03 | `initializeMcp(qoderAdapter, ctx)` connects all 10 demo MCP servers | integration | `npx vitest run __tests__/qoder-adapter-integration.test.ts` | ❌ Wave 0 |
| D-02 (full parity) | All 8 `AgentAPI` methods callable on `QoderAdapter` | unit | `npx vitest run __tests__/qoder-adapter.test.ts` (full-surface block) | ❌ Wave 0 |
| D-05 (sampling) | `QoderSamplingProvider.resolveModel/complete` returns correct shape | unit | `npx vitest run __tests__/qoder-sampling-provider.test.ts` | ❌ Wave 0 |
| D-07 (UI minimal) | `QoderAdapter.ui` exposes only `notify` | unit | inline assertion in `qoder-adapter.test.ts` | ❌ Wave 0 |
| D-10 (full-flow) | `mcp-adapter-test` plan passes Section 4 + 5 + 6 against Qoder | integration | `npx tsx skills/mcp-adapter-test` (after Phase 6 lands) | exists in `skills/` |

### Sampling Rate
- **Per task commit:** `npx vitest run __tests__/qoder-adapter.test.ts __tests__/qoder-sampling-provider.test.ts`
- **Per wave merge:** `npx vitest run` (full suite — matches Phase 5 baseline)
- **Phase gate:** Full suite green + `mcp-adapter-test` Section 4 (44/44) + Section 6 (25/25) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `__tests__/qoder-adapter.test.ts` — contract test for the 8 `AgentAPI` methods + `createQoderResolver`
- [ ] `__tests__/qoder-adapter-integration.test.ts` — runs `initializeMcp` against the 10 demo servers with a mock `Query`
- [ ] `__tests__/qoder-sampling-provider.test.ts` — `resolveModel` + `complete` with a mock `query()` factory
- [ ] `adapters/qoder-adapter.ts` — AgentAPI impl
- [ ] `adapters/qoder-sampling-provider.ts` — SamplingProvider impl
- [ ] `adapters/qoder-renderer.ts` — placeholder pass-through (D-11)
- [ ] `interfaces/agent-paths.ts` — add `createQoderResolver` + extend `AgentId` union
- [ ] `scripts/qoder-smoke.ts` — `setModel` / `getModels` smoke check (resolves Open Question #1)
- [ ] `package.json` — add `@qoder-ai/qoder-agent-sdk` to `dependencies` (gated by `checkpoint:human-verify`)

## Security Domain

> `security_enforcement` is absent in `.planning/config.json`; default = enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (Qoder SDK auth: `accessToken` / `qodercliAuth` / `jobToken`) | Use the SDK's documented auth helpers (`accessTokenFromEnv()`, `qodercliAuth()`); never inline tokens. The `QoderAdapter` must not log or persist auth tokens. |
| V3 Session Management | yes (`Query` handle lifecycle) | The host must `await q.close()` / call `q.interrupt()` on `session_shutdown` to avoid orphan subprocesses. |
| V4 Access Control | yes (path resolution under `MCP_AGENT_DIR`) | Validate that `MCP_AGENT_DIR` does not resolve outside an expected directory tree (mirror any future validation in `agent-dir.ts`). |
| V5 Input Validation | yes (`tool` arguments from Qoder session → MCP servers) | Reuse existing `zod`/`typebox` validation in `direct-tools.ts` and `proxy-modes.ts`. |
| V6 Cryptography | no (no new crypto introduced by Phase 6) | n/a |
| V7 Error Handling | yes | Map `QoderCliProcessError` to MCP `INTERNAL_ERROR` results instead of leaking subprocess stack traces to the user. |
| V9 Logging | yes | Adapter-side `console.*` calls in `notify`/`exec` must not log secrets; redact `MCP_AGENT_DIR` paths from error messages if they contain user PII. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `@qoder-ai/qoder-agent-sdk` postinstall downloads binary from a hard-coded URL | Tampering / Spoofing | Pin the SHA256 via `npm install --integrity`; set `QODER_SKIP_DOWNLOAD=1` in CI; verify checksum on download (the postinstall already does this unless `QODER_SKIP_CHECKSUM=1`). |
| SUS-flagged dependency could be typo-squatted in future | Spoofing | Pin exact version; document the registry URL in the PR description; require human review before any version bump. |
| `exec(command, args)` from `QoderAdapter` could be invoked by a malicious MCP tool result | Elevation of Privilege | **Acceptance criterion**: `exec` must be called *only* from within the host's trusted code path (e.g. `auth-flow.ts`), not from MCP tool results. Document this in `QoderAdapter.exec` JSDoc. |
| `sendMessage` in the adapter buffers if no `Query` is attached | Information Disclosure | The buffer must not persist across sessions — `detachQuery()` should clear it. |
| `globalConfigPath()` reads `MCP_AGENT_DIR` env var unvalidated | Tampering | Mirror `agent-dir.ts:7-18` exactly (no validation today, but do not introduce a path-traversal vector by `resolve()`-ing arbitrary user input without checks). |

## Sources

### Primary (HIGH confidence)
- `npm view @qoder-ai/qoder-agent-sdk` — package metadata, version 1.0.3, dependencies, postinstall script.
- `/tmp/qoder-sdk-extracted/package/dist/index.d.ts` — public exports (verified by reading).
- `/tmp/qoder-sdk-extracted/package/dist/types/options.d.ts` — `Options`, `Query`, `mcpServers`, `setModel`, `getModels` (verified by reading).
- `/tmp/qoder-sdk-extracted/package/dist/mcp/sdk-mcp-server.d.ts` — `tool()` and `createSdkMcpServer()` (verified by reading).
- `/tmp/qoder-sdk-extracted/package/dist/query/query.d.ts` — `query()` signature (verified by reading).
- `/tmp/qoder-sdk-extracted/package/dist/types/hooks.d.ts` — hook event names (`SessionStart`, `SessionEnd`) (verified by listing).
- `adapters/pi-adapter.ts`, `adapters/entry.ts`, `interfaces/agent-api.ts`, `interfaces/agent-paths.ts`, `agent-dir.ts`, `__tests__/pi-adapter.test.ts`, `__tests__/adapter-contract.test.ts`, `__tests__/entry.test.ts` — direct code reading for patterns.
- `qodercli --version` → `1.0.19`, `qodercli --help` output (verified on host machine).

### Secondary (MEDIUM confidence)
- [docs.qoder.com/en/cli/sdk/plugins](https://docs.qoder.com) — plugin manifest layout, `.qoder-plugin/plugin.json`, `commands/*.md` (verified via WebSearch summary; direct fetch blocked by 403).
- [docs.qoder.com/en/cli/sdk/hooks](https://docs.qoder.com) — `SessionStart`, `SessionEnd`, `PreToolUse` hook events (verified via WebSearch summary).
- [docs.qoder.com/en/cli/sdk/tools](https://docs.qoder.com) — `tool()`, `createSdkMcpServer()`, MCP tool naming (verified via WebSearch summary).
- [docs.qoder.com/en/cli/sdk/references](https://docs.qoder.com) — `SdkPluginConfig`, `hooks` configuration surface (verified via WebSearch summary).
- `docs/architecture-comparison.md` (project) — existing sketch of `QoderAdapter` and `createQoderResolver` (read directly; lines 199–291).
- `skills/mcp-adapter-test/SKILL.md` — verification plan reference (read directly).
- `.mcp.json` (project root) — 10 demo server list (read directly).

### Tertiary (LOW confidence)
- [docs.qoder.dev](https://docs.qoder.dev) — referenced in `skills/README.md` line 31; **not directly accessible** (404/EOF errors during WebFetch). Treat any docs.qoder.dev-specific claims as `[ASSUMED]`. Only docs.qoder.com content is treated as authoritative.
- Training-data knowledge of Qoder CLI's runtime surface — used only to corroborate SDK reads; not the primary source.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `@qoder-ai/qoder-agent-sdk` is verified via npm + tarball, but only 5 days old; future minor versions may shift types.
- Architecture: HIGH for the adapter-pattern invariants (Phase 1–5 established). MEDIUM for the Qoder-specific mapping (SDK has been read but not yet exercised at runtime).
- Pitfalls: HIGH — derived from direct comparison between Pi's `ExtensionAPI` and Qoder's SDK surface.
- Path resolution: HIGH — mirrors existing `agent-dir.ts` exactly.
- Sampling: LOW — the exact `Query.setModel` / `Query.getModels` / `SDKResultMessage.subtype` behavior must be smoke-tested before the sampling provider is committed (Open Question #1).

**Research date:** 2026-06-16
**Valid until:** 2026-07-01 (Qoder SDK may release a 1.1.x within 2 weeks; re-verify `package/dist/types/*.d.ts` if re-running)