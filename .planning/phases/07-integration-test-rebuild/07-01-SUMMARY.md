---
phase: 07-integration-test-rebuild
plan: 07-01
subsystem: test-framework
tags: [registry, parametric-tests, mock, deprecation, capability-gate]

requires:
  - phase: 06-second-agent-adapter
    reason: "QoderAdapter factory + PiAdapter pass-through shape are prerequisites for AGENT_ADAPTERS descriptors"

provides:
  - "AGENT_ADAPTERS: AgentAdapterDescriptor[] single source of truth (D-07)"
  - "MockAgentAPI generic fixture for AgentAPI tests (D-08)"
  - "describe.each parametric framework over AGENT_ADAPTERS (D-04/D-09)"

affects:
  - phase: 07-02
    reason: "Capability Gate and __tests__/capability-gate.test.ts will iterate AGENT_ADAPTERS"
  - phase: 07-04
    reason: "README adapter matrix will render AGENT_ADAPTERS for the documentation table"

tech-stack:
  added: []
  patterns:
    - "Static adapter registry iterated by describe.each for parametric contract tests"
    - "Generic in-memory MockAgentAPI fixture with Map-backed tool storage"
    - "Deprecated legacy mock preserved in __tests__/compatibility/ as a single smoke test"

key-files:
  created:
    - path: __tests__/fixtures/mock-agent-api.ts
      role: "Generic AgentAPI mock fixture (replaces Pi-coupled MockAgent)"
    - path: __tests__/compatibility/legacy-pi-mock.test.ts
      role: "Deprecated Pi-coupled MockAgent, single smoke test only"
  modified:
    - path: interfaces/agent-api.ts
      role: "Adds AgentAdapterDescriptor interface + AGENT_ADAPTERS registry; Pi factory in-memory placeholder"
    - path: __tests__/adapter-contract.test.ts
      role: "Rewritten as describe.each parametric contract framework over AGENT_ADAPTERS"

decisions:
  - id: D-07
    summary: "AGENT_ADAPTERS: AgentAdapterDescriptor[] in interfaces/agent-api.ts as single source of truth"
  - id: D-08
    summary: "Generic MockAgentAPI in __tests__/fixtures/ replaces Pi-coupled MockAgent; legacy mock moved + deprecated"
  - id: D-09
    summary: "describe.each over AGENT_ADAPTERS replaces hand-rolled Pi/Qoder duplicate describe blocks"
  - id: dev-pi-factory-store
    summary: "AGENT_ADAPTERS.pi.factory wraps PiAdapter with a minimal in-memory ExtensionAPI placeholder (toolStore, flagStore) so the parametric Test 2 can observe register→read-back round-trips without a live Pi runtime"

metrics:
  duration: "~25 minutes (across prior context window + this continuation)"
  completed: 2026-06-17
  tasks-completed: 3
  files-created: 2
  files-modified: 2
  tests-added: 17
  commits:
    - hash: 3e4374b
      message: "feat(07-01): add AgentAdapterDescriptor + AGENT_ADAPTERS static registry"
    - hash: 3a025e8
      message: "feat(07-01): add generic MockAgentAPI fixture (D-08)"
    - hash: ef466d9
      message: "feat(07-01): parametric adapter contract test + deprecated legacy mock"
---

# Phase 07 Plan 01: Adapter Registry + Parametric Test Framework Summary

Introduces `AgentAdapterDescriptor` + `AGENT_ADAPTERS` static registry (D-07), a generic `MockAgentAPI` fixture (D-08), and a `describe.each` parametric contract framework (D-09) that runs the AgentAPI contract against every registered adapter. The previous Pi-coupled `MockAgent` is preserved as a deprecated single-test compatibility shim under `__tests__/compatibility/`.

## Tasks

| # | Name                                                  | Commit   | Status |
| - | ----------------------------------------------------- | -------- | ------ |
| 1 | Add `AgentAdapterDescriptor` + `AGENT_ADAPTERS`       | `3e4374b` | ✅     |
| 2 | Generic `MockAgentAPI` fixture                        | `3a025e8` | ✅     |
| 3 | Parametric `adapter-contract.test.ts` + legacy mock   | `ef466d9` | ✅     |

## Task 1 — `AgentAdapterDescriptor` + `AGENT_ADAPTERS`

`interfaces/agent-api.ts` gained:

- `AgentAdapterDescriptor` interface (`id`, `displayName`, `factory`, `resolverFactory`, `envHints`, `capabilities`)
- 4 imports: `QoderAdapter`, `createQoderResolver`, `createPiResolver`, plus `ToolRegistration` for Pi factory typing
- `AGENT_ADAPTERS: AgentAdapterDescriptor[]` with `pi` and `qoder` descriptors

Acceptance verified:

- `AGENT_ADAPTERS` length = 2 (one per descriptor)
- `AgentAdapterDescriptor` references in file = 2 (interface + array typing)
- `id: "pi"` = 1, `id: "qoder"` = 1
- `npx tsc --noEmit` exits 0
- Pre-existing test files (`mock-adapter.test.ts`, `non-pi-agent.test.ts`) still pass (56/56)

## Task 2 — Generic `MockAgentAPI` fixture

New file `__tests__/fixtures/mock-agent-api.ts` (82 lines):

- `MockAgentAPI` class implements `AgentAPI` (all 8 methods)
- Tool storage: `Map<string, ToolRegistration>` (consistent with `QoderAdapter`)
- Flag storage: `Map<string, string | undefined>` returning `undefined` for unregistered flags
- `loadMcpConfig()` returns `{ servers: [] }` placeholder
- Other methods are deterministic no-ops or echo-backs

Acceptance verified:

- File exists, single `MockAgentAPI` class export
- `grep -cE "Pi|pi-"` = 0 (no Pi-coupled leakage)
- `npx tsc --noEmit` exits 0
- Pre-existing tests still pass

## Task 3 — Parametric contract test + deprecated legacy mock

### New `__tests__/adapter-contract.test.ts` (71 lines, down from 128)

- `describe.each(AGENT_ADAPTERS.map((a) => [a.id, a.factory]))` runs the
  same contract tests against every registered adapter
- 6 per-adapter assertions: 8-method surface, `registerTool` round-trip,
  `registerCommand`, `registerFlag`, `getAllTools`, `getFlag`,
  `sendMessage`, `exec`
- 4 cross-cutting assertions in a separate `describe`: `MockAgentAPI`
  surface, `AgentContext` shape, `UISystem` shape, `loadMcpConfig`
  shape (D-06)

Test count: 16 tests, 13ms total — Pi and Qoder are exercised in
isolation via each descriptor's `factory`.

### New `__tests__/compatibility/legacy-pi-mock.test.ts` (76 lines)

- Preserves the Pi-coupled `MockAgent` class previously living in
  `tests/compatibility/non-pi-agent.test.ts`
- Class marked `@deprecated`; JSDoc points to
  `__tests__/fixtures/mock-agent-api.ts` as the replacement
- Single trivial smoke test verifies the class is still constructible
  for any consumer that imports the old symbol

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's MockAgentAPI JSDoc contained "Pi-specific" which conflicted with the no-Pi-pattern acceptance check (Task 2)**

- **Found during:** Task 2 acceptance verification
- **Issue:** The plan prescribed JSDoc phrasing "Pi-specific MockAgent"
  but the acceptance grep required `grep -cE "Pi|pi-"` = 0 in the new
  fixture.
- **Fix:** Reworded the JSDoc to "agent-coupled MockAgent fixture",
  "registered adapter (e.g. Qoder)", and similar phrasing that captures
  the same intent (D-08) without leaking the forbidden pattern.
- **Files modified:** `__tests__/fixtures/mock-agent-api.ts`
- **Commit:** `3a025e8`
- **Reference:** Phase 06 L-7 — when plan content conflicts with its
  acceptance grep, prefer the acceptance criterion and rewrite the
  prose.

**2. [Rule 1 — Bug] Plan's `AGENT_ADAPTERS.pi.factory` provided a bare no-op `ExtensionAPI` stub that cannot satisfy the parametric Test 2 (Task 3)**

- **Found during:** Task 3 acceptance verification — first
  `vitest run` reported
  `AgentAPI contract — adapter: pi > Test 2: expected false to be true`.
- **Issue:** The plan's `registerTool: () => {}` /
  `getAllTools: () => []` mock is stateless, so the round-trip
  assertion (`tools.some(t => t.name === "x")`) fails for the `pi`
  adapter while passing for `qoder`. A bare no-op mock is not
  consistent with the AgentAPI contract that
  "registerTool must be observable through getAllTools".
- **Fix:** Wrapped the Pi factory in a closure-backed in-memory
  `ExtensionAPI` placeholder: `toolStore: ToolRegistration[]`,
  `flagStore: Map<string, string | undefined>`. `registerTool` pushes
  into the store; `getAllTools` maps the store back; `registerFlag`
  records presence; `getFlag` reads it back. Other methods stay as
  deterministic no-ops / echoes.
- **Files modified:** `interfaces/agent-api.ts`
- **Commit:** `ef466d9`
- **Reference:** Per D-04 the parametric test must run *the same
  contract* against every adapter; a per-adapter factory that
  silently swallows half the contract would invalidate the
  parametric guarantee.

### Out-of-scope discoveries (deferred)

See `.planning/phases/07-integration-test-rebuild/deferred-items.md`:

- `__tests__/interactive-visualizer-server.test.ts` reports two
  pre-existing `ENOENT` failures (`dist/app.html`, `dist/server.js`)
  unrelated to Phase 07. Verified pre-existing via `git stash`
  baseline. Action deferred to a later plan (07-02 / 07-04) or a
  manual build step that materialises the visualizer dist.

## Auth Gates

None — plan is fully local, no external services or secrets required.

## Verification

### TypeScript

```text
$ npx tsc --noEmit
(exit 0, no output)
```

### Per-file vitest runs

```text
$ npx vitest run __tests__/adapter-contract.test.ts
✓ __tests__/adapter-contract.test.ts (16 tests) 13ms
Test Files  1 passed (1)
Tests       16 passed (16)

$ npx vitest run __tests__/compatibility/legacy-pi-mock.test.ts
✓ __tests__/compatibility/legacy-pi-mock.test.ts (1 test) 3ms
Test Files  1 passed (1)
Tests       1 passed (1)

$ npx vitest run __tests__/mock-adapter.test.ts tests/compatibility/non-pi-agent.test.ts
✓ __tests__/mock-adapter.test.ts (12 tests) 12ms
✓ tests/compatibility/non-pi-agent.test.ts (44 tests) 23ms
Test Files  2 passed (2)
Tests       56 passed (56)
```

### Full suite (informational only)

```text
Test Files  1 failed | 52 passed (53)
Tests       2 failed | 547 passed | 10 skipped (559)
```

The two failures are the pre-existing
`interactive-visualizer-server.test.ts` ENOENTs documented above and
are not caused by Phase 07.

### Plan acceptance grep checks

| Check                                                           | Result |
| --------------------------------------------------------------- | ------ |
| `npx vitest run __tests__/adapter-contract.test.ts` ≥ 12 tests   | 16 ✅  |
| `grep -c "describe.each" __tests__/adapter-contract.test.ts` ≥ 1 | 2 ✅   |
| `grep -c "AGENT_ADAPTERS" __tests__/adapter-contract.test.ts` ≥ 1 | 4 ✅  |
| `grep -c "MockAgentAPI" __tests__/adapter-contract.test.ts` ≥ 1 | 6 ✅   |
| `test -f __tests__/compatibility/legacy-pi-mock.test.ts`        | EXISTS ✅ |
| `grep -c "@deprecated" __tests__/compatibility/legacy-pi-mock.test.ts` ≥ 1 | 2 ✅ |
| `grep -cE "Pi\|pi-" __tests__/fixtures/mock-agent-api.ts` = 0   | 0 ✅   |

## Self-Check

### Files exist

```text
$ [ -f interfaces/agent-api.ts ] && echo OK || echo MISSING
OK
$ [ -f __tests__/fixtures/mock-agent-api.ts ] && echo OK || echo MISSING
OK
$ [ -f __tests__/adapter-contract.test.ts ] && echo OK || echo MISSING
OK
$ [ -f __tests__/compatibility/legacy-pi-mock.test.ts ] && echo OK || echo MISSING
OK
```

### Commits exist

```text
$ git log --oneline | grep -E "3e4374b|3a025e8|ef466d9"
3e4374b feat(07-01): add AgentAdapterDescriptor + AGENT_ADAPTERS static registry
3a025e8 feat(07-01): add generic MockAgentAPI fixture (D-08)
ef466d9 feat(07-01): parametric adapter contract test + deprecated legacy mock
```

All three commits present on `v1.0` branch.

## Threat Flags

| Flag                | File                                      | Description |
| ------------------- | ----------------------------------------- | ----------- |
| threat_flag: trust-boundary-import | `interfaces/agent-api.ts`        | Per D-07 the registry imports concrete adapters (`PiAdapter`, `QoderAdapter`, `createPiResolver`, `createQoderResolver`). This is an intentional, plan-approved layering acceptance called out in threat model entry T-07-01 — the registry is the *only* layer allowed to know about both adapters. Any future change that pulls adapter imports into another `interfaces/*` or `tests/*` file should be re-evaluated against T-07-01. |

## Success Criteria

- [x] All tasks executed
- [x] Each task committed individually (3 atomic commits)
- [x] SUMMARY.md created in plan directory
- [ ] STATE.md updated — **delegated to orchestrator** per user instruction
- [ ] ROADMAP.md updated — **delegated to orchestrator** per user instruction
