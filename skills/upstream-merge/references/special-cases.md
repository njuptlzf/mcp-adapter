# Special cases registry

Per Architecture C (decision **D-31**) this registry only enumerates files that cannot be resolved by the §3.2 12-category per-file default-resolution matrix. Files NOT listed here are resolved by the category defaults inlined in `SKILL.md` §3.2 — no need to add them to the registry.

Located at `skills/upstream-merge/references/` per sub-option **D-32 / C2**. The retired Phase 8 manifest `UPSTREAM-CHANGES.md` (51KB / 209 rows / repo root) is no longer maintained; if you are migrating from that file, this registry is its successor.

| Path | Status | Why special | Decision |
|---|---|---|---|
| `index.ts` | `decoupled-wrapper` | D-04 backward-compat wrapper; preserves Pi `mcpAdapter(pi)` signature | `ours` |
| `mcp-panel.ts` | `decoupled-wrapper` | DECOUPLE-06 follow-up; still imports `@earendil-works/pi-tui` (matchesKey/truncateToWidth/visibleWidth) | `assess` |
| `mcp-setup-panel.ts` | `decoupled-wrapper` | DECOUPLE-06 follow-up; same `pi-tui` import residual as mcp-panel.ts | `assess` |
| `panel-keys.ts` | `deleted-in-fork` | Present in upstream; fork removed it (legacy; unreferenced after D-04 Phase 3); do NOT `git checkout --theirs` | `ours` |
| `adapters/qoder-adapter.ts` | `decoupled-wrapper` | Phase 10: refactored to thin wrapper extending StoreAgentAdapter; Qoder-specific Query.streamInput routing preserved | `ours` |
| `adapters/kilo-adapter.ts` | `decoupled-wrapper` | Phase 10: refactored to thin wrapper extending StoreAgentAdapter; Kilo-specific sendMessageFn callback preserved | `ours` |
| `interfaces/agent-api.ts` | `decoupled-wrapper` | D-01..D-03 Capability Gate; legal JSDoc mentions of Pi types (not import coupling) | `manual` |
| `interfaces/agent-paths.ts` | `decoupled-wrapper` | D-02 AgentPathResolver; generic contract, Pi-specific factory is separate | `manual` |
| `interfaces/sampling.ts` | `decoupled-wrapper` | D-03 SamplingProvider contract; `PiSamplingProvider` is the only Pi-bound adapter | `manual` |
| `package.json` | `sibling-config` | Adds `@qoder-ai/qoder-agent-sdk` peer dep + Pi as optional peer (D-01) + `kilo-mcp-server`/`qoder-mcp-bridge` bin entries | `manual` |
| `vitest.config.ts` | `sibling-config` | Adds coverage reporter per D-17 (MatrixReporter) | `manual` |
| `tsconfig.json` | `sibling-config` | Path aliases for `adapters/*` and `interfaces/*` (Phase 5) | `manual` |
| `README.md` | `framing-divergence` | Preserve 'Universal MCP Adapter' framing per D-18 | `assess` |
| `MAPPING.md` | `framing-divergence` | Phase 1 interface mapping doc; fork-owned | `assess` |
| `CHANGELOG.md` | `framing-divergence` | Versioned fork changelog (Universal MCP Adapter v2.x) | `assess` |
| `OAUTH.md` | `framing-divergence` | Fork-side OAuth flow doc; upstream has no equivalent | `assess` |
| `types/pi-coding-agent.d.ts` | `fork-only` | Fork-side Pi type declaration (D-21); declarations ≠ coupling | `ours` |
| `types/pi-ai.d.ts` | `fork-only` | Fork-side Pi type declaration (D-21) | `ours` |
| `types/pi-tui.d.ts` | `fork-only` | Fork-side Pi type declaration (D-21) | `ours` |
| `interfaces/agent-channel.ts` | `fork-only` | Universal bidirectional AgentChannel interface; no upstream equivalent | `ours` |
| `bin/kilo-mcp-server.ts` | `fork-only` | Kilo MCP stdio server bin entry; upstream has no `bin/` directory | `ours` |
| `bin/qoder-mcp-bridge.ts` | `fork-only` | Qoder SDK bridge bin entry; upstream has no `bin/` directory | `ours` |
| `adapters/store-adapter.ts` | `fork-only` | Shared StoreAgentAdapter base class extracted from qoder/kilo adapters; zero Pi imports — zero conflict risk with upstream | `ours` |
| `skills/mcp-adapter/SKILL.md` | `fork-only` | Phase 11: unified mcp-adapter skill replaces deploy/generate/test; upstream has no skills/ dir | `ours` |
| `skills/mcp-adapter/references/generate.md` | `fork-only` | Phase 11: migrated config generation from deprecated generate-mcp-config | `ours` |
| `skills/mcp-adapter/references/deploy.md` | `fork-only` | Phase 11: migrated deployment workflow from deprecated deploy-mcp-adapter | `ours` |
| `skills/mcp-adapter/references/verify.md` | `fork-only` | Phase 11: migrated verification workflow from deprecated mcp-adapter-test | `ours` |
| `skills/mcp-adapter/references/resolver.md` | `fork-only` | Phase 11: unified path resolution replaces agent-paths/<id>.md static files | `ours` |
| `skills/mcp-adapter/references/deploy-examples.md` | `fork-only` | Phase 11: deployment code templates migrated from deploy-mcp-adapter; upstream has no skills/ dir | `ours` |
| `skills/mcp-adapter-test/references/agent-paths/README.md` | `fork-only` | Phase 11: deprecation notice for legacy agent-paths directory | `ours` |

**Status taxonomy** (5 values): `fork-only` (file exists only in fork, never in upstream) / `decoupled-wrapper` (fork wraps a Pi-specific concern behind a generic interface) / `deleted-in-fork` (file is in upstream, the fork removed it) / `sibling-config` (config file with both upstream and fork structural choices) / `framing-divergence` (doc file where fork framing differs from upstream).

**Decision values** (4): `ours` (always keep fork version on conflict) / `manual` (line-by-line review) / `assess` (run §3.1 grep + intent alignment) / `wraps-theirs` (accept upstream, wrap behind generic interface in a follow-up commit).

> `wraps-theirs` is reserved for entries where the §3.2b follow-up flow (accept-upstream + wrap) is committed up-front in the registry row itself, rather than invoked at merge time. As of Phase 9 no entries use it — all current entries commit to one of the merge-time decisions above. If a future conflict pattern matches the §3.2b flow exactly, prefer invoking §3.2b at merge time over pre-committing `wraps-theirs` to the registry, since the §3.2b follow-up commits are easier to audit alongside the merge commit than as separate registry annotations.

## How to add an entry

Append a row using the exact schema `| `path` | `status` | `why` | `decision` |`. After adding, run `npm run upstream:check --no-color` and visually verify the new path appears in the `✓ registered` section (not in `⚠ diverged-but-not-registered`, which would indicate the registry did not recognise the row). Note: the script only exits 2 when the parsed set is **completely empty** (e.g., the file is unreadable or has no parseable rows). A single malformed row is now logged as a `WARN: registry row not parsed (skipped)` line, but does not change the exit code — so the visual verification step above is required to catch typos.

## When this registry was last curated

2026-06-26 (Phase 11 skill unification + post-Phase-10 fixes; 29 anchored entries — added `skills/mcp-adapter/` + 5 references files including deploy-examples.md). Update this footer on Phase 11+ amendments.
