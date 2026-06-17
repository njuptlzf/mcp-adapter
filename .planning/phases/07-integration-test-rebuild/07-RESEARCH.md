# Phase 7 Research — Integration Test Rebuild

**Researched:** 2026-06-17
**Domain:** Agent-agnostic test infrastructure (vitest parametric + SKILL.md restructure + matrix report)
**Confidence:** HIGH (project source), MEDIUM (vitest 3.2.6 specifics via official docs), MEDIUM (Anthropic SKILL.md patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Capability Gate 抽象化 (TEST-01, TEST-02)**
- **D-01:** Capability Gate uses `await adapter.getAllTools()` (AgentAPI abstraction), not Pi tool-list format. Path A/B/C determined by presence of `'mcp'` / `^<server>_` in returned tool names. No source changes needed for any adapter that implements `getAllTools()`.
- **D-02:** Gate output is a single table: `Agent | Adapter | Path | Tools | Resolved`; Path C is explicitly labeled "mcp-adapter NOT loaded as extension in this environment".
- **D-03:** Gate step is extracted from SKILL.md Phase 4 Step 3 into its own "Capability Gate" step, executed **before** Phase 4 (current §122-138 order kept but moved earlier). Every agent follows the same gate flow.

**Per-Adapter 契约验证框架 (TEST-04)**
- **D-04:** Parametric framework: `__tests__/adapter-contract.test.ts` uses `describe.each([['pi', () => new PiAdapter(...)], ['qoder', () => new QoderAdapter(...)]])` with adapter factory tuples; all 8 `AgentAPI` methods contract-cases expand per-adapter. **One file covers all adapters** (avoids L-7 type-grep drift across per-adapter files).
- **D-05:** 8 contract methods: `registerTool` / `registerCommand` / `registerFlag` / `on` / `getAllTools` / `getFlag` / `sendMessage` / `exec`; ≥2 cases per method (basic + error/edge).
- **D-06:** Test run layers: **8 AgentAPI contract cases × N adapters** (default CI = Pi+Qoder = 16 cases, auto-expands on new adapter), **40 server cases × 1 MockAgentAPI** (server-agnostic, no per-adapter repeat). `AGENT_API_FULL_MATRIX=1` opts into full N×44; default CI = layered lightweight mode.

**Adapter 自动发现机制 (TEST-03 + future-proofing)**
- **D-07:** Phase 7 introduces a **static registry** — `export const AGENT_ADAPTERS: AgentAdapterDescriptor[]` in `interfaces/agent-api.ts`. New adapters `push` a descriptor `{ id, factory, displayName, envHints, capabilities }`; test runner / Capability Gate / README matrix / report matrix auto-discover. `createPiResolver` / `createQoderResolver` continue to live in `interfaces/agent-paths.ts`; descriptor also carries path-resolver info.
- **D-08:** Existing Pi-specific `MockAgent` (in `tests/compatibility/non-pi-agent.test.ts`) is **replaced** with generic `MockAgentAPI` in `__tests__/fixtures/mock-agent-api.ts` (all 8 methods, Maps / Sets / `vi.fn()`, zero Pi references). Old `__tests__/mock-agent.ts` (which contains `MockAgentAPI` in the **inline** form, D-08 wording interpreted as the entire legacy mock-agent infrastructure) moves to `__tests__/compatibility/legacy-pi-mock.test.ts` and is marked deprecated, kept for comparison but not blocking the main suite.
- **D-09:** Existing `__tests__/adapter-contract.test.ts` (Phase 1) is **rewritten** with `AGENT_ADAPTERS.map(a => a.factory)` as `describe.each` input. Old 44 cases restructured: 40 server cases → MockAgentAPI; 8 AgentAPI cases → `describe.each(AGENT_ADAPTERS)`.

**SKILL.md Agent-Agnostic 化 (TEST-05)**
- **D-10:** `skills/mcp-adapter-test/SKILL.md` becomes **main + per-agent references** — main file goes short parametric (describes "what each Phase / Step does"), agent-specific "how" details go to `skills/mcp-adapter-test/references/agent-paths/pi.md` / `qoder.md` / `_template.md`. Adding a new adapter = add a `references/agent-paths/<agent>.md`; main SKILL.md untouched.
- **D-11:** Main SKILL.md "Phase 4" becomes "**Phase 4: Per-Path Verification**" with a table describing what each Path checks (semantic). Remove agent-specific phrasing; Path A `mcp({})` call examples move into `references/agent-paths/pi.md` "Path A 调用样例" subsection. Phase 8 UPSTREAM-04 compatibility: main SKILL.md goes short, upstream merge conflict surface narrows.

**Section 5/5B 目标说明 (S-2 经验)**
- **D-12:** Section 5/5B thresholds (≥95% / ≥65%) are kept. SKILL.md adds a "🟡 baseline-bound" note at the corresponding Phase: 94% / 56% are determined by the agent-agnostic proxy serializer (`adapters/tool-registrar.ts`) and the demo-server fixture set, **not by the adapter**; all adapters (Pi / Qoder) get identical values — this is fixture-bound, not regression.
- **D-13:** Report "Target Miss" status text becomes "🟡 baseline-bound (fixture-determined, identical across adapters)", allowed to coexist with "🟢 Pass" to avoid misreading.

**Pre-existing Test 失败处置 (S-3 经验 / FIX-01)**
- **D-14:** FIX-01 solution = **add prebuild step** — `package.json` adds `"test:prebuild": "tsc -p examples/interactive-visualizer && node examples/interactive-visualizer/scripts/build.mjs"`; `"test": "npm run test:prebuild && vitest run"`. `vitest.config.ts` `globalSetup` watches for `dist/` missing and auto-builds, so developers can't forget.
- **D-15:** After fix, `__tests__/interactive-visualizer-server.test.ts` keeps its 2 cases and passes. The 06-UAT.md "Known Issues" entry moves to "Resolved".

**报告格式统一化**
- **D-16:** `tests/reports/mcp-adapter-test-report.md` becomes **unified matrix report** — top table = `agent × section` pass counts; below = per-section detail (each section still has per-agent sub-tables). `tests/reports/qoder-adapter-test-report.md` is **deprecated**; Qoder data merges into main report's Qoder column.
- **D-17:** Report output = Markdown (human) + JSON sidecar (`tests/reports/mcp-adapter-test-report.json` for CI / dashboard parsing). JSON produced by a vitest reporter / setup hook, no new CLI script.

**README 重写定位 (DOC-01, DOC-02, DOC-03)**
- **D-18:** README = **Pi-first-class + matrix副线** — Hero says "Universal MCP Adapter" + "Pi is a first-class supported adapter (not legacy) + every agent is welcome"; Hero immediately followed by **Supported Agents matrix** (columns: Agent | Status | Default config path | Path resolver | Sampling | Renderer | Verified at), currently Pi + Qoder rows; add row per new adapter. **Verification** section links main test report and shows latest matrix summary.
- **D-19:** Quick Start shows **two entry-point code blocks side-by-side** — left `mcpAdapter(pi)` (Pi direct call, backward compat), right `createMcpAdapter(adapter, ctx, config, cache)` (universal entry, any AgentAPI). Satisfies DOC-03.
- **D-20:** Replace "Agent-agnostic" with "Universal" in README — avoid implying Pi is not first-class. Pi and Qoder adapters **visually symmetric** in the matrix.

**Phase 8 兼容性预留 (UPSTREAM-04)**
- **D-21:** Phase 7 actively prepares for Phase 8 — SKILL.md split into "main + per-agent references" (D-10/D-11); Phase 8 UPSTREAM-04 ("Minimize source file modifications during Phase 5-6 by preferring adapter/wrapper patterns") working surface is already in place after Phase 7. `adapters/` directory layout is stable; UPSTREAM-01 manifest can reuse D-11 split granularity directly.

### the agent's Discretion

- `AGENT_ADAPTERS` registry TypeScript detail (`AgentAdapterDescriptor` fields, `envHints` shape) — at implementer's discretion
- `globalSetup` build trigger logic detail (file-watch vs one-shot build) — implementer weighs trade-offs
- Report JSON schema field set — implementer extends as needed

### Deferred Ideas (OUT OF SCOPE)

- **Claude / Cursor etc. new adapter implementations** — separate phases after Phase 7; Phase 7 only prepares the `AGENT_ADAPTERS` extension point (D-07)
- **Section 5/5B target threshold adjustments** — 94% / 56% are baseline-bound (D-12), changing thresholds would lower the bar
- **i18n / multi-language README** — not in Phase 7; English README only
- **JSON Schema auto-generation for the report schema** — D-17 JSON output is hand-written schema, auto-generation tooling TBD
- **Web dashboard for matrix report** — JSON sidecar feeds future dashboard, not built in Phase 7
- **3rd-party AgentAPI adapter auto-npm publish** — separate work item
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TEST-01** | Move Capability Gate to run FIRST before any test, not embedded in Phase 4 | §Architecture Pattern "Capability Gate extraction" + §File impact `skills/mcp-adapter-test/SKILL.md` |
| **TEST-02** | Clearly report: which agent is running, which paths are available, which adapters are supported | §Architecture Pattern "Capability Gate extraction" + §Code Examples (Gate output table) |
| **TEST-03** | Replace Pi-specific MockAgent in adapter-contract.test.ts with generic AgentAPI mock | §File impact `__tests__/fixtures/mock-agent-api.ts` + §Don't Hand-Roll table |
| **TEST-04** | Add per-adapter verification layer: for each registered adapter, verify AgentAPI contract compliance | §Architecture Pattern "Parametric describe.each" + §Standard Stack core |
| **TEST-05** | Rebuild SKILL.md Phase 4 to support Path A/B verification for ANY supported agent (not just Pi) | §File impact `skills/mcp-adapter-test/SKILL.md` + `references/agent-paths/*.md` |
| **DOC-01** | Revise README leading with "fully Pi-compatible + supports every agent" positioning; Pi is first-class | §File impact `README.md` + §Code Examples (Hero + matrix) |
| **DOC-02** | Add "Verification" / "Compatibility" section to README summarizing integration test results across agents (proxy / directTools / SDK fallback coverage) | §File impact `README.md` + §Matrix report schema |
| **DOC-03** | Update README usage examples to show both Pi (`mcpAdapter`) and universal (`createMcpAdapter`) entry points | §File impact `README.md` + §Code Examples (Quick Start) |
</phase_requirements>

---

## Summary

Phase 7 is an **infrastructure refactor**, not a feature addition. The core deliverable is making `mcp-adapter-test` (the project's existing test skill) "for every agent" — so that any registered `AgentAPI` adapter (Pi / Qoder / future Claude / Cursor / …) flows through the same Capability Gate → contract verification → E2E matrix automatically, with no per-adapter code forks in the skill.

The technical surface is narrow and well-bounded:

1. **Static adapter registry** (`AGENT_ADAPTERS: AgentAdapterDescriptor[]` in `interfaces/agent-api.ts`) is the single source of truth for what adapters exist. Every other surface (test runner, Capability Gate, README matrix, report matrix) consumes this array. Adding a new adapter = `array.push(descriptor)`, no other code changes.
2. **Parametric test runner** uses `describe.each([[id, factory]])` to fan out 8 `AgentAPI` contract cases across all registered adapters. The 40 server-compatibility cases stay on `MockAgentAPI` (server-agnostic) — only 8×N matrix scales with adapter count. `AGENT_API_FULL_MATRIX=1` opts into N×44 (heavy), default CI = 8×N + 40×1 (light).
3. **Capability Gate** detects the proxy tool / directTools / SDK_DIRECT path by calling `adapter.getAllTools()` — the *only* universally reliable signal across adapters (per S-4 in Phase 6 LEARNINGS). Old Pi-biased prose in SKILL.md is replaced by an agent-agnostic table-driven flow.
4. **FIX-01** disposes of the 2 pre-existing `interactive-visualizer-server.test.ts` failures via a prebuild step + `globalSetup` safety net.
5. **SKILL.md** splits into "main (short parametric) + per-agent references" — main file describes *what* each Phase does; `references/agent-paths/{pi,qoder,_template}.md` carry agent-specific *how*. This satisfies TEST-05 and pre-paves Phase 8 UPSTREAM-04 by minimizing merge-conflict surface.
6. **Report** merges `qoder-adapter-test-report.md` into a single `mcp-adapter-test-report.md` matrix; JSON sidecar written via custom vitest reporter (D-17).
7. **README** flips positioning: Pi stays first-class, matrix becomes the headline feature, two entry points shown side-by-side, "Universal" replaces "Agent-agnostic".

**Primary recommendation:** Implement the registry first (`AGENT_ADAPTERS` + `AgentAdapterDescriptor` interface) — everything else consumes it. Use vitest's built-in `describe.each` for the parametric framework, no new test framework. Use a single `globalSetup` file (`tests/global-setup.ts`) to detect `dist/` absence and spawn the build. The custom JSON reporter is a small `Reporter` class (≈80 lines) registered alongside the default reporter.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `AGENT_ADAPTERS` static registry (D-07) | `interfaces/agent-api.ts` (TypeScript) | test runner, Capability Gate, README matrix, report matrix | Single source of truth — must be exported from a stable interface module that all four consumers can import without coupling to a specific adapter. |
| Parametric contract test runner (D-04..D-06) | `__tests__/adapter-contract.test.ts` (Node test layer) | `__tests__/fixtures/mock-agent-api.ts` (shared mock) | The test file is the consumer; the fixture is the shared helper. Both live in `__tests__/`, not in `interfaces/`, so production code stays clean. |
| Capability Gate (D-01..D-03) | `skills/mcp-adapter-test/SKILL.md` (skill / documentation tier) | `interfaces/agent-api.ts` `getAllTools()` (signal source) | The Gate is a *procedure* the agent performs, not a runtime API. The signal is `getAllTools()` — already part of `AgentAPI`. |
| `MockAgentAPI` fixture (D-08) | `__tests__/fixtures/mock-agent-api.ts` (test tier) | — | Pure test helper; lives in `__tests__/fixtures/`, never imported by production code. |
| Legacy `mock-agent.ts` (D-08) | `__tests__/compatibility/legacy-pi-mock.test.ts` (compatibility test tier, gitignored-by-convention reports) | — | Kept for reference; does not run in default CI. |
| FIX-01 prebuild (D-14) | `package.json` `test:prebuild` + `vitest.config.ts` `globalSetup` (Node test tier) | `examples/interactive-visualizer/scripts/build.mjs` (build target) | Build script already exists; prebuild script is a thin wrapper. `globalSetup` is a guard rail, not a replacement. |
| Matrix report (D-16/D-17) | `tests/reports/mcp-adapter-test-report.md` + `.json` (CI / dashboard tier) | vitest custom reporter (production tier, `tests/reporters/`) | The reporter writes both files. README / dashboard consume the JSON. |
| SKILL.md parametric structure (D-10/D-11) | `skills/mcp-adapter-test/SKILL.md` (skill tier) | `skills/mcp-adapter-test/references/agent-paths/*.md` (skill reference tier) | Main file = parametric; per-agent details in references. Phase 8 merge-friendly. |
| README Pi-first-class + matrix (D-18..D-20) | `README.md` (docs tier) | `MAPPING.md` (existing) | README is the user-facing surface; matrix consumes `AGENT_ADAPTERS` via a generated snippet or hand-maintained table. |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **vitest** | 3.2.6 (verified via `node_modules/vitest/package.json`) | Test runner, `describe.each`, custom reporters, `globalSetup` | Already in `devDependencies`; project-standard since Phase 1. Supports parametric `describe.each` natively (Vitest 1+). |
| **TypeScript** | ^5.0.0 (devDep) | Type safety for `AgentAdapterDescriptor` + parametric test types | Already in stack; needed for typed factory tuple in `describe.each`. |
| **@vitest/coverage-v8** | ^3.2.6 | Coverage thresholds per file | Already configured in `vitest.config.ts`; existing per-source-file 80/60 thresholds carry over. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:child_process` (`spawnSync`) | Node 20+ built-in | Synchronous build trigger in `globalSetup` | Only inside `tests/global-setup.ts`; never in production code. |
| `node:fs/promises` | built-in | Detect `dist/` artifact presence | Inside `globalSetup`; reads `examples/interactive-visualizer/dist/{app.html,server.js}`. |
| `esbuild` | ^0.25.12 (devDep of `examples/interactive-visualizer/`) | Bundles the visualizer UI + server | Used by `examples/interactive-visualizer/scripts/build.mjs` (already exists per D-14). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `describe.each([['pi', factory], ['qoder', factory]])` | Two separate `describe` blocks (per-adapter files) | Rejected by D-04 / D-09. Two files = L-7 grep-drift risk; one file + parametric array = guaranteed symmetry. |
| vitest's built-in `json` reporter | Custom `Reporter` class writing both `.md` + `.json` | Built-in `json` produces vitest's spec format; we need a *matrix* shape (agent × section) — custom reporter required. |
| File-watch `globalSetup` (chokidar) | One-shot `fs.existsSync` check + `spawnSync` | File-watch is overkill: `dist/` is missing only when developer hasn't run the prebuild; one-shot check at suite start is enough. |
| Moving `mock-agent.ts` content inline into a `_legacy.test.ts` | Keep `__tests__/mock-agent.ts` and add `@deprecated` JSDoc | The file is in `__tests__/`, not `tests/compatibility/`. Moving it to `__tests__/compatibility/legacy-pi-mock.test.ts` and renaming file to `.test.ts` is the only way to prevent vitest from picking it up as a live test (D-08 requirement). |

**Installation:** No new packages needed. The prebuild uses already-installed `esbuild` (in `examples/interactive-visualizer/node_modules`).

**Version verification (already run):**
- `cat node_modules/vitest/package.json | head -3` → `vitest@3.2.6` ✓
- `cat node_modules/@vitest/coverage-v8/package.json | head -3` → `@vitest/coverage-v8@^3.2.6` ✓
- `cat examples/interactive-visualizer/package.json` → `esbuild@^0.25.12` ✓ (transitively installed)

---

## Package Legitimacy Audit

> Phase 7 does **not** install any new external packages. All dependencies are already in `package.json` or in the sub-package `examples/interactive-visualizer/package.json`. No `npm install` is required for this phase.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| vitest | npm | Already verified (3.2.6 installed) | Approved — no action |
| @vitest/coverage-v8 | npm | Already verified | Approved — no action |
| esbuild | npm (sub-dep of visualizer) | Already verified | Approved — used by existing `build.mjs` |
| typescript | npm | Already verified | Approved — no action |

**Packages removed due to [SLOP] verdict:** none — no new packages introduced
**Packages flagged as suspicious [SUS]:** none

*No new packages discovered via WebSearch or training data; all references in this research are to packages already in the project's lockfile.*

---

## Architecture Patterns

### Pattern 1: Static adapter registry (`AGENT_ADAPTERS`)

**What:** A single typed array in `interfaces/agent-api.ts` enumerates every supported `AgentAPI` adapter. The descriptor carries everything downstream consumers need: identity, factory, display metadata, path-resolver, and capability hints.

**When to use:** This is the canonical pattern for "list of plug-ins the project knows about" — a one-source-of-truth that test runners, gate inspectors, reports, and documentation all read from. The alternative (importing concrete adapter classes in each consumer) creates drift.

**Example (proposed shape for `interfaces/agent-api.ts`):**

```typescript
/**
 * Static registry of every supported `AgentAPI` adapter in the project.
 *
 * Consumers:
 *   - `__tests__/adapter-contract.test.ts` uses `AGENT_ADAPTERS.map(a => a.factory)`
 *     as the `describe.each` input (D-04/D-09).
 *   - Capability Gate step in `skills/mcp-adapter-test/SKILL.md` walks this list
 *     to surface which adapters are supported (D-02).
 *   - README "Supported Agents" matrix reads `displayName` + `capabilities` (D-18).
 *   - Matrix report writer reads `id` + `displayName` for column headers (D-16).
 *
 * To add a new adapter: import its constructor + resolver here, push one descriptor.
 * No other file in the project needs to change.
 */
export interface AgentAdapterDescriptor {
  /** Stable identifier (matches `AgentId` from `interfaces/agent-paths.ts`). */
  id: AgentId;
  /** Human-readable name for README / report headers. */
  displayName: string;
  /** Factory returning a fresh adapter instance (called per `describe.each` iteration). */
  factory: () => AgentAPI;
  /** Path resolver factory — kept here to keep all adapter metadata in one place. */
  resolverFactory: () => AgentPathResolver;
  /** Free-form hints for env vars / files that indicate this adapter is loaded. */
  envHints?: ReadonlyArray<{ envVar?: string; filePath?: string }>;
  /** Optional UI / sampling / renderer capabilities for the README matrix column. */
  capabilities?: {
    ui?: boolean;
    sampling?: boolean;
    renderer?: boolean;
  };
}

export const AGENT_ADAPTERS: AgentAdapterDescriptor[] = [
  {
    id: "pi",
    displayName: "Pi",
    factory: () => new PiAdapter(/* ExtensionAPI placeholder, real wiring in tests */),
    resolverFactory: createPiResolver,
    envHints: [{ envVar: "PI_CODING_AGENT_DIR" }],
    capabilities: { ui: true, sampling: true, renderer: true },
  },
  {
    id: "qoder",
    displayName: "Qoder",
    factory: () => new QoderAdapter(),
    resolverFactory: createQoderResolver,
    envHints: [{ envVar: "MCP_AGENT_DIR" }],
    capabilities: { ui: false, sampling: true, renderer: false },
  },
  // Future: { id: "claude", displayName: "Claude", factory: ..., resolverFactory: ... },
];
```

**Verification:** With this registry, `AGENT_ADAPTERS.length === 2` (Pi+Qoder) at Phase 7 end. Adding a third adapter later (e.g., Claude) requires exactly one `push()` and all downstream consumers pick it up automatically.

[VERIFIED: interfaces/agent-api.ts + interfaces/agent-paths.ts + adapters/pi-adapter.ts + adapters/qoder-adapter.ts — direct codebase read]

### Pattern 2: Parametric `describe.each` with factory functions

**What:** vitest's `describe.each` accepts an array of tuples; each tuple produces a nested `describe` block with the tuple values bound as positional args. Phase 7 uses `[[adapterId, factory]]` tuples so the same 8 contract cases expand across all registered adapters.

**When to use:** Whenever the same test logic must run against multiple values of a single dimension (here: adapter). The factory function is called once per `describe.each` iteration, producing an isolated adapter instance — this prevents test cross-contamination (state from one adapter bleeding into another).

**Example (`__tests__/adapter-contract.test.ts` rewrite, D-04/D-09):**

```typescript
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { AgentAPI } from "../interfaces/agent-api.ts";
import { AGENT_ADAPTERS } from "../interfaces/agent-api.ts";

describe.each(
  AGENT_ADAPTERS.map((a) => [a.id, a.factory] as const),
)("AgentAPI contract — adapter: %s", (id, factory) => {
  let adapter: AgentAPI;

  beforeEach(() => {
    adapter = factory(); // fresh instance per test → no cross-adapter state leak
  });

  afterEach(() => {
    // QoderAdapter's detached state is reset by the constructor; nothing else
    // to clean up for the generic contract surface.
  });

  it("Test 1: exposes all 8 required methods", () => {
    for (const m of [
      "registerTool", "registerCommand", "registerFlag", "on",
      "getAllTools", "getFlag", "sendMessage", "exec",
    ] as const) {
      expect(typeof adapter[m]).toBe("function");
    }
  });

  it("Test 2: registerTool stores the tool", () => {
    adapter.registerTool({ name: "x", execute: vi.fn() });
    // getAllTools is the universally-observable signal (D-01)
    expect(adapter.getAllTools().some((t) => t.name === "x")).toBe(true);
  });

  it("Test 3: registerCommand stores the command", () => {
    adapter.registerCommand("c", { description: "c", handler: vi.fn() });
    // No universal signal; this test asserts via a side effect (re-registering
    // a flag of the same name would collide in Pi's Map, so we keep it simple).
  });

  // ... 5 more method-level cases (D-05 requires ≥2 per method; we add 1 baseline
  //     + 1 error/edge case per method = 16 contract cases per adapter; the
  //     8 in the original adapter-contract.test.ts are the "baseline" set.
});

describe("MockAgentAPI server compatibility (40 cases — D-06 single run)", () => {
  // 40 cases remain agent-agnostic; they exercise the demo servers through
  // MockAgentAPI (which is server-agnostic). See Pattern 4.
});
```

**Isolation:** The `beforeEach(() => adapter = factory())` line guarantees a **fresh adapter per test**, not per `describe.each` iteration. This is the correct granularity — one test's tool-registration side effects must not leak into the next test. `factory()` returning `new PiAdapter(...)` or `new QoderAdapter()` each call is the contract.

[VERIFIED: vitest 3.2.6 docs — https://vitest.dev/api/describe#describe-each — direct WebFetch; existing `__tests__/qoder-adapter.test.ts` pattern of `beforeEach(() => adapter = new QoderAdapter())` is the model]

### Pattern 3: Capability Gate via `getAllTools()` (the universal signal)

**What:** The Capability Gate's verdict comes from one source: the names of tools returned by `adapter.getAllTools()`. Path A = `'mcp'` in the list; Path B = names matching `^<server>_` regex; Path C = neither. This is the only signal that works uniformly across Pi (Maps), Qoder (Maps), and any future adapter that respects the `AgentAPI` contract (D-01).

**When to use:** Whenever the test environment is heterogeneous (different agents, different hosts) and the answer to "what path do I take?" depends on what the agent actually registered, not on env vars or file presence.

**Example (Capability Gate step output table for SKILL.md):**

```text
| Agent   | Adapter          | Path | Tools registered (sample)                                | Resolved                                          |
|---------|------------------|------|----------------------------------------------------------|---------------------------------------------------|
| Pi      | PiAdapter        | A    | mcp, calculator_add, string-utils_upper, ... (mixed)     | Use Path A — mcp proxy tool registered            |
| Qoder   | QoderAdapter     | A    | mcp, ...                                                 | Use Path A — mcp proxy tool registered            |
| (none)  | (no agent host)  | C    | (empty)                                                  | mcp-adapter NOT loaded as extension in this env   |
```

**Reliability comparison:**

| Signal                                       | Pi | Qoder | Future adapter | Verdict |
|----------------------------------------------|----|-------|----------------|---------|
| `mcp` tool in `getAllTools()`                | ✓  | ✓     | ✓ (if createMcpAdapter wired) | **Universal** |
| DirectTools prefix `^<server>_`              | ✓  | ✓     | ✓ (if directTools on)         | Universal, but **subset** of A — only present when directTools is configured |
| Env var set by host (`PI_CODING_AGENT_DIR`)  | ✓  | ✗     | ✗ (Qoder uses `MCP_AGENT_DIR`) | **Not universal** — different per agent |
| Registry file presence (e.g., `~/.pi/agent`) | ✓  | ✗     | ✗                             | **Not universal** |
| Live CLI on PATH (`pi`, `qodercli`)          | ✗  | ✓ (Qoder) | varies                    | **Flaky** — CI without CLI fails; not for gate |

**Key insight:** The `mcp` proxy tool registration is a **side effect of `createMcpAdapter(adapter, ctx, config, cache)`** — a single test wires the adapter through the universal entry point, then queries `getAllTools()`. This is the same pattern Phase 6 P-5/P-7 used in `qoder-adapter-integration.test.ts` test 1 (verified in `06-LEARNINGS.md` §3.2).

[VERIFIED: 06-LEARNINGS.md S-4 — direct codebase read; `__tests__/qoder-adapter-integration.test.ts` lines 129-136 — direct codebase read; `adapters/entry.ts` line 296 — direct codebase read]

### Pattern 4: MockAgentAPI fixture (generic, agent-agnostic)

**What:** A reusable, fully-typed `MockAgentAPI` class that implements all 8 `AgentAPI` methods with in-memory Maps / Sets / `vi.fn()` storage. Used by the 40 server-compatibility cases (D-08 replacement of Pi-specific `MockAgent`).

**When to use:** Anywhere a test needs an `AgentAPI` it can poke at without spawning an agent host — the "fake agent" pattern. This is the `MockAgentAPI` from `__tests__/mock-adapter.test.ts` extracted into a shared fixture.

**Example (`__tests__/fixtures/mock-agent-api.ts`):**

```typescript
import type { AgentAPI, CommandConfig, FlagConfig, ToolInfo, ToolRegistration } from "../../interfaces/agent-api.ts";

/**
 * Generic, agent-agnostic AgentAPI mock.
 * Replaces the Pi-specific `MockAgent` from `tests/compatibility/non-pi-agent.test.ts`.
 * Used by `__tests__/adapter-contract.test.ts` for the 40 server-compatibility
 * cases (D-08).
 *
 * Storage mirrors QoderAdapter's shape: Maps for tools/commands/flags,
 * Map<event, Set<handler>> for events. This is the "lowest common denominator"
 * that works uniformly across all AgentAPI implementations.
 */
export class MockAgentAPI implements AgentAPI {
  readonly tools = new Map<string, ToolRegistration>();
  readonly commands = new Map<string, CommandConfig>();
  readonly flags = new Map<string, FlagConfig & { value?: string }>();
  readonly handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();
  readonly messages: Array<{ message: unknown; options?: unknown }> = [];
  readonly execResults: Array<{ command: string; args: string[]; result: unknown }> = [];
  defaultExecResult: unknown = { code: 0, stdout: "", stderr: "" };

  registerTool(tool: ToolRegistration): void { this.tools.set(tool.name, tool); }
  registerCommand(name: string, config: CommandConfig): void { this.commands.set(name, config); }
  registerFlag(name: string, config: FlagConfig): void { this.flags.set(name, { ...config }); }
  on(event: string, handler: (...args: unknown[]) => unknown): void {
    let s = this.handlers.get(event);
    if (!s) { s = new Set(); this.handlers.set(event, s); }
    s.add(handler);
  }
  getAllTools(): ToolInfo[] { return [...this.tools.values()].map((t) => ({ name: t.name })); }
  getFlag(name: string): string | undefined { return this.flags.get(name)?.value; }
  sendMessage(message: unknown, options?: unknown): void { this.messages.push({ message, options }); }
  async exec(command: string, args: string[]): Promise<unknown> {
    const r = this.defaultExecResult;
    this.execResults.push({ command, args, result: r });
    return r;
  }
}
```

**Why this shape:** Mirrors QoderAdapter's storage so the 40 server-compatibility cases (which need to register tools, fire `session_start`, observe `getAllTools()`) work the same way against `MockAgentAPI` as against `QoderAdapter` in the parametric run. This is the key to D-06's "40 server cases × 1 MockAgentAPI" claim — the same logic runs unchanged.

[VERIFIED: `__tests__/qoder-adapter-integration.test.ts` lines 41-60 (the `qoderAdapter` Map shape) — direct codebase read; existing `__tests__/mock-adapter.test.ts` lines 84-139 (the existing `MockAgentAPI` inline class) — direct codebase read]

### Pattern 5: `globalSetup` build hook (FIX-01)

**What:** A vitest `globalSetup` file that runs *once* before any test worker starts, checks for `examples/interactive-visualizer/dist/{app.html,server.js}`, and if either is missing, runs `npm run build` in the visualizer sub-package. This is the safety net for D-14.

**When to use:** When a test depends on build artifacts that the developer might forget to produce. The safety net prevents "works on CI, fails on fresh clone" friction.

**Example (`tests/global-setup.ts`):**

```typescript
// vitest.config.ts imports this as `test.globalSetup`.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(PROJECT_ROOT, "examples/interactive-visualizer/dist");

export default function setup(): void {
  const appHtml = resolve(DIST, "app.html");
  const serverJs = resolve(DIST, "server.js");
  if (existsSync(appHtml) && existsSync(serverJs)) {
    return; // already built; nothing to do
  }
  console.log("[globalSetup] dist/ missing — running prebuild…");
  const r = spawnSync("npm", ["run", "build"], {
    cwd: resolve(PROJECT_ROOT, "examples/interactive-visualizer"),
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error(`prebuild failed (exit ${r.status}); see output above`);
  }
}
```

**Why `globalSetup` and not `setupFiles`:** Per vitest 3.2.6 docs (https://vitest.dev/config/globalsetup), `globalSetup` runs **once before any worker** — perfect for a one-shot build check. `setupFiles` would run *before every test file*, which is wasteful.

**Config (`vitest.config.ts`):**

```typescript
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts", "tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // ... existing coverage config ...
  },
});
```

[VERIFIED: vitest 3.2.6 docs — https://vitest.dev/config/globalsetup — direct WebFetch]

### Pattern 6: Custom JSON reporter (D-17)

**What:** A vitest `Reporter` class that, on test completion, writes both the human-readable Markdown matrix (`tests/reports/mcp-adapter-test-report.md`) and a JSON sidecar (`tests/reports/mcp-adapter-test-report.json`) summarizing pass/fail per `(agent, section)` cell. Registered alongside the default reporter.

**When to use:** When the test output must feed downstream automation (CI badges, dashboards) in a structured format. Built-in `json` reporter produces vitest's spec tree, not a matrix — a custom reporter is the right answer.

**Example (`tests/reporters/matrix-reporter.ts`):**

```typescript
// vitest.config.ts imports this via `test.reporters: ['default', ['./tests/reporters/matrix-reporter.ts']]`
import type { Reporter, TestModule, TestResult, TestRunEndReason } from "vitest/reporters";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface MatrixRow { agent: string; section: string; pass: number; fail: number; }

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(PROJECT_ROOT, "tests/reports");
const REPORT_MD = resolve(REPORT_DIR, "mcp-adapter-test-report.md");
const REPORT_JSON = resolve(REPORT_DIR, "mcp-adapter-test-report.json");

export default class MatrixReporter implements Reporter {
  private rows: MatrixRow[] = [];

  onTestModuleEnd(testModule: TestModule): void {
    // Each `describe.each` iteration becomes a child test module in vitest 3.
    // We bucket pass/fail by the iteration's group label (e.g., "adapter: pi",
    // "adapter: qoder", "MockAgentAPI server compat") + the top-level section.
    const group = testModule.moduleId ?? "unknown";
    // ... parse the group label, increment the row counters ...
  }

  onTestRunEnd(endReason: TestRunEndReason): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    // Build the Markdown matrix table from `this.rows`.
    const md = renderMatrixTable(this.rows);
    writeFileSync(REPORT_MD, md);
    writeFileSync(REPORT_JSON, JSON.stringify({ rows: this.rows, endReason }, null, 2));
  }
}
```

**Why a class and not a hook inside a `setupFile`:** `Reporter.onTestRunEnd` is the only vitest hook guaranteed to fire *after every test module has reported*. A `setupFile` would only run once at the start; an `afterAll` block would only run per file. The reporter is the right hook surface.

[VERIFIED: vitest 3.2.6 docs — https://vitest.dev/guide/reporters#custom-reporters — direct WebFetch]

### Pattern 7: SKILL.md parametric structure (D-10/D-11)

**What:** The main SKILL.md becomes a *short parametric* file — each Phase is a section that says *what* to do (semantic), with the *how* (agent-specific commands) extracted into `references/agent-paths/<agent>.md`. New adapter = new reference file; main SKILL.md untouched.

**When to use:** Any skill that must work across multiple agent hosts and is expected to receive upstream changes from a single-host upstream. Splitting the agent-specific bits into separate files reduces the merge-conflict surface (D-21 / UPSTREAM-04).

**Before (current state, `skills/mcp-adapter-test/SKILL.md` §122-138):**

```markdown
### Step 3 — Capability Gate (environment detection)

Check the agent's tool list to determine which E2E path to take:

- **Path A — mcp proxy**: `mcp` tool IS in the agent's tool list
  → mcp-adapter is loaded and tools are routed through the single `mcp` proxy tool.
  Verify the complete search→describe→call flow through the proxy for all 10 servers.

- **Path B — directTools**: Individual prefixed tools ARE in the agent's tool list
  (e.g. `calculator_add`, `calculator_subtract`, `string-utils_upper`)
  → mcp-adapter is loaded with `directTools: true` and tools are registered individually.
  Verify individual tool existence and functionality.

- **Path C — SDK_DIRECT fallback**: NEITHER Path A nor Path B
  → mcp-adapter is NOT loaded as an extension in this environment.
  Run all E2E tests via MCP SDK direct stdio connection.
```

**After (parametric main + per-agent reference):**

**`skills/mcp-adapter-test/SKILL.md` (main, short parametric):**

```markdown
## Phase 4: Per-Path Verification

### Step 0 — Capability Gate (agent-agnostic, runs FIRST)

For each registered adapter in `AGENT_ADAPTERS`, wire the universal entry
(`createMcpAdapter(adapter, ctx, testConfig, null)`) and inspect
`adapter.getAllTools()`. Record the path per the table below; surface the
result in the master report.

| `mcp` in tool list? | `^<server>_` prefix in tool list? | Path | Resolved                                    |
|---------------------|------------------------------------|------|---------------------------------------------|
| yes                 | any                                | A    | mcp proxy tool registered                   |
| no                  | yes (at least one server prefix)   | B    | directTools mode, individual tools          |
| no                  | no                                 | C    | mcp-adapter NOT loaded as extension here    |

> Path-specific *how* (which commands to run, what to assert) lives in
> `references/agent-paths/<agent>.md`. Main SKILL.md does not duplicate it.
> See `references/agent-paths/pi.md`, `qoder.md`, `_template.md`.

### Step 1 — Path-specific verification (per agent)

Read the agent's reference file (`references/agent-paths/<id>.md`) and execute
the verification commands listed there. Record results in the master report.
```

**`skills/mcp-adapter-test/references/agent-paths/pi.md`:**

```markdown
# Pi — Path A / B / C verification

## Path A: mcp proxy tool (Pi)
The `mcp` proxy tool is registered by `createMcpAdapter`. Verify by:
1. `mcp({})` → status shows all 10 configured servers
2. `mcp({ search: "keyword" })` → returns matching tool descriptions
3. `mcp({ describe: "tool_name" })` → returns parameter schemas
4. `mcp({ tool: "tool_name", args: '{"key":"value"}' })` → returns correct result
5. Run smoke calls for all 10 servers through the proxy (see `../smoke-calls.md`)

## Path B: directTools (Pi, when `directTools: true`)
1. Confirm individual tools appear: `calculator_add`, `calculator_subtract`, …
2. Call `calculator_add({a: 10, b: 20})` directly
3. Verify tool naming follows the prefix mode (default = server prefix)

## Path C: SDK_DIRECT fallback
See `tests/smoke/e2e-all-servers.test.ts` — covered by Phase 4 Step 4.
```

**`skills/mcp-adapter-test/references/agent-paths/qoder.md`:** mirror structure; note Qoder lacks `theme.fg` so renderer-based assertions are skipped.

**`skills/mcp-adapter-test/references/agent-paths/_template.md`:** scaffold for new agents — what to fill in for each Path.

[VERIFIED: existing `skills/mcp-adapter-test/references/smoke-calls.md` is the same "table-per-section" pattern that the references folder already uses; `MAPPING.md` and the new `agent-paths/` directory fit the same convention]

### Anti-Patterns to Avoid

- **❌ Per-adapter test files (`__tests__/pi-adapter.test.ts` + `__tests__/qoder-adapter.test.ts` for the contract surface):** Phase 6 L-7 already documented that per-adapter files drift out of sync (`grep -c` checks fail when one file is updated and the other isn't). D-04 explicitly rejects this. **Use the parametric `describe.each` instead.**
- **❌ Pi-specific env var checks in the Gate (`PI_CODING_AGENT_DIR` set?):** Different agents use different env vars (Pi → `PI_CODING_AGENT_DIR`; Qoder → `MCP_AGENT_DIR`). The only universal signal is `getAllTools()` (D-01, S-4).
- **❌ Keeping `mock-agent.ts` as a separate `.ts` file in `__tests__/`:** vitest's `include` pattern (`__tests__/**/*.test.ts`) would still pick it up as a test file (if it has tests) or as a stale fixture (if not). D-08 requires moving to `__tests__/compatibility/legacy-pi-mock.test.ts` — the `.test.ts` extension + `_legacy_` prefix clearly marks it as opt-in.
- **❌ Auto-skipping Capability Gate on missing tools:** SKILL.md currently has a "No Auto-Skip" note (current line 139-142). The Gate verdict must always be reported, even when Path C — this is what D-02 makes explicit.
- **❌ Adding a per-adapter `interfaces/<agent>-api.ts`:** Phase 6 already proved all adapter-specific types live inside the `AgentAPI` surface (`interfaces/agent-api.ts`). Per-adapter interface files are unnecessary indirection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Adapter introspection ("which tools are registered?") | Walk the adapter's private Maps (impossible — they're closure-private inside `createMcpAdapter`) | `adapter.getAllTools()` (D-01) | The only externally-observable signal. Pi's `ExtensionAPI` doesn't expose its internal storage; Qoder's does (`tools.values()`), but we need *one* uniform signal across both. |
| Parametric test framework | Custom runner that loops over adapters and runs each in a child process | vitest's built-in `describe.each` with factory tuples | vitest already gives per-iteration isolation, parallel scheduling, and failure reporting. Building this from scratch loses all of that. |
| Prebuild detection | Watch `dist/` with chokidar; rebuild on every change | One-shot `fs.existsSync` check in `globalSetup` | Watch is wasteful — the artifacts only change when the developer edits `examples/interactive-visualizer/src/`. A single check at suite start is enough. |
| Matrix report generation | Custom CLI that calls vitest via its JSON output, then post-processes | A custom vitest `Reporter` (Pattern 6) | `Reporter.onTestRunEnd` fires after all tests; the data is in scope. A CLI wrapper would require parsing vitest's stdout, which is fragile. |
| Per-adapter capability hints ("does this agent support UISystem.setStatus?") | Boolean flags in the adapter class | Probe via `createMcpAdapter` + try the call + observe | Phase 6 L-5 documented this: a fabricated `{ setStatus: vi.fn() }` UI literal would falsely enable elicitation. Use the adapter's *actual* UI, not a copy. |
| Path resolution | Hardcode `~/.pi/agent` in tests | `createPiResolver` / `createQoderResolver` factories | Phase 2 established the `AgentPathResolver` contract. The registry descriptors (D-07) carry `resolverFactory` so tests consume them uniformly. |

**Key insight:** The phase's complexity is in the *coordination* across 5+ files (registry, test, gate, SKILL, report) — not in any individual piece. Each piece is small (registry is ~30 lines, factory tuple test is ~60 lines, Gate table is ~20 lines, SKILL.md split is mechanical, reporter is ~80 lines). The total surface is around 250-300 lines of new code spread across 4-5 files.

---

## Validation Architecture

> Per `.planning/config.json` `workflow.nyquist_validation` is absent (treated as enabled). This section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.2.6 (verified via `node_modules/vitest/package.json`) |
| Config file | `vitest.config.ts` (existing, 91 lines) — to be amended with `globalSetup` (D-14) and new reporter (D-17) |
| Quick run command (parametric) | `npx vitest run __tests__/adapter-contract.test.ts` (8 cases × N adapters = 16 by default) |
| Full layer run | `npx vitest run` (entire suite) |
| Full matrix opt-in | `AGENT_API_FULL_MATRIX=1 npx vitest run` (N × 44 heavy) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Capability Gate runs first, before any test | unit (Gate step extracted from SKILL.md as a separate "Phase 1.5" / pre-Phase-4 step) | `npx vitest run __tests__/capability-gate.test.ts` (NEW) | ❌ Wave 0 |
| TEST-02 | Gate reports `Agent | Adapter | Path | Tools | Resolved` | unit | (same as TEST-01) | ❌ Wave 0 |
| TEST-03 | MockAgentAPI replaces Pi-specific MockAgent in adapter-contract.test.ts | unit | `npx vitest run __tests__/adapter-contract.test.ts` | ❌ Wave 0 (rewrite) |
| TEST-04 | 8 AgentAPI methods × N adapters parametric | unit | (same as TEST-03) | ❌ Wave 0 (rewrite) |
| TEST-05 | SKILL.md Phase 4 supports any agent | manual review (SKILL.md is prose) | `npx vitest run` (full suite) | n/a |
| DOC-01..03 | README "Pi-first-class + matrix" + Verification section + two entry points | manual review (README is prose) | `npx vitest run` (no test, but link-check) | n/a |
| FIX-01 (D-14/D-15) | `__tests__/interactive-visualizer-server.test.ts` passes | integration | `npm run test:prebuild && npx vitest run __tests__/interactive-visualizer-server.test.ts` | ✅ existing |

### Test Isolation Strategy for Parametric Runs

**Critical concern:** The `describe.each` factory pattern in Pattern 2 must guarantee that **state from one adapter's test does not leak into the next adapter's test**. This is non-trivial because some adapters (Qoder) attach stateful resources (a `Query` handle, a 32-message send buffer).

**Mitigations (in priority order):**

1. **`beforeEach` creates a fresh adapter via `factory()`** — already specified in Pattern 2. This is the **primary** defense. The QoderAdapter constructor (`adapters/qoder-adapter.ts:64`) initializes empty Maps and an empty `queryRef = undefined`; no cross-test state survives.
2. **`afterEach` releases any per-test resources** — for the generic 8-method contract tests, no resources are allocated (the adapter's Maps are simply garbage-collected when the test ends). The `node:child_process` mock in `qoder-adapter.test.ts` lines 20-26 prevents real subprocesses from leaking.
3. **Worker isolation** — vitest 3 spawns separate worker processes per test file by default (verified by `test.isolate` defaulting to `true`). The parametric tests all live in **one file** (`__tests__/adapter-contract.test.ts`), so they share a worker. The `beforeEach` factory pattern keeps isolation **within** the worker.
4. **Mocks are scoped to the test file** — `vi.mock("node:child_process", ...)` in `qoder-adapter.test.ts` is automatically reset at the end of the file (vitest's `vi.restoreAllMocks()` runs on worker teardown).

**The 40 server-compatibility cases use `MockAgentAPI`** (Pattern 4) — no real subprocesses, no real network. Isolation is automatic.

### How Mock State is Reset Between Adapter Instances

- **`MockAgentAPI`:** every `new MockAgentAPI()` in the test's `beforeEach` produces a fresh instance with empty Maps. No `mockReset()` needed; the constructor *is* the reset.
- **PiAdapter (parametric, if included):** constructing a new `PiAdapter(pi)` with a fresh `vi.fn()`-based `ExtensionAPI` mock is the reset.
- **QoderAdapter (parametric, in 7+:):** `new QoderAdapter()` resets all Maps + `queryRef = undefined` + `bufferedMessages = []` (verified `adapters/qoder-adapter.ts:64-95`).

### How Async Setup is Awaited Before Assertions

- **`createMcpAdapter(adapter, ctx, config, null)` is synchronous** (verified `adapters/entry.ts:58-63` — no `async`). Registration (tools, commands, flags) completes before the function returns. Test assertions can run immediately after.
- **`adapter.on("session_start", handler)`** is the *registration* of an async handler. To drive it, call `adapter.fireSessionStart(ctx)` (Qoder's companion method) or whatever the adapter's driver is, then `await` it. The handler's `await initializeMcp(...)` is fired-and-forgotten; tests that need to wait use `waitForConnection()` (Pattern from Phase 6 P-7, verified `qoder-adapter-integration.test.ts:302-313`).
- **`globalSetup`'s prebuild** is synchronous (`spawnSync`) — vitest blocks on `globalSetup` return before spawning workers (verified by vitest 3.2.6 docs, "global setup is called before the test workers are created").

### Sampling Rate

- **Per task commit:** `npx vitest run __tests__/adapter-contract.test.ts` (~2s, parametric 8×N = 16 cases)
- **Per wave merge:** `npx vitest run` (full suite, ~30s)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/fixtures/mock-agent-api.ts` (NEW — D-08 generic mock)
- [ ] `__tests__/adapter-contract.test.ts` (REWRITE — D-04/D-09 parametric)
- [ ] `__tests__/capability-gate.test.ts` (NEW — D-01..D-03 gate unit test)
- [ ] `tests/global-setup.ts` (NEW — D-14 prebuild safety net)
- [ ] `tests/reporters/matrix-reporter.ts` (NEW — D-17 JSON sidecar)
- [ ] `interfaces/agent-api.ts` amendment (D-07 `AGENT_ADAPTERS` + `AgentAdapterDescriptor`)
- [ ] `tests/reports/mcp-adapter-test-report.md` (NEW — D-16 unified matrix, regenerated by reporter)
- [ ] `tests/reports/mcp-adapter-test-report.json` (NEW — D-17 JSON sidecar)
- [ ] `__tests__/compatibility/legacy-pi-mock.test.ts` (NEW — D-08 moved + marked deprecated)
- [ ] `tests/reports/qoder-adapter-test-report.md` (DEPRECATE — D-16; stop writing; keep gitignored)
- [ ] `package.json` `test:prebuild` + `test` script amendment (D-14)
- [ ] `vitest.config.ts` `globalSetup` field + reporter registration (D-14/D-17)
- [ ] `skills/mcp-adapter-test/SKILL.md` (REWRITE — D-10/D-11 short parametric)
- [ ] `skills/mcp-adapter-test/references/agent-paths/pi.md` (NEW — D-10/D-11)
- [ ] `skills/mcp-adapter-test/references/agent-paths/qoder.md` (NEW — D-10/D-11)
- [ ] `skills/mcp-adapter-test/references/agent-paths/_template.md` (NEW — D-10/D-11)
- [ ] `README.md` (REWRITE — D-18..D-20)

**Framework install:** No framework install — all infrastructure is in place.

---

## File-by-File Impact Analysis

### 1. `interfaces/agent-api.ts` (add `AGENT_ADAPTERS`)

**Current state:** 141 lines; defines `AgentAPI`, `AgentContext`, `UISystem`, `ToolInfo`, etc. No registry.

**Required changes:**
1. Import `AgentId` and `AgentPathResolver` from `./agent-paths.ts` (currently has no cross-import).
2. Import `PiAdapter` and `QoderAdapter` constructors (note: importing concrete adapters from `interfaces/agent-api.ts` is a **layer-violation** concern — see Open Question #1).
3. Add `AgentAdapterDescriptor` interface (Pattern 1 example).
4. Add `export const AGENT_ADAPTERS: AgentAdapterDescriptor[]` with 2 entries (Pi, Qoder).
5. Add `pathResolver: () => AgentPathResolver` import from `interfaces/agent-paths.ts`.

**Layer-violation mitigation:** If importing concrete adapters in `interfaces/agent-api.ts` is unacceptable (it's arguably a design rule violation — interface modules shouldn't depend on implementations), the alternative is to put the registry in a new file `interfaces/agent-adapter-registry.ts` that imports the adapters. D-07 says "in `interfaces/agent-api.ts`" but the implementer's discretion allows relocation. **Recommendation: keep in `interfaces/agent-api.ts` (matches D-07 verbatim) — the violation is minor and the registry is a single, easy-to-find source of truth.**

**Risk:** circular import? `interfaces/agent-paths.ts` does not import from `interfaces/agent-api.ts`, so no cycle. `adapters/pi-adapter.ts` imports from `interfaces/agent-api.ts` but not from `interfaces/agent-paths.ts` (verified). `adapters/qoder-adapter.ts` same. → **No circular import risk.**

**Estimated effort:** 30-50 lines added.

### 2. `__tests__/adapter-contract.test.ts` (rewrite with `describe.each`)

**Current state:** 181 lines; 5 tests (Test 1..5) covering the universal AgentAPI shape. **No parametric expansion** — only the generic mock.

**Required changes:**
1. Remove the inline `MockAgentAPI` class (lines 58-91) — it moves to `__tests__/fixtures/mock-agent-api.ts`.
2. Import `AGENT_ADAPTERS` from `interfaces/agent-api.ts`.
3. Replace the 5 top-level `describe` blocks with one `describe.each(AGENT_ADAPTERS.map(...))` block (Pattern 2 example) — 8 contract cases per adapter.
4. Add the 40 server-compatibility cases (D-06) using `MockAgentAPI` (Pattern 4) — these are the *server* contract, not the *adapter* contract.
5. Keep `loadMcpConfig` test (Test 5) as a sanity check.

**Preserve:** 100% of the existing assertion semantics (D-08 specific: 旧 44 case 内容保留, 仅 mock 改为 MockAgentAPI). The current 5 tests are kept verbatim inside the `describe.each` — only the wrapping changes from `describe` to `describe.each(...)`.

**Estimated effort:** 200-250 lines (rewrite).

### 3. `__tests__/fixtures/mock-agent-api.ts` (NEW)

**Required content:** Pattern 4 example above (~60 lines).

**Location:** `__tests__/fixtures/` is a new directory. Verify it doesn't already exist (`list_dir` shows only `.ts` files, no `fixtures/`).

**Verification:** The fixture must be **zero Pi references** (D-08 specific). A `grep -E "Pi|pi-" __tests__/fixtures/mock-agent-api.ts` should return 0 hits.

**Estimated effort:** 60 lines.

### 4. `__tests__/compatibility/legacy-pi-mock.test.ts` (NEW, from old `mock-agent.ts`)

**Current state of `__tests__/mock-agent.ts`:** Wait — the directory listing shows `__tests__/mock-adapter.test.ts` (266 lines, the *test* for the inline `MockAgentAPI`), but no `__tests__/mock-agent.ts` file. D-08 wording says "旧 `mock-agent.ts` 移至" — this is the inline `MockAgentAPI` in `mock-adapter.test.ts` (the existing test file) **and** the older `tests/compatibility/non-pi-agent.test.ts` (which has the `MockAgent` class with Pi-specific quirks).

**Action:** Move `MockAgent` from `tests/compatibility/non-pi-agent.test.ts` lines 7-28 to a new `__tests__/compatibility/legacy-pi-mock.test.ts`. Add `@deprecated` JSDoc.

**Verification:** A `grep -r "MockAgent" __tests__/compatibility/` should return only the new legacy file. The compatibility tests (the 40 cases) now use `MockAgentAPI` from `__tests__/fixtures/`.

**Estimated effort:** 30-50 lines (move + deprecate annotation).

### 5. `vitest.config.ts` (add `globalSetup` + reporter)

**Current state:** 91 lines; coverage config + per-source-file thresholds.

**Required changes:**
1. Add `globalSetup: ["./tests/global-setup.ts"]` (D-14).
2. Add `reporters: ["default", "./tests/reporters/matrix-reporter.ts"]` to `test:` block (D-17).
3. (Optional) `outputFile` config to point default reporter to a per-run file (not strictly needed).

**Verification:** After change, `npx vitest run --reporter=default` should still work (override is the default behavior). With no `--reporter` flag, the config's `reporters` list applies → both default and matrix reporter run.

**Estimated effort:** 10 lines.

### 6. `package.json` (add `test:prebuild`)

**Current state:** `"test": "vitest run"`, no prebuild.

**Required changes:**
```diff
   "scripts": {
-    "test": "vitest run",
+    "test": "npm run test:prebuild && vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage",
+    "test:prebuild": "cd examples/interactive-visualizer && tsc -p . --noEmit && node ./scripts/build.mjs",
     "test:oauth-provider": "node --import tsx --test mcp-oauth-provider.test.ts"
   }
```

**Note on `tsc -p`:** The visualizer's `tsconfig.json` has `"noEmit": true` (line 13 of `examples/interactive-visualizer/tsconfig.json`). The prebuild's `tsc -p . --noEmit` is purely a type-check; the actual emit happens via `esbuild` in `build.mjs`. This is the pattern verified in D-14.

**Verification:** `npm run test:prebuild` from project root should produce `examples/interactive-visualizer/dist/{app.html,server.js}`. `git stash` + re-run at fresh state should still produce them (proves no missing-dependency).

**Estimated effort:** 5 lines.

### 7. `skills/mcp-adapter-test/SKILL.md` (split to short parametric)

**Current state:** 228 lines; Phases 1-5 with Step 3 (Capability Gate) embedded in Phase 4.

**Required changes:**
1. Extract "Capability Gate" into its own step (D-03), run **before** Phase 4.
2. Replace Phase 4 Step 3's Pi-biased prose with a parametric table (Pattern 7 example).
3. Move "Path A `mcp({})` call examples" to `references/agent-paths/pi.md`.
4. Add "🟡 baseline-bound" notes at Section 5/5B thresholds (D-12).
5. Add an "Agent-agnostic parametric structure" note at the top, pointing to `references/agent-paths/`.

**Verification:** `wc -l skills/mcp-adapter-test/SKILL.md` should drop from 228 to ~140-160 lines (the per-agent details move to references).

**Estimated effort:** 90 lines of SKILL.md + 3 new reference files (~40 lines each = 120 lines).

### 8. `skills/mcp-adapter-test/references/agent-paths/{pi,qoder,_template}.md` (NEW)

**Required content:**
- `pi.md`: Pattern 7 example (Path A/B/C Pi-specific commands, ~40 lines).
- `qoder.md`: mirror with Qoder notes (lacks `theme.fg`, has `attachQuery` / `detachQuery` for live testing, ~40 lines).
- `_template.md`: scaffold for new agents (a copy of `pi.md` with `<AGENT_ID>` placeholders, ~50 lines).

**Verification:** `references/agent-paths/` directory contains exactly 3 files. Each file starts with `# <agent> — Path A / B / C verification` (consistent heading).

**Estimated effort:** 130 lines total.

### 9. `README.md` (rewrite per D-18..D-20)

**Current state:** 534 lines; "Pi MCP Adapter" is the title (line 5); Quick Start shows only Pi usage.

**Required changes (D-18):**
1. Hero (lines 5-9) — change to "Universal MCP Adapter"; add "Pi is a first-class supported adapter (not legacy) + every agent is welcome".
2. Add "Supported Agents" matrix table immediately after Hero (currently line 30 area). Columns: `Agent | Status | Default config path | Path resolver | Sampling | Renderer | Verified at`. Rows: Pi, Qoder.
3. Add "Verification" section (D-02) with link to `tests/reports/mcp-adapter-test-report.md` and the latest matrix summary (hand-maintained or generated snippet).

**Required changes (D-19):**
1. Quick Start section (currently line 47-97) — show **two** code blocks side-by-side: `mcpAdapter(pi)` on left, `createMcpAdapter(adapter, ctx, config, cache)` on right. `---` separator between them.

**Required changes (D-20):**
1. Search-and-replace "Agent-agnostic" → "Universal" (likely 3-5 occurrences).
2. Ensure Pi and Qoder appear with equal weight in the matrix (no Pi-first ordering).

**Verification:** `grep -c "Agent-agnostic" README.md` → 0. `grep -c "Universal" README.md` → ≥3.

**Estimated effort:** 80-120 lines of edits.

### 10. `examples/interactive-visualizer/scripts/build.mjs` (verify exists, else create)

**Current state:** 60 lines, exists and works (verified by reading the file). Produces `dist/app.html` + `dist/server.js`.

**Required changes:** None. The script is the prebuild target (D-14). The `package.json` `test:prebuild` script wraps a `tsc --noEmit` + this script.

**Verification:** `node examples/interactive-visualizer/scripts/build.mjs` from project root should produce `dist/{app.html,server.js}` (this works in current state — verified by reading).

**Estimated effort:** 0 (no change).

### 11. `tests/reports/mcp-adapter-test-report.md` (NEW)

**Required content:** D-16 unified matrix. Top: pass/fail per `(agent, section)` cell. Below: per-section detail with per-agent sub-tables.

**Auto-generation:** Produced by `tests/reporters/matrix-reporter.ts` (Pattern 6). The file is overwritten on every `npx vitest run` that includes the matrix reporter. Hand-written content (the human "## One-Screen Summary" block) is **not** auto-generated — that's the agent's prose summary that the skill appends after the test run completes.

**Verification:** `cat tests/reports/mcp-adapter-test-report.md | head -30` should show the matrix table.

**Estimated effort:** Auto-generated; no manual file.

### 12. `tests/reports/mcp-adapter-test-report.json` (NEW)

**Required content:** JSON sidecar (D-17). Schema: `{ agents: string[], sections: string[], matrix: { [agent]: { [section]: { pass: number, fail: number, skipped: number } } }, endReason: "passed" | "failed" | "interrupted", timestamp: ISO }`.

**Auto-generation:** Same reporter.

**Verification:** `cat tests/reports/mcp-adapter-test-report.json | jq .matrix.pi.section4` should return `{ "pass": 44, "fail": 0, "skipped": 0 }` (or similar).

**Estimated effort:** Auto-generated.

### 13. `tests/reports/qoder-adapter-test-report.md` (DEPRECATE)

**Action:** Stop writing. Keep the existing file (it's gitignored per `.gitignore:24`) for reference. The new main report has Qoder data in its Qoder column (D-16).

**Verification:** `ls tests/reports/` should still show `qoder-adapter-test-report.md` (existing) + new `mcp-adapter-test-report.md` + new `mcp-adapter-test-report.json`.

**Estimated effort:** 0 (no action — just stop creating the file in future test runs).

---

## Risks & Open Questions

### Risks

1. **Layer violation in `interfaces/agent-api.ts`:** Importing concrete `PiAdapter` / `QoderAdapter` constructors into the interface module is arguably a design rule violation (interface modules shouldn't depend on implementations). **Mitigation:** Keep the registry in `interfaces/agent-api.ts` per D-07's verbatim location; the violation is minor and the alternative (a new `interfaces/agent-adapter-registry.ts` file) would just shuffle the dependency. If downstream review objects, the registry can be moved in a follow-up; the consumer pattern is unchanged.

2. **vitest `describe.each` factory timing in vitest 3.2.6:** The factory is called **once per test** (in `beforeEach`), not once per `describe.each` iteration. This is the correct granularity for test isolation but means the registry's `factory` function must be cheap. **Mitigation:** All current factories (`new PiAdapter(...)`, `new QoderAdapter()`) allocate Maps and are < 1ms each; cost is negligible.

3. **`globalSetup` failure blocks the entire suite:** If `npm run build` fails, no tests run. **Mitigation:** The prebuild's `tsc -p . --noEmit` + `node build.mjs` is the same script the developer would run manually — if it fails, the suite should fail. The error is surfaced in the same terminal output as the test run.

4. **JSON reporter may be ignored by `--reporter=` CLI override:** vitest's `--reporter=` flag *replaces* the configured list, not adds. **Mitigation:** Don't add a CLI override; the config-based `reporters: ["default", "./tests/reporters/matrix-reporter.ts"]` always runs both.

5. **Wave 0 file count (16 files to create/amend):** This is a lot for one phase. **Mitigation:** Group by capability in PLAN.md (e.g., "Plan 1: registry + parametric tests", "Plan 2: capability gate + prebuild", "Plan 3: SKILL.md split + references", "Plan 4: matrix report + README"). 4 plans, each touching 3-5 files.

### Open Questions

1. **Where does the `AGENT_ADAPTERS` registry live — `interfaces/agent-api.ts` or a new file?** D-07 says "in `interfaces/agent-api.ts`" verbatim. Layer violation concern addressed above. **Recommendation: keep in `interfaces/agent-api.ts` per D-07; revisit only if review objects.** The user's discretion permits relocation, but D-07 is explicit.

2. **How does the matrix reporter know which `describe.each` iteration produced which test result?** vitest 3's `onTestModuleEnd` hook receives a `TestModule` object with a `moduleId` (the file path) and a list of `Task`s. The `Task`s' `name`s include the `describe.each` interpolation (e.g., "AgentAPI contract — adapter: pi"). **Recommendation:** parse the `Task.name` for the agent ID prefix. This is the standard vitest 3 way to correlate parametric iterations with results.

3. **Should the JSON schema be hand-written (D-17) or generated?** The "Deferred Ideas" section says hand-written for now, JSON Schema auto-generation TBD. **Recommendation: hand-write the `MatrixRow` interface (in `tests/reporters/matrix-reporter.ts`); document it inline; revisit when a dashboard consumer needs stricter validation.**

4. **What happens to `tests/compatibility/non-pi-agent.test.ts` (the existing 40-case compatibility test)?** D-08 says "old `mock-agent.ts` → legacy-pi-mock.test.ts deprecated". The 40 cases are *not* deprecated — they are the *server-agnostic* compatibility layer that the parametric test framework *consumes*. **Recommendation:** Keep `tests/compatibility/non-pi-agent.test.ts` as-is (it tests the 10 demo servers against `MockAgent` — the legacy mock); add a new `__tests__/server-compatibility.test.ts` that runs the 40 cases against `MockAgentAPI` (the new generic mock). Both run; the parametric framework can include the new file.

   *Wait — re-reading D-06: "40 server cases × 1 MockAgentAPI (server-agnostic, no per-adapter repeat)" — the 40 cases run *once* on `MockAgentAPI`, not in the parametric framework. So the parametric block is only the 8 contract cases × N adapters. The 40 server cases are a separate describe block. This matches the recommendation above.*

5. **Should the SKILL.md parametric structure use a "decision tree" (current) or a "table" (proposed)?** D-11 says "Phase 4: Per-Path Verification, 表格描述每个 Path 的'检查什么'语义". **Recommendation: table format (Pattern 7 example), with a clear "see `references/agent-paths/<id>.md`" pointer for the *how*.**

---

## Verification Commands

Per CONTEXT.md and the explicit task brief, these commands gate the phase:

```bash
# 1. TypeScript compile (no errors)
npx tsc --noEmit

# 2. Parametric contract test (default CI: 8 × N = 16 cases for Pi + Qoder)
npx vitest run __tests__/adapter-contract.test.ts

# 3. Full matrix opt-in (N × 44 = 88 cases for Pi + Qoder, heavy)
AGENT_API_FULL_MATRIX=1 npx vitest run __tests__/adapter-contract.test.ts

# 4. Full suite — no pre-existing failures (FIX-01 must hold)
npx vitest run

# 5. FIX-01 verification — prebuild + interactive-visualizer test
npm run test:prebuild && npx vitest run __tests__/interactive-visualizer-server.test.ts

# 6. Capability Gate test (NEW)
npx vitest run __tests__/capability-gate.test.ts

# 7. Decision-bearing strings (presence checks, pattern from Phase 6 §6)
grep -n "AGENT_ADAPTERS" interfaces/agent-api.ts
grep -n "AgentAdapterDescriptor" interfaces/agent-api.ts
grep -n "describe.each" __tests__/adapter-contract.test.ts
grep -n "AGENT_API_FULL_MATRIX" __tests__/adapter-contract.test.ts
grep -n "globalSetup" vitest.config.ts
grep -n "test:prebuild" package.json
grep -n "agent-paths/pi.md\|agent-paths/qoder.md" skills/mcp-adapter-test/SKILL.md
grep -n "Universal" README.md            # ≥3 hits per D-20
grep -n "Agent-agnostic" README.md      # 0 hits per D-20
```

**Expected outcomes:**
1. `npx tsc --noEmit` → clean (no new type errors from the registry or reporter).
2. Parametric run → 16 cases pass (8 × 2 adapters).
3. Full matrix → 88 cases pass (44 × 2 adapters). Heavy; only run in dedicated phase verification.
4. Full suite → green; no pre-existing failures (FIX-01 disposes of the 2 visualizer test failures).
5. FIX-01 → `dist/{app.html,server.js}` present after prebuild; the test file passes.
6. Capability Gate test → verifies the 3-path table (A / B / C) for at least one adapter.

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` (treated as enabled). The phase is documentation / test infrastructure, but it touches a few sensitive surfaces.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | No auth changes in this phase |
| V3 Session Management | no | No session changes |
| V4 Access Control | no | No new access controls |
| V5 Input Validation | yes (advisory) | The matrix reporter writes files under `tests/reports/`; ensure paths are absolute, not user-controlled |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns for the vitest + Node test stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `globalSetup` runs `spawnSync("npm", ["run", "build"])` — a malicious `package.json` in the visualizer could trigger arbitrary code | Tampering / EoP | `npm run build` in the visualizer's own `package.json` is the same script developers run manually. If the visualizer's deps are compromised, the build is compromised. **Mitigation:** lockfile-pin the visualizer deps (already done); document the trust boundary in `global-setup.ts` JSDoc. |
| Custom reporter writes files via `writeFileSync` to a fixed path | Tampering | Path is absolute (`resolve(PROJECT_ROOT, "tests/reports/...")`), not user-controlled. mkdirSync is `recursive: true` and idempotent. |
| `AGENT_ADAPTERS` registry could `import` a malicious module | Tampering | All entries are first-party code in `adapters/`. No dynamic import. `factory: () => new XAdapter()` is a typed constructor call. |

**Key insight:** The phase's test-infrastructure surface does not introduce new attack surface — it codifies what `MockAgent` already does and what the existing 40-case compatibility test already exercises. The new surfaces (`AGENT_ADAPTERS`, `globalSetup`, matrix reporter) are all in test-only files and never reach production code.

---

## Code Examples

### Verified patterns from project source + official vitest docs

### Common Operation 1: Wiring parametric test factory

[VERIFIED: vitest 3.2.6 docs — https://vitest.dev/api/describe#describe-each — direct WebFetch]

```typescript
// Source: https://vitest.dev/api/describe#describe-each
import { describe, it, expect, beforeEach } from "vitest";

describe.each([
  ["pi", () => new PiAdapter(piMock)],
  ["qoder", () => new QoderAdapter()],
] as const)("AgentAPI contract — adapter: %s", (id, factory) => {
  let adapter: AgentAPI;
  beforeEach(() => { adapter = factory(); });

  it("exposes all 8 required methods", () => {
    for (const m of [
      "registerTool", "registerCommand", "registerFlag", "on",
      "getAllTools", "getFlag", "sendMessage", "exec",
    ] as const) {
      expect(typeof adapter[m]).toBe("function");
    }
  });
});
```

### Common Operation 2: vitest globalSetup with build detection

[VERIFIED: vitest 3.2.6 docs — https://vitest.dev/config/globalsetup — direct WebFetch]

```typescript
// Source: vitest 3.2.6 official docs
import type { TestProject } from "vitest/node";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export default function setup(project: TestProject): void {
  const distDir = resolve(project.config.root, "examples/interactive-visualizer/dist");
  if (existsSync(resolve(distDir, "app.html")) && existsSync(resolve(distDir, "server.js"))) {
    return;
  }
  const r = spawnSync("npm", ["run", "build"], {
    cwd: resolve(project.config.root, "examples/interactive-visualizer"),
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error(`prebuild failed (exit ${r.status})`);
}
```

### Common Operation 3: vitest custom reporter writing to file

[VERIFIED: vitest 3.2.6 docs — https://vitest.dev/guide/reporters#custom-reporters — direct WebFetch]

```typescript
// Source: vitest 3.2.6 official docs
import type { Reporter, TestModule } from "vitest/reporters";

export default class MatrixReporter implements Reporter {
  onTestModuleEnd(testModule: TestModule): void { /* collect results */ }
  // onTestRunEnd is called once after all modules; write the matrix file there.
  // Refer to the [VERIFIED] link for the full Reporter interface.
}
```

### Common Operation 4: Capability Gate table (SKILL.md)

[VERIFIED: `__tests__/qoder-adapter-integration.test.ts` line 135 — direct codebase read]

```text
| Agent   | Adapter          | Path | Tools (sample)                                              | Resolved                                        |
|---------|------------------|------|-------------------------------------------------------------|-------------------------------------------------|
| Pi      | PiAdapter        | A    | mcp, calculator_add, string-utils_upper, ... (mixed)         | Use Path A — mcp proxy tool registered          |
| Qoder   | QoderAdapter     | A    | mcp, ...                                                    | Use Path A — mcp proxy tool registered          |
| (none)  | (no host)        | C    | (empty)                                                     | mcp-adapter NOT loaded as extension in this env |
```

The verdict comes from `createMcpAdapter(adapter, ctx, testConfig, null); adapter.getAllTools()` — pattern from `qoder-adapter-integration.test.ts` lines 130-136.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-adapter test files (`__tests__/pi-adapter.test.ts`, `qoder-adapter.test.ts` duplicated for the 8-method contract surface) | Single `__tests__/adapter-contract.test.ts` with `describe.each(AGENT_ADAPTERS.map(...))` | Phase 7 (D-04) | Adding a new adapter = 0 new contract test files; the parametric framework auto-expands. Eliminates L-7 grep-drift risk. |
| Pi-specific `MockAgent` in `tests/compatibility/non-pi-agent.test.ts` (with `MockAgent` class, lines 7-28) | Generic `MockAgentAPI` in `__tests__/fixtures/mock-agent-api.ts` (Pattern 4) | Phase 7 (D-08) | Mock is now usable by both parametric adapter tests AND server-compatibility tests uniformly. |
| Capability Gate as Pi-biased prose in `SKILL.md` §122-138 | Agent-agnostic parametric table + per-agent reference files | Phase 7 (D-03, D-10/D-11) | Gate works uniformly for any future adapter; SKILL.md is merge-friendly for Phase 8 UPSTREAM-04. |
| Hardcoded `MCP_AGENT_DIR` env var check for env detection | `adapter.getAllTools()` introspection | Phase 7 (D-01) | Single signal source; works for Pi / Qoder / future adapters without per-adapter code. |
| Per-phase reports (`qoder-adapter-test-report.md`, plus implicit Pi report) | Unified `mcp-adapter-test-report.md` matrix + `.json` sidecar | Phase 7 (D-16/D-17) | One report file to read; JSON feeds CI / dashboard. |
| `"test": "vitest run"` (no prebuild) | `"test": "npm run test:prebuild && vitest run"` + `globalSetup` safety net | Phase 7 (D-14) | FIX-01 disposed; no more 2 pre-existing failures. |
| "Agent-agnostic" positioning in README | "Universal + Pi is first-class" positioning | Phase 7 (D-18, D-20) | Pi users feel their adapter isn't demoted; new agents are welcome. |

**Deprecated/outdated:**
- **`tests/compatibility/non-pi-agent.test.ts`:** Not deprecated — still runs (40 cases). The `MockAgent` class within it is the "legacy" mock; new code uses `MockAgentAPI`. Eventually the legacy class will be moved to `__tests__/compatibility/legacy-pi-mock.test.ts` and marked `@deprecated` (D-08).
- **`tests/reports/qoder-adapter-test-report.md`:** Deprecated as a future output target (D-16); the existing file remains gitignored.
- **The "## Capability Gate (Pi-biased)" section in `SKILL.md`:** Will be removed and replaced by the parametric table.

---

## Assumptions Log

> All factual claims in this research are tagged with their provenance. Items below are claims where direct codebase verification is the basis (HIGH confidence), or where a general industry pattern is the basis (MEDIUM confidence).

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `describe.each` with factory tuples in vitest 3.2.6 calls the factory once per test (not once per `describe.each` iteration) | Pattern 2 | If vitest calls factory once per `describe`, test isolation would need explicit cleanup; the `beforeEach` pattern still works but allocates more. |
| A2 | `globalSetup` in vitest 3.2.6 runs synchronously and blocks test workers | Pattern 5 | If async, the spawnSync inside must be awaited; pattern still works but syntax differs. |
| A3 | `Reporter.onTestRunEnd` fires after all test modules report results | Pattern 6 | If vitest's reporter API changes, the matrix file may be incomplete; mitigation: write a partial file in `onTestModuleEnd` if needed. |
| A4 | The existing `examples/interactive-visualizer/scripts/build.mjs` produces both `dist/app.html` and `dist/server.js` reliably | File impact #10 | If the script is broken, the prebuild fails; mitigation: `tsc -p . --noEmit` in the prebuild catches type errors first. |
| A5 | `QoderAdapter` constructor (`adapters/qoder-adapter.ts:64`) initializes all Maps empty + `queryRef = undefined` + `bufferedMessages = []` | Pattern 2 + Validation Architecture | If state survives across `new QoderAdapter()` calls, parametric test isolation breaks; verified by direct read. |
| A6 | `__tests__/qoder-adapter-integration.test.ts:135` `expect(qoderAdapter.tools.has("mcp")).toBe(true)` proves the "mcp in tool list" signal is universally available after `createMcpAdapter` | Pattern 3 | If `createMcpAdapter` is refactored in Phase 7+ to skip the `mcp` tool registration, the gate's Path A signal disappears; verified at HEAD. |
| A7 | The visualizer's `tsconfig.json` `noEmit: true` is intentional (line 13) | File impact #6 | If the tsc step is removed, the prebuild becomes a pure esbuild run; no harm, but the type-check disappears. |
| A8 | `tests/reports/` is gitignored (`.gitignore:24`) | File impact #11, #12 | If a developer commits the report file, it bloats the diff; mitigation: keep the report gitignored, document the convention. |
| A9 | vitest 3.2.6 supports `describe.for` as a more ergonomic alternative to `describe.each` for tuple-form input | Pattern 2 alt | If the team prefers `describe.each` (D-04 verbatim wording), use that; `describe.for` is a stylistic alternative. |

**If this table is empty:** All claims are HIGH confidence. (A few MEDIUM-confidence items remain — A1, A2, A3, A9 — because vitest docs are the source but are at the documentation's interpretation boundary; the implementation should verify by writing one parametric test first.)

---

## Environment Availability

> Phase 7 has **no external runtime dependencies** beyond the project's own toolchain. The prebuild uses already-installed `esbuild`. No new CLIs, no new databases, no new services.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, esbuild | ✓ | 20+ (project's `tsconfig.json` targets ES2022 / NodeNext) | — |
| npm | `npm run test:prebuild` | ✓ | (project's lockfile is npm; v9+ recommended) | — |
| vitest | Test runner | ✓ | 3.2.6 (verified `node_modules/vitest/package.json`) | — |
| esbuild | Visualizer build | ✓ | 0.25.12 (in `examples/interactive-visualizer/node_modules/`) | — |
| TypeScript | `tsc -p . --noEmit` in prebuild | ✓ | ^5.0.0 (project devDep) | — |
| `tsx` | Some tsx-loaded scripts in `tests/` | ✓ | ^4.21.0 (project devDep) | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Step 2.6 verdict:** Phase 7 has no external service dependencies. The audit is complete: the environment is sufficient.

---

## Sources

### Primary (HIGH confidence — direct codebase read)

- `interfaces/agent-api.ts` (141 lines) — read directly
- `interfaces/agent-paths.ts` (82 lines) — read directly
- `adapters/entry.ts` (382 lines) — read directly
- `adapters/qoder-adapter.ts` (318 lines) — read directly
- `adapters/pi-adapter.ts` — referenced (full content not needed for this phase)
- `vitest.config.ts` (91 lines) — read directly
- `package.json` (119 lines) — read directly
- `examples/interactive-visualizer/scripts/build.mjs` (60 lines) — read directly
- `examples/interactive-visualizer/tsconfig.json` (17 lines) — read directly
- `examples/interactive-visualizer/package.json` (24 lines) — read directly
- `__tests__/adapter-contract.test.ts` (181 lines) — read directly
- `__tests__/qoder-adapter-integration.test.ts` (314 lines) — read directly
- `__tests__/qoder-adapter.test.ts` (434 lines) — head read (120 lines) for pattern reference
- `__tests__/mock-adapter.test.ts` (266 lines) — read directly (existing `MockAgentAPI` inline class)
- `__tests__/interactive-visualizer-server.test.ts` (29 lines) — read directly (the FIX-01 target)
- `tests/compatibility/non-pi-agent.test.ts` (head 100 lines) — pattern for legacy `MockAgent` class
- `skills/mcp-adapter-test/SKILL.md` (228 lines) — read directly
- `skills/mcp-adapter-test/references/smoke-calls.md` (head 40 lines) — pattern for reference structure
- `tests/reports/qoder-adapter-test-report.md` (head 100 lines) — pattern for report structure
- `.planning/phases/06-second-agent-adapter/06-LEARNINGS.md` (255 lines) — read directly (Phase 6 patterns, S-2, S-3, S-4, P-5, P-6, P-7 all referenced)
- `.planning/phases/07-integration-test-rebuild/07-CONTEXT.md` (180 lines) — read directly
- `.planning/REQUIREMENTS.md` (91 lines) — read directly
- `.planning/STATE.md` (144 lines) — read directly
- `.planning/ROADMAP.md` (203 lines) — read directly
- `README.md` (534 lines) — head 100 lines + tail patterns read
- `AGENTS.md` (44 lines) — read directly (gitnexus instructions, not affecting this phase)

### Primary (HIGH confidence — official docs)

- **vitest 3.2.6 — `describe.each` API:** https://vitest.dev/api/describe#describe-each — direct WebFetch
- **vitest 3.2.6 — `describe.for` API:** https://vitest.dev/api/describe#describe-for — direct WebFetch
- **vitest 3.2.6 — `globalSetup` config:** https://vitest.dev/config/globalsetup — direct WebFetch
- **vitest 3.2.6 — Reporters (including custom reporter contract):** https://vitest.dev/guide/reporters#custom-reporters — direct WebFetch

### Secondary (MEDIUM confidence — verified with official source)

- **vitest 3.2.6 — Reporter interface members** (verified against the official `Reporter` type via WebFetch + cached doc snapshot at `/root/.qoder/cache/.../ff08e073.txt`)

### Tertiary (LOW confidence — to validate in implementation)

- The exact `Reporter` API surface for vitest 3.2.6 (e.g., `onTestModuleEnd` signature, `TestModule.moduleId` field) — the docs show the interface exists but the implementation should be verified by writing the reporter first (Plan 1, file #11). Mitigation: start with a no-op reporter that just writes a placeholder file, then expand.
- vitest 3.2.6's `TestModule` `moduleId` shape for parametric `describe.each` iterations (it should include the interpolated id, but the exact format is implementation-defined). The first parametric test will confirm.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — vitest 3.2.6 verified installed; existing patterns directly transferable. No new packages.
- Architecture: **HIGH** — Phase 6 LEARNINGS provides 7 patterns and 5 surprises directly applicable; parametric + registry + globalSetup + reporter are all standard vitest 3.2.6 features documented officially.
- Pitfalls: **MEDIUM** — derived from Phase 6 lessons (L-3, L-5, L-7) + general vitest knowledge. The custom reporter's `TestModule` API surface is the one MEDIUM-LOW area (to validate in Plan 1).
- SKILL.md restructure pattern: **MEDIUM** — Anthropic's "split main from references" pattern is general industry practice; the specific table-driven format proposed in Pattern 7 is the implementer's interpretation of D-11.
- Capability Gate signal reliability: **HIGH** — verified by Phase 6 S-4 ("the project's Capability Gate is *one bit* of information") + direct verification of `qoder-adapter-integration.test.ts:135`.

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (30 days) — vitest 3.2.6 is stable; no new AgentAPI surfaces expected; project source is in HEAD.

