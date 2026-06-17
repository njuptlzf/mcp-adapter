# 07-02 SUMMARY — Capability Gate + FIX-01 Prebuild

**Plan:** 07-integration-test-rebuild / 07-02
**Status:** ✅ COMPLETE (with documented deviation)
**Duration:** ~10 min (across 2 executor sessions)

## Tasks Completed

| # | Task | Files | Commit |
|---|------|-------|--------|
| 1 | D-14/D-15 test:prebuild + globalSetup | `package.json`, `tests/global-setup.ts`, `vitest.config.ts` | `9da11fb` |
| 2 | D-01..D-03 Capability Gate test | `__tests__/capability-gate.test.ts` | `6b978f4` |
| 3 | FIX-01 disposition + deviation | `tests/global-setup.ts`, `vitest.config.ts` | `3021fb5` |

## Coverage

- **TEST-01** (Capability Gate runs FIRST): ✅ — `__tests__/capability-gate.test.ts` parametric over `AGENT_ADAPTERS`
- **TEST-02** (Gate reports verdict table): ✅ — `verdictFor()` covers Path A/B/C with explicit "mcp-adapter NOT loaded as extension in this environment" for Path C
- **FIX-01** (pre-existing visualizer failures): ✅ DISPOSED — `npm test` (chained `test:prebuild` + `vitest run`) → 0 pre-existing failures

## Verification (all PASS)

| Check | Command | Result |
|-------|---------|--------|
| Capability Gate | `npx vitest run __tests__/capability-gate.test.ts` | **4/4 passed** |
| Visualizer test (was 2 failures) | `npx vitest run __tests__/interactive-visualizer-server.test.ts` (after `npm run test:prebuild`) | **2/2 passed** |
| Prebuild script | `grep -c "test:prebuild" package.json` | ≥ 1 |
| Gate message | `grep -c "Capability Gate" __tests__/capability-gate.test.ts` | ≥ 1 |

## Deviations (1, Rule 1 — environment-driven)

### Deviation 1: Removed `globalSetup` from `vitest.config.ts` (per success_criteria #4)

**Original plan:** `vitest.config.ts` should have `globalSetup: ["./tests/global-setup.ts"]` registered.
**Actual:** `globalSetup` field removed; `test:prebuild` npm script is the primary build mechanism.

**Reason (Rule 1):** Vitest 3.2.6 has a known SSR race when `globalSetup` runs non-trivial work (child process or async build). The symptom is `Unhandled Error: ENOENT: mkdir '/tmp/<random>/ssr'` after `globalSetup` completes. This was reproducible in the executor's environment and on direct `npx vitest run` invocations.

**Trade-off:**
- `npm test` (the CI path, what most users run) — always succeeds because `test:prebuild` runs before `vitest run`
- `npx vitest run __tests__/interactive-visualizer-server.test.ts` directly — requires either prebuild via `npm run test:prebuild` first, or accepting the vitest SSR race
- `tests/global-setup.ts` file is retained as a safety net (no longer wired to vitest) — when vitest 3.x fixes the SSR race, re-add the `globalSetup: ["./tests/global-setup.ts"]` field to `vitest.config.ts`

**Acceptance:** FIX-01 disposition achieved via `test:prebuild` (the plan's primary intent), even though the secondary `globalSetup` safety net is not active in this vitest version.

## Artifacts Produced

| Symbol | Kind | Defined In | Exported |
|--------|------|------------|----------|
| `verdictFor` | function (internal) | `__tests__/capability-gate.test.ts` (NEW) | no |
| `Path` | type alias (internal) | `__tests__/capability-gate.test.ts` (NEW) | no |
| `GateVerdict` | interface (internal) | `__tests__/capability-gate.test.ts` (NEW) | no |
| `setup` | default export function | `tests/global-setup.ts` (NEW, unwired) | yes |
| `test:prebuild` | npm script | `package.json` (amend) | n/a |

## Files Modified

- `__tests__/capability-gate.test.ts` (NEW, 4 tests)
- `tests/global-setup.ts` (NEW, JSDoc documents deviation)
- `package.json` (added `test:prebuild`, `test` script chains it)
- `vitest.config.ts` (globalSetup removed per deviation)

## Per-Plan Verification Status

| success_criteria | Status |
|------------------|--------|
| 1. Gate test passes for every registered adapter + verdict table covers A/B/C | ✅ |
| 2. `package.json` `test` script invokes `test:prebuild` before `vitest run` | ✅ |
| 3. `tests/global-setup.ts` runs prebuild when dist/ missing | ✅ (file correct; not currently wired due to vitest race) |
| 4. `vitest.config.ts` has `globalSetup` field | ⚠️ **DEVIATED** — removed due to vitest 3.2.6 race |
| 5. visualizer test passes (2/2) | ✅ |

## Notes

- Plan 07-04 (next) modifies `vitest.config.ts` to add `reporters` field. The `globalSetup` removal leaves room for the `reporters` addition without conflict.
- Deviation should be revisited when vitest 3.x fixes the SSR race. File `tests/global-setup.ts` is the ready-to-wire safety net.
