---
phase: 7
phase_name: "Integration Test Rebuild"
project: "mcp-adapter"
generated: "2026-06-17T17:50:00+08:00"
counts:
  decisions: 9
  lessons: 5
  patterns: 7
  surprises: 4
missing_artifacts:
  - "07-UAT.md"
  - "STATE.md (optional artifact not used for this extraction)"
---

# Phase 7 Learnings: Integration Test Rebuild

## Decisions

### D-07 — `AGENT_ADAPTERS` static registry as single source of truth
A new `AgentAdapterDescriptor` interface (`id`, `displayName`, `factory`, `resolverFactory`, `envHints`, `capabilities`) plus `AGENT_ADAPTERS: AgentAdapterDescriptor[]` constant live in `interfaces/agent-api.ts`. The registry is the *only* layer that imports concrete adapters (`PiAdapter`, `QoderAdapter`, `createPiResolver`, `createQoderResolver`); downstream code (parametric tests, Capability Gate, MatrixReporter) consumes descriptors without coupling to a specific adapter.

**Rationale:** Enables single-file parametric testing (`describe.each`) over all adapters, agent-agnostic UI, and a controlled trust boundary (threat model entry T-07-01). Adding a new adapter = add one descriptor.
**Source:** 07-01-SUMMARY.md, 07-VERIFICATION.md (D-07 row)

---

### D-08 — Generic `MockAgentAPI` fixture replaces Pi-coupled `MockAgent`
A generic `MockAgentAPI` class in `__tests__/fixtures/mock-agent-api.ts` implements all 8 `AgentAPI` methods with Map-backed `toolStore` and `flagStore`. The old Pi-coupled `MockAgent` is moved to `__tests__/compatibility/legacy-pi-mock.test.ts` with `@deprecated` JSDoc pointing to the replacement.

**Rationale:** Lets the parametric test framework exercise the AgentAPI contract without spinning up a real Pi runtime; legacy consumers still construct the old class through a single smoke test.
**Source:** 07-01-SUMMARY.md, 07-VERIFICATION.md (D-08 row)

---

### D-09 — `describe.each(AGENT_ADAPTERS)` replaces per-adapter duplicate suites
`__tests__/adapter-contract.test.ts` rewritten from 128 lines of hand-rolled Pi + Qoder duplicate describes into 71 lines driven by `describe.each(AGENT_ADAPTERS.map((a) => [a.id, a.factory]))`. 8 methods × 2 adapters = 16 tests pass in 13ms.

**Rationale:** Adding a new adapter no longer requires duplicating describe blocks; the parametric framework picks it up automatically.
**Source:** 07-01-SUMMARY.md, 07-VERIFICATION.md (D-09 row)

---

### D-10 — `mcp-adapter-test` skill: short parametric main + per-agent references
Main `skills/mcp-adapter-test/SKILL.md` rewritten from 228 → 148 lines (≤ 160-line ceiling). Agent-specific Path A/B/C HOW content extracted to `references/agent-paths/{pi,qoder,_template}.md` (29-30 lines each).

**Rationale:** Keeps the main file scannable; per-agent content can grow without bloating the canonical doc. Sets up Phase 8 UPSTREAM-04 merge-friendly structure.
**Source:** 07-03-SUMMARY.md, 07-VERIFICATION.md (D-10 row)

---

### D-11 — Phase 4 renamed "Per-Path Verification" with parametric table
Old §122-138 Pi-biased prose removed; replaced by a parametric table (`mcp` in tool list? + `^<server>_` prefix? → Path A/B/C). Capability Gate extracted as Step 0 (D-03).

**Rationale:** Path classification is now purely a function of two observable signals (`getAllTools()` shape + server tool naming); the prose that hard-coded Pi examples is no longer reachable.
**Source:** 07-03-SUMMARY.md, 07-VERIFICATION.md (D-11 row)

---

### D-14/D-15 — `test:prebuild` npm script + `test` chain disposes FIX-01
Added `"test:prebuild": "cd examples/interactive-visualizer && npm run build"` to `package.json`. The `"test"` script chains it: `"test": "npm run test:prebuild && vitest run"`. This is the primary build mechanism for the pre-existing `interactive-visualizer-server.test.ts` ENOENT failures.

**Rationale:** `npm test` (the CI path most users run) always succeeds because the dist/ artifacts materialise before vitest starts. Direct `npx vitest run <file>` invocations require pre-running `npm run test:prebuild` first.
**Source:** 07-02-SUMMARY.md, 07-VERIFICATION.md (D-14, D-15 rows)

---

### D-17 — Custom `MatrixReporter` writes both Markdown + JSON sidecar
`tests/reporters/matrix-reporter.ts` (178 lines) implements vitest 3.2.6's `Reporter` interface using `onTestModuleEnd` (collection) and `onTestRunEnd` (write). Section classification is regex over file path; agent classification is regex over `test.fullName` (picks up the `describe.each` interpolation from D-09). Both `tests/reports/mcp-adapter-test-report.{md,json}` are written in a single `onTestRunEnd` pass.

**Rationale:** Auto-generates a unified agent × section matrix on every `npx vitest run`, no per-test instrumentation. Sidesteps the vitest 3.2.6 SSR race that bit `globalSetup` in 07-02.
**Source:** 07-04-SUMMARY.md, 07-VERIFICATION.md (D-17 row)

---

### D-18/D-19/D-20 — README: Universal hero + Pi-first-class + dual entry points
`README.md` rewritten: `# Universal MCP Adapter` hero, "Pi is a first-class supported adapter" positioning, `## Supported Agents` matrix (Pi + Qoder rows + Claude/Cursor/others bring-your-own row), dual `## Quick Start` (`mcpAdapter(pi)` for Pi users + `createMcpAdapter(adapter, ctx, config, cache)` universal), new `## Verification` section linking the live matrix report. Capital-A `Agent-agnostic` (0 instances) replaced with "Universal".

**Rationale:** External positioning reflects the new architectural reality — Pi is no longer the only first-class adapter; the universal entry point is the recommended path for new agents.
**Source:** 07-04-SUMMARY.md, 07-VERIFICATION.md (D-18, D-19, D-20 rows)

---

### D-21 — UPSTREAM-04 merge-friendly structure: new adapter = new file
Adding a new adapter no longer modifies `SKILL.md`. The authoring path is: copy `references/agent-paths/_template.md` → `<your-id>.md`, fill in Path A/B/C sections, add one row to the parametric table in `SKILL.md`'s "Agent-agnostic parametric structure" section. Main file untouched, which minimises upstream merge conflict surface.

**Rationale:** Phase 8 (Upstream Merge Conflict Resolution) requires that adapter additions live in per-file scope, not in a shared canonical doc. With this structure, future PRs against the main repo can land agent adapters as atomic single-file changes.
**Source:** 07-03-SUMMARY.md, 07-VERIFICATION.md (D-21 row)

---

## Lessons

### Vitest 3.2.6 has a known SSR race with `globalSetup`
**Lesson:** When `globalSetup` runs non-trivial work (child process, async build, or anything that touches `vite`'s internal SSR state), vitest 3.2.6 surfaces `Unhandled Error: ENOENT: mkdir '/tmp/<random>/ssr'` after `globalSetup` completes. This is reproducible across executor environments.

**Context:** Plan 07-02's success criterion #4 was to register `globalSetup: ["./tests/global-setup.ts"]` in `vitest.config.ts`. The race was observed on the first `npx vitest run` after adding the field. Workaround: move build orchestration to an npm script (`test:prebuild`) and chain it from `test`. The `tests/global-setup.ts` file is preserved as a safety net for when vitest 3.x fixes the race.
**Source:** 07-02-SUMMARY.md (Deviations §1), 07-VERIFICATION.md (Deviations §1)

---

### Plan content can conflict with its own acceptance grep
**Lesson:** If a plan's prose uses a phrase like "Pi-specific" but the plan's own acceptance criteria require `grep -cE "Pi|pi-"` to equal 0, the prose must be rewritten — the acceptance criterion wins.

**Context:** Plan 07-02 prescribed JSDoc phrasing "Pi-specific MockAgent" for `__tests__/fixtures/mock-agent-api.ts`, but Task 2's acceptance required zero Pi/pi- references in the same file. Resolution: reword the JSDoc to "agent-coupled MockAgent fixture" and "registered adapter (e.g. Qoder)".
**Source:** 07-01-SUMMARY.md (Auto-fixed Issues §1)

---

### Bare no-op factory mock breaks the parametric guarantee
**Lesson:** A factory whose `registerTool: () => {}` and `getAllTools: () => []` is stateless will silently swallow half the AgentAPI contract. The parametric round-trip test (`tools.some(t => t.name === "x")`) will pass for adapters backed by real storage (QoderAdapter) and fail for adapters backed by no-op stubs. The fix is to back every factory with a closure-scoped in-memory store.

**Context:** Plan 07-01 specified a Pi factory with bare no-op methods; the first `vitest run` reported `AgentAPI contract — adapter: pi > Test 2: expected false to be true`. Resolution: wrap the Pi factory's `ExtensionAPI` in a closure with `toolStore: ToolRegistration[]` and `flagStore: Map<string, string | undefined>`, then have `registerTool` push and `getAllTools` map back.
**Source:** 07-01-SUMMARY.md (Auto-fixed Issues §2)

---

### vitest 3.2.6 `Reporter.onTestRunEnd` takes 3 arguments, not 1
**Lesson:** The vitest 3.2.6 `Reporter` interface signature for `onTestRunEnd` is `(testModules, unhandledErrors, reason: "passed" | "interrupted" | "failed") => Awaitable<void>`, not the 1-arg form `({ reason?: string }) => void` shown in some illustrative code stubs. Implementing the wrong signature fails `npx tsc --noEmit`.

**Context:** Plan 07-04's code stub showed the 1-arg form (likely from an older vitest version). The matrix reporter needed the 3-arg form to walk `testModules.children.allTests()` and access the run end-reason for the report header.
**Source:** 07-04-SUMMARY.md (Issues Encountered)

---

### Plan coverage field can list items missing from the task list
**Lesson:** A plan's `<coverage>` field and `<tasks>` list can drift apart. When the user explicitly enumerates the must-haves in additional context, treat those as authoritative — add the missing tasks under Rule 2 (auto-add missing critical functionality).

**Context:** Plan 07-04's `<coverage>` listed D-12/D-13 (SKILL.md §5/§5B baseline-bound annotations) but the `<tasks>` list contained only Task 1 (matrix reporter) and Task 2 (README rewrite). The user additional context explicitly listed D-12/D-13 as part of the plan objective. Resolution: add as Task 3 (commit `457a647`).
**Source:** 07-04-SUMMARY.md (Deviations §1)

---

## Patterns

### Static adapter registry + `describe.each` parametric testing
**Pattern:** A single static `ADAPTERS: AdapterDescriptor[]` array, imported into every test file. Each test uses `describe.each(ADAPTERS.map(a => [a.id, a.factory]))` to run the same contract against every registered adapter. New adapters require zero test-file edits.

**When to use:** Whenever a system has multiple concrete implementations of the same interface and you want one canonical contract test rather than N duplicated suites. Pair with a `MockAdapter` for the case where no real adapter is wired.
**Source:** 07-01-SUMMARY.md (tech-stack.patterns), 07-VERIFICATION.md (key links)

---

### Generic `MockAdapter` with Map-backed tool/flag storage
**Pattern:** `MockAdapter` implements the same interface as the real adapters, with `Map<string, ToolRegistration>` for tools and `Map<string, string | undefined>` for flags. Methods like `registerTool` push into the store, `getAllTools` maps back, `getFlag` reads from the map. Other methods are deterministic no-ops or echo-backs.

**When to use:** Parametric test framework needs a generic mock that can round-trip state through the interface contract. Real adapters use the same Map shape (e.g. `QoderAdapter`), so the mock's invariants match production behaviour.
**Source:** 07-01-SUMMARY.md (Task 2)

---

### Main + per-agent reference skill structure
**Pattern:** A short parametric main `SKILL.md` (≤ 160 lines) describes the universal flow and links to `references/agent-paths/<id>.md` for agent-specific commands. Adding a new agent = copy `_template.md` → `<id>.md` + add one row to a parametric table in the main file. The main file's prose remains unchanged across adapter additions.

**When to use:** Skills, READMEs, or docs that need to describe a multi-target system (multiple agents, multiple platforms, multiple runtimes) where the universal "what" is shared but the "how" diverges per target. Especially valuable when upstream merge conflicts are a concern.
**Source:** 07-03-SUMMARY.md (patterns-established)

---

### Custom vitest Reporter via `onTestModuleEnd` (collect) + `onTestRunEnd` (write)
**Pattern:** Implement the vitest `Reporter` interface. `onTestModuleEnd(testModule)` walks `testModule.children.allTests()` recursively, accumulating `rows: MatrixRow[]` keyed by `(agent, section)`. `onTestRunEnd(testModules, unhandledErrors, reason)` writes both Markdown and JSON sidecars in one pass. All file I/O is deferred to `onTestRunEnd`, sidestepping SSR races that bit `globalSetup`.

**When to use:** Whenever you need a custom aggregated report (per-file, per-section, per-tag) auto-generated on every `vitest run` without modifying any test. Pairs well with `describe.each` (the agent id appears in `test.fullName`).
**Source:** 07-04-SUMMARY.md (tech-stack.patterns), 07-04-SUMMARY.md (patterns-established)

---

### Section-from-file-path + agent-from-`test.fullName` classification
**Pattern:** The Reporter classifies each test into `(agent, section)` buckets using two regex passes: (1) section = regex over the test file's `moduleId` (`capability-gate`, `adapter-contract`, `compatibility`, `proxy-modes`, `direct-tools`, `e2e-all-servers`, etc.); (2) agent = regex over `test.fullName` looking for `adapter: <id>` (the `describe.each` interpolation). Falls back to `"env"` for tests without an agent dimension.

**When to use:** Building any kind of per-target test dashboard where you can't or don't want to instrument individual tests with tags. The fullName regex picks up the agent id "for free" from any parametric framework.
**Source:** 07-04-SUMMARY.md (decisions: dev-section-from-file-path, dev-agent-from-fullName)

---

### Hardcoded reporter output paths
**Pattern:** The MatrixReporter resolves its output paths with `resolve(PROJECT_ROOT, "tests/reports/...")`. No user input, no env vars, no CLI flags. `mkdirSync({ recursive: true })` is idempotent.

**When to use:** Reporter outputs that should always land in a known location without configuration overhead. The hardcoded paths also satisfy path-traversal threat model constraints (T-07-12).
**Source:** 07-04-SUMMARY.md (decisions: dev-hardcoded-paths)

---

### `test:prebuild` + `test` chain as primary build mechanism
**Pattern:** A multi-package build (e.g. `examples/<name>/dist/`) materialised by a dedicated `test:prebuild` npm script, chained into the main `test` script: `"test": "npm run test:prebuild && vitest run"`. Tests that depend on the build run in the same `npm test` invocation; direct `npx vitest run <file>` requires `npm run test:prebuild` first.

**When to use:** When a test fixture depends on a build artefact (e.g. a bundled example app), but the build target lives in a sub-package that vitest shouldn't manage directly. Sidesteps the vitest 3.2.6 `globalSetup` SSR race.
**Source:** 07-02-SUMMARY.md (Artifacts), 07-02-SUMMARY.md (Trade-off)

---

## Surprises

### Vitest 3.2.6 SSR race with `globalSetup` is environmental
**What was surprising:** The race is *not* deterministic — it surfaced only in the executor's environment and on direct `npx vitest run` invocations. The same `globalSetup` config that races locally can pass in CI or in a different shell.

**Impact:** Plan 07-02's success criterion #4 (`globalSetup` field present in `vitest.config.ts`) had to be deviated away. The deviation is documented and the safety net file preserved; re-wiring depends on a future vitest 3.x SSR fix. CI users running `npm test` are unaffected; local users running `npx vitest run <file>` directly will need to pre-run `test:prebuild`.
**Source:** 07-02-SUMMARY.md (Deviation 1), 07-VERIFICATION.md (Deviations §1)

---

### Plan's `Agent-agnostic` replacement target missed lowercase variants
**What was surprising:** Plan 07-04 Edit 5 was strictly case-sensitive: replace `Agent-agnostic` (capital A) with `Universal`. The README had **zero** capital-A instances but 2 lowercase `agent-agnostic` instances (lines 45, 445) that the plan's exact grep target missed.

**Impact:** D-20's must-have + acceptance criterion (`grep "Agent-agnostic"` = 0) is satisfied, but the lowercase variants remain as cosmetic noise. Documented as a follow-up observation; not blocking.
**Source:** 07-04-SUMMARY.md (Deviations §2, within-scope observation)

---

### Plan 07-04's task list omitted D-12/D-13 work
**What was surprising:** The plan's `<coverage>` field listed D-12/D-13 (SKILL.md §5/§5B baseline-bound annotations) as in-scope, but the `<tasks>` list contained only Task 1 (matrix reporter) and Task 2 (README rewrite). The user's additional context explicitly listed D-12/D-13 as part of the plan objective, which is what surfaced the gap.

**Impact:** Auto-added as Task 3 (commit `457a647`). SKILL.md stayed at 148 lines because the annotations are one-line extensions of existing pass-criteria lines, not new paragraphs. Rule 2 deviation triggered.
**Source:** 07-04-SUMMARY.md (Deviations §1)

---

### Capability Gate's explicit Path C wording matters
**What was surprising:** "mcp-adapter NOT loaded as extension in this environment" is a deliberate, fixed string in `verdictFor()`. It's not paraphrased, not interpolated, not "mcp-adapter not found" or "mcp-adapter is not registered". The exact wording is part of the verdict contract that downstream tooling (e.g. a future dashboard or PR bot) can match against.

**Impact:** Tests assert `expect(v.resolved).toBe("mcp-adapter NOT loaded as extension in this environment")` — the exact string is part of the public contract. Future edits to that wording will need to update both `verdictFor()` and the test.
**Source:** 07-VERIFICATION.md (Truth 2, TEST-02)
