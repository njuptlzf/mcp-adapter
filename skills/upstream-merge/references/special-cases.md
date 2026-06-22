# Special cases registry

Per Architecture C (decision **D-31**) this registry only enumerates files that cannot be resolved by the §3.2 12-category per-file default-resolution matrix. Files NOT listed here are resolved by the category defaults inlined in `SKILL.md` §3.2 — no need to add them to the registry.

Located at `skills/upstream-merge/references/` per sub-option **D-32 / C2**. The retired Phase 8 manifest `UPSTREAM-CHANGES.md` (51KB / 209 rows / repo root) is no longer maintained; if you are migrating from that file, this registry is its successor.

| Path | Status | Why special | Decision |
|---|---|---|---|
| `index.ts` | `decoupled-wrapper` | D-04 backward-compat wrapper; preserves Pi `mcpAdapter(pi)` signature | `ours` |
| `mcp-panel.ts` | `decoupled-wrapper` | DECOUPLE-06 follow-up; still imports `@earendil-works/pi-tui` (matchesKey/truncateToWidth/visibleWidth) | `assess` |
| `mcp-setup-panel.ts` | `decoupled-wrapper` | DECOUPLE-06 follow-up; same `pi-tui` import residual as mcp-panel.ts | `assess` |
| `panel-keys.ts` | `deleted-in-fork` | Present in upstream; fork removed it (legacy; unreferenced after D-04 Phase 3); do NOT `git checkout --theirs` | `ours` |
| `interfaces/agent-api.ts` | `decoupled-wrapper` | D-01..D-03 Capability Gate; legal JSDoc mentions of Pi types (not import coupling) | `manual` |
| `interfaces/agent-paths.ts` | `decoupled-wrapper` | D-02 AgentPathResolver; generic contract, Pi-specific factory is separate | `manual` |
| `interfaces/sampling.ts` | `decoupled-wrapper` | D-03 SamplingProvider contract; `PiSamplingProvider` is the only Pi-bound adapter | `manual` |
| `package.json` | `sibling-config` | Adds `@qoder-ai/qoder-agent-sdk` peer dep + Pi as optional peer (D-01) | `manual` |
| `vitest.config.ts` | `sibling-config` | Adds coverage reporter per D-17 (MatrixReporter) | `manual` |
| `tsconfig.json` | `sibling-config` | Path aliases for `adapters/*` and `interfaces/*` (Phase 5) | `manual` |
| `README.md` | `framing-divergence` | Preserve 'Universal MCP Adapter' framing per D-18 | `assess` |
| `MAPPING.md` | `framing-divergence` | Phase 1 interface mapping doc; fork-owned | `assess` |
| `CHANGELOG.md` | `framing-divergence` | Versioned fork changelog (Universal MCP Adapter v2.x) | `assess` |
| `OAUTH.md` | `framing-divergence` | Fork-side OAuth flow doc; upstream has no equivalent | `assess` |
| `types/pi-coding-agent.d.ts` | `fork-only` | Fork-side Pi type declaration (D-21); declarations ≠ coupling | `ours` |
| `types/pi-ai.d.ts` | `fork-only` | Fork-side Pi type declaration (D-21) | `ours` |
| `types/pi-tui.d.ts` | `fork-only` | Fork-side Pi type declaration (D-21) | `ours` |

**Status taxonomy** (5 values): `fork-only` (file exists only in fork, never in upstream) / `decoupled-wrapper` (fork wraps a Pi-specific concern behind a generic interface) / `deleted-in-fork` (file is in upstream, the fork removed it) / `sibling-config` (config file with both upstream and fork structural choices) / `framing-divergence` (doc file where fork framing differs from upstream).

**Decision values** (4): `ours` (always keep fork version on conflict) / `manual` (line-by-line review) / `assess` (run §3.1 grep + intent alignment) / `wraps-theirs` (accept upstream, wrap behind generic interface in a follow-up commit).

## How to add an entry

Append a row, choose `Status` from the 5-value taxonomy, point `Why special` at the relevant `D-XX` / `Phase XX` / `DECOUPLE-NN` reference, and run `npm run upstream:check --no-color` to verify the entry is parsed correctly (a malformed row will surface as exit 2).

## When this registry was last curated

2026-06-22 (Phase 9 Architecture C; 17 anchored entries from Phase 8 manifest footnotes + expansion). Update this footer on Phase 9+ amendments.
