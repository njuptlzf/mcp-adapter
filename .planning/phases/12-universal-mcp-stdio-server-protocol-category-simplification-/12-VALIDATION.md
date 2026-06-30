# Phase 12: Validation Strategy

> Derived from RESEARCH.md §Validation Architecture

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npm run test` (includes `test:prebuild` + `vitest run`) |

## Decision → Test Map

| Decision | Behavior | Test Type | Automated Command |
|----------|----------|-----------|-------------------|
| D-01 | AGENT_ADAPTERS has exactly Pi + universal-mcp | unit | `npx vitest run __tests__/adapter-contract.test.ts -x` |
| D-04 | Deleted files don't exist / no missing imports | smoke | `npx tsc --noEmit && npx vitest run` |
| D-05 | `bin/mcp-server.ts` exists, `bin/kilo-mcp-server.ts` doesn't | smoke | `ls bin/mcp-server.ts && ! ls bin/kilo-mcp-server.ts` |
| D-06 | ProtocolSamplingForwarder implements SamplingProvider | unit | `npx vitest run __tests__/protocol-sampling-forwarder.test.ts -x` |
| D-07 | ProtocolElicitationForwarder implements UISystem.form | unit | `npx vitest run __tests__/protocol-elicitation-forwarder.test.ts -x` |
| D-08 | Branch C has full tool functionality | integration | `npx vitest run __tests__/adapter-contract.test.ts -x` |
| D-11 | No config check for sampling/elicitation in Branch C | unit | `npx vitest run __tests__/protocol-sampling-forwarder.test.ts -x` |
| D-12 | SKILL.md has simplified Phase 0 | manual | Manual review |
| D-13 | E2E test spawns bin/mcp-server.ts as subprocess | e2e | `npx vitest run __tests__/mcp-server-e2e.test.ts -x` |

## Sampling Rate

- **Per task commit:** `npx vitest run` (quick — existing tests + new unit tests)
- **Per wave merge:** `npm run test` (full suite including prebuild)
- **Phase gate:** Full suite green + `npm run verify:deploy -- --agent universal-mcp` + `npm run upstream:check` + `npx tsc --noEmit`

## Test Files to Create

| File | Covers | Wave |
|------|--------|------|
| `__tests__/protocol-sampling-forwarder.test.ts` | D-06, D-11 | 1 |
| `__tests__/protocol-elicitation-forwarder.test.ts` | D-07 | 1 |
| `__tests__/mcp-server-e2e.test.ts` | D-13 | 3 |
| `__tests__/fixtures/mock-mcp-client.ts` | D-06, D-07, D-13 (shared fixture) | 1 |

## Test Files to Delete (D-09)

| File | Reason |
|------|--------|
| `__tests__/qoder-adapter.test.ts` | Tests deleted QoderAdapter |
| `__tests__/qoder-adapter-integration.test.ts` | Tests deleted QoderAdapter |
| `__tests__/qoder-sampling-provider.test.ts` | Tests deleted QoderSamplingProvider |
| `__tests__/store-adapter.test.ts` | Tests deleted StoreAgentAdapter (D-04 clarified — full deletion) |

## Test Files to Keep

| File | Reason |
|------|--------|
| `__tests__/adapter-contract.test.ts` | Parametric via AGENT_ADAPTERS — auto-adapts |
| `__tests__/capability-gate.test.ts` | Parametric via AGENT_ADAPTERS — auto-adapts |
| `__tests__/sampling-handler.test.ts` | Tests sampling-handler.ts which is UNCHANGED |
| `__tests__/elicitation-handler.test.ts` | Tests elicitation-handler.ts which is UNCHANGED |
| `__tests__/server-manager-sampling.test.ts` | Tests server-manager sampling config — UNCHANGED |
