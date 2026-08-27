# Archived: Retired Parallel-Engine Docs

These documents describe the fork's retired **parallel engine** architecture
(`adapters/entry.ts` + `interfaces/agent-api.ts` + `adapters/pi-adapter.ts`),
which Phase 1 removed in favor of "**fork the host, not the engine**"
(`adapters/universal-host.ts` impersonating `ExtensionAPI`).

Archived 2026-08 (Phase 1.6 close-out). Retained as historical design context
only — not current documentation. Their references to `entry.ts` /
`agent-api.ts` / `pi-adapter.ts` / `mock-agent.ts` point at files that no
longer exist.

| File | What it described (now retired) |
| --- | --- |
| `architecture-comparison.md` | `AgentAPI` 8-method abstraction vs upstream `ExtensionAPI`. |
| `FAQ.md` | AgentAPI-era Q&A (how to onboard a new agent via `AgentAPI`). |
| `mcp-adapter-test-plan.md` | Test plan centered on `tests/fixtures/mock-agent.ts` (`MockAgent implements AgentAPI`). |

Current architecture: `docs/phase1-fork-host-refactor-plan.md` and
`docs/architecture-review.md`; surface mapping: `MAPPING.md` (root).