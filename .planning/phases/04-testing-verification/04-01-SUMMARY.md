---
phase: 04-testing-verification
plan: 01
type: tdd
wave: 1
completed_at: 2026-06-11
status: complete
requirements:
  - REQ-07
must_haves:
  truths:
    - "Non-Pi agent adapter can be created following the same contract as PiAdapter"
    - "All AgentAPI methods work correctly with mock adapter"
    - "All UISystem methods work correctly with mock adapter"
    - "Adapter pattern is verified for multiple agent scenarios"
  artifacts:
    - path: "__tests__/mock-adapter.test.ts"
      provides: "Mock adapter for non-Pi agent testing"
      min_lines: 80
      actual_lines: 265
    - path: "__tests__/adapter-contract.test.ts"
      provides: "Contract verification tests"
      min_lines: 60
      actual_lines: 180
  key_links:
    - from: "__tests__/mock-adapter.test.ts"
      to: "interfaces/agent-api.ts"
      via: "MockAgentAPI implements AgentAPI"
      verified: true
    - from: "__tests__/adapter-contract.test.ts"
      to: "__tests__/mock-adapter.test.ts"
      via: "Inline-defined MockAgentAPI for contract verification"
      verified: true
---

# Plan 04-01 Summary: Mock Adapter & Contract Tests

## What was built

Two new test files that prove the universal adapter pattern works for any
`AgentAPI` implementation — not just Pi.

- **`__tests__/mock-adapter.test.ts`** (12 tests, 265 lines) — defines
  `MockAgentAPI`, `MockAgentContext`, and `MockUISystem` in-memory classes
  that fully implement the universal interfaces. Tests cover tool/command/flag
  registration, event handling, message forwarding, exec, and all five
  UISystem members (`notify`, `setStatus`, `form`, `custom`, `theme`).

- **`__tests__/adapter-contract.test.ts`** (7 tests, 180 lines) — exercises
  the contract declaratively: every `AgentAPI` must expose 8 required methods,
  `AgentContext` requires `cwd` and `hasUI`, `UISystem` requires `notify`, and
  the adapter pattern is verified to work uniformly for both `PiAdapter` and
  a standalone `MockAgentAPI`. Also smoke-tests `loadMcpConfig` to confirm
  the config-loading path that `initializeMcp` uses is decoupled from Pi.

## Test results

| Suite | Tests | Status |
|-------|-------|--------|
| `__tests__/mock-adapter.test.ts` | 12 | ✓ all pass |
| `__tests__/adapter-contract.test.ts` | 7 | ✓ all pass |
| **New tests** | **19** | ✓ |
| Full project test suite | 369/371 | 2 pre-existing `interactive-visualizer-server` failures (unrelated, require built dist) |

## Deviations from plan

- The `FlagConfig` interface in `interfaces/agent-api.ts` uses an open
  index signature (`[key: string]: unknown`), so the mock adapter's
  `registerFlag` had to copy the input into a stored object that
  preserves the runtime-added `value` field. The plan's "Test 3" was
  adapted to assert the stored fields rather than reference identity.

- Plan specified 5 contract tests; delivered 7. Tests 3b and 4b are
  natural extensions: a full UISystem smoke test and a PiAdapter /
  MockAgentAPI parity check.

## Key decisions

- **No shared `MockAgentAPI` import between the two files** — defining
  the mock inline in `adapter-contract.test.ts` keeps the contract file
  self-contained as a reference for future adapter authors. Both files
  compile independently.

- **`loadMcpConfig` smoke test instead of full `initializeMcp`** — the
  full init flow spawns server managers and tries real network. The
  contract test only needs to prove the function is reachable with no
  Pi-specific preconditions, which it is.

## Commits

- `0abe648` — test(phase-04): add mock-adapter contract tests (Task 1)
- `cb4ad41` — test(phase-04): add adapter contract verification tests (Task 2)

## Next

Plan 04-02 will configure vitest coverage and generate initial coverage
metrics across the project.
