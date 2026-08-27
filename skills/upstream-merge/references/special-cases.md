# Special cases registry

Per Architecture C (decision **D-31**) this registry only enumerates files that cannot be resolved by the §4.2 12-category per-file default-resolution matrix. Files NOT listed here are resolved by the category defaults inlined in `SKILL.md` §4.2 — no need to add them to the registry.

Located at `skills/upstream-merge/references/` per sub-option **D-32 / C2**. The retired Phase 8 manifest `UPSTREAM-CHANGES.md` (51KB / 209 rows / repo root) is no longer maintained; if you are migrating from that file, this registry is its successor.

| Path | Status | Why special | Decision |
|---|---|---|---|
| `index.ts` | `decoupled-wrapper` | D-04 backward-compat wrapper; preserves Pi `mcpAdapter(pi)` signature | `ours` |
| `interfaces/agent-paths.ts` | `decoupled-wrapper` | D-02 AgentPathResolver; removed createKiloResolver/createQoderResolver (Phase 12); createUniversalResolver added; Pi-specific factory is separate | `manual` |
| `interfaces/sampling.ts` | `decoupled-wrapper` | D-03 SamplingProvider contract; `PiSamplingProvider` is the only Pi-bound adapter | `manual` |
| `package.json` | `sibling-config` | Pi as optional peer (D-01); bin reduced to `pi-mcp-adapter` + `mcp-server` (Phase 12 D-10: removed `kilo-mcp-server`/`qoder-mcp-bridge`) | `manual` |
| `vitest.config.ts` | `sibling-config` | Adds coverage reporter per D-17 (MatrixReporter); Phase 12: removed coverage thresholds for deleted adapter files | `manual` |
| `tsconfig.json` | `sibling-config` | Path aliases for `adapters/*` and `interfaces/*` (Phase 5) | `manual` |
| `README.md` | `framing-divergence` | Preserve 'Universal MCP Adapter' framing per D-18 | `assess` |
| `MAPPING.md` | `framing-divergence` | Phase 1 interface mapping doc; fork-owned | `assess` |
| `CHANGELOG.md` | `framing-divergence` | Versioned fork changelog (Universal MCP Adapter v2.x) | `assess` |
| `bin/mcp-server.ts` | `fork-only` | Universal MCP stdio server; renamed from `kilo-mcp-server.ts` (Phase 12 D-05); upstream has no `bin/` directory | `ours` |
| `adapters/protocol-sampling-forwarder.ts` | `fork-only` | Implements `SamplingProvider` via MCP Server→Client `sampling/createMessage` reverse call (D-06); upstream has no equivalent | `ours` |
| `adapters/protocol-elicitation-forwarder.ts` | `fork-only` | Implements `UISystem.form` via MCP Server→Client `elicitation/create` reverse call (D-07); upstream has no equivalent | `ours` |
| `skills/mcp-adapter/SKILL.md` | `fork-only` | Phase 11: unified mcp-adapter skill replaces deploy/generate/test; upstream has no skills/ dir | `ours` |
| `skills/mcp-adapter/references/generate.md` | `fork-only` | Phase 11: migrated config generation from deleted generate-mcp-config | `ours` |
| `skills/mcp-adapter/references/deploy.md` | `fork-only` | Phase 11: migrated deployment workflow from deleted deploy-mcp-adapter | `ours` |
| `skills/mcp-adapter/references/verify.md` | `fork-only` | Phase 11: migrated verification workflow from deleted mcp-adapter-test | `ours` |
| `skills/mcp-adapter/references/resolver.md` | `fork-only` | Phase 11: unified path resolution replaces agent-paths/<id>.md static files | `ours` |
| `skills/mcp-adapter/references/deploy-examples.md` | `fork-only` | Phase 11: deployment code templates migrated from deploy-mcp-adapter; upstream has no skills/ dir | `ours` |

**Status taxonomy** (5 values): `fork-only` (file exists only in fork, never in upstream) / `decoupled-wrapper` (fork wraps a Pi-specific concern behind a generic interface) / `deleted-in-fork` (file is in upstream, the fork removed it) / `sibling-config` (config file with both upstream and fork structural choices) / `framing-divergence` (doc file where fork framing differs from upstream).

**Decision values** (4): `ours` (always keep fork version on conflict) / `manual` (line-by-line review) / `assess` (run §4.1 grep + intent alignment) / `wraps-theirs` (accept upstream, wrap behind generic interface in a follow-up commit).

> `wraps-theirs` is reserved for entries where the §4.2b follow-up flow (accept-upstream + wrap) is committed up-front in the registry row itself, rather than invoked at merge time. As of Phase 9 no entries use it — all current entries commit to one of the merge-time decisions above. If a future conflict pattern matches the §4.2b flow exactly, prefer invoking §4.2b at merge time over pre-committing `wraps-theirs` to the registry, since the §4.2b follow-up commits are easier to audit alongside the merge commit than as separate registry annotations.

## How to add an entry

Append a row using the exact schema `| `path` | `status` | `why` | `decision` |`. After adding, run `npm run upstream:check --no-color` and visually verify the new path appears in the `✓ registered` section (not in `⚠ diverged-but-not-registered`, which would indicate the registry did not recognise the row). Note: the script only exits 2 when the parsed set is **completely empty** (e.g., the file is unreadable or has no parseable rows). A single malformed row is now logged as a `WARN: registry row not parsed (skipped)` line, but does not change the exit code — so the visual verification step above is required to catch typos.

## When this registry was last curated

2026-06-30 (Phase 12 universal MCP stdio server: removed 5 deleted-file entries, added 3 new fork-only entries for protocol forwarders + bin/mcp-server.ts, updated 4 modified-file entries; 27 anchored entries). Update this footer on future amendments.
