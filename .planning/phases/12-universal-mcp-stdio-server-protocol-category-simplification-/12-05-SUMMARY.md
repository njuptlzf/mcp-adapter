---
phase: 12-universal-mcp-stdio-server-protocol-category-simplification-
plan: 05
subsystem: documentation
tags: [documentation, skill-simplification, universal-mcp, branch-a-branch-c, d-03, d-08, d-10, d-12]
requires:
  - "bin/mcp-server.ts (universal MCP stdio server from Plan 03)"
  - "adapters/protocol-sampling-forwarder.ts (from Plan 01)"
  - "adapters/protocol-elicitation-forwarder.ts (from Plan 01)"
  - "interfaces/agent-api.ts (AGENT_ADAPTERS with universal-mcp + pi from Plan 02)"
  - "interfaces/agent-paths.ts (createUniversalResolver from Plan 02)"
provides:
  - "skills/mcp-adapter/SKILL.md — simplified to Branch A + Branch C with single-question Phase 0 (D-12)"
  - "skills/mcp-adapter/references/resolver.md — 2-row capability matrix (Pi + Universal MCP)"
  - "skills/mcp-adapter/references/deploy.md — Branch A + Branch C only, mcp-server command (D-10)"
  - "skills/mcp-adapter/references/verify.md — --agent universal-mcp, protocol forwarder tests"
  - "README.md — universal mcp-server documentation, no per-agent mentions (D-08, D-10)"
  - "CHANGELOG.md — Phase 12 migration entry with breaking changes and migration steps (D-10)"
  - "skills/upstream-merge/references/special-cases.md — 27 entries (removed 5, added 3, updated 4)"
affects:
  - "Future: 12-04 E2E tests will reference mcp-server bin entry documented here"
  - "Future: users following SKILL.md will see Branch A + Branch C only"
  - "Future: fork maintainers will see updated special-cases registry"
tech-stack:
  added: []
  patterns:
    - "Single-question Phase 0 (D-12): Pi or other MCP-compatible agent? → Branch A or Branch C"
    - "Branch C as complete implementation (D-08): not best-effort, runtime capability discovery"
    - "Universal config path (D-02): --config > MCP_CONFIG_PATH > .mcp.json > ~/.config/mcp/mcp.json"
    - "Single bin entry (D-10): mcp-server, no backward compatibility aliases"
key-files:
  modified:
    - path: "skills/mcp-adapter/SKILL.md"
      lines: 254
      purpose: "Phase 0 simplified to single question; Branch B removed; Branch C documented as complete (D-03, D-08, D-12)"
    - path: "skills/mcp-adapter/references/resolver.md"
      lines: 116
      purpose: "Capability matrix simplified to Pi + Universal MCP (2 rows); universal config path chain"
    - path: "skills/mcp-adapter/references/deploy.md"
      lines: 110
      purpose: "Branch B removed; Branch C shows mcp-server command (D-10); D-08 complete implementation note"
    - path: "skills/mcp-adapter/references/verify.md"
      lines: 158
      purpose: "Test matrix: --agent universal-mcp; protocol forwarder tests added; per-adapter tests removed"
    - path: "README.md"
      lines_changed: 40
      purpose: "Supported Agents table: Branch A + Branch C; Install: mcp-server bin entry; no per-agent mentions (D-08, D-10)"
    - path: "CHANGELOG.md"
      lines_added: 37
      purpose: "[Unreleased] Phase 12 entry: breaking changes, new features, migration steps (D-10)"
    - path: "skills/upstream-merge/references/special-cases.md"
      lines_changed: 10
      purpose: "Removed 5 deleted-file entries; added 3 new fork-only entries; updated 4 modified-file entries; 27 total"
    - path: "scripts/deploy-verify.ts"
      lines_changed: 1
      purpose: "Usage comment updated from --agent qoder to --agent universal-mcp (Rule 3 fix)"
decisions:
  - "D-12: SKILL.md Phase 0 simplified to single question — Pi or other MCP-compatible agent? No registry reading, no static capability matrix"
  - "D-03: Pi only uses Branch A; Branch C only for non-Pi MCP-compatible agents"
  - "D-08: Branch C is a COMPLETE implementation — term 'best-effort' removed entirely; TUI/renderers are presentation, not capabilities"
  - "D-10: Single mcp-server bin entry; no backward compatibility aliases; CHANGELOG documents migration"
  - "D-02: Universal config path: --config > MCP_CONFIG_PATH > .mcp.json > ~/.config/mcp/mcp.json"
metrics:
  duration: "~37min"
  completed: "2026-06-30"
  tasks: 2
  files_modified: 8
  lines_added: 500
  lines_removed: 430
  commits: 2
---

# Phase 12 Plan 05: Documentation Updates (SKILL.md, README, CHANGELOG, special-cases) Summary

Simplified all documentation to reflect the universal MCP server architecture: SKILL.md Phase 0 reduced to a single question (Pi or other MCP-compatible agent?), Branch B removed entirely, Branch C documented as a complete implementation (not "best-effort"), README updated with universal mcp-server bin entry, CHANGELOG documents the migration, and the upstream-merge special-cases registry updated with 3 new fork-only entries and 5 deleted entries removed.

## What Was Built

### SKILL.md — Simplified to Branch A + Branch C (D-03, D-08, D-12)

**Phase 0 simplification (D-12):**
- Single question: "Pi or other MCP-compatible agent?"
- Pi → Branch A (native extension install via `pi install npm:pi-mcp-adapter`)
- Other → Branch C (register `mcp-server` in agent's MCP config)
- No registry reading, no static capability matrix, no `AGENT_ADAPTERS` grep
- Branch B removed entirely — no SDK bridge, no per-agent adapter mentions

**Branch descriptions (D-03, D-08):**
- Branch A (Pi): Native extension. Full TUI panel, custom renderers, in-process sampling via PiSamplingProvider
- Branch C (Universal MCP): Register `mcp-server` in agent's MCP config. Runtime capability discovery via `server.getClientCapabilities()`. Sampling and elicitation forwarded via MCP Server→Client reverse calls when agent declares those capabilities
- Branch C is a COMPLETE implementation (D-08) — NOT "best-effort" or "lesser" than Branch A. The term "best-effort" is removed entirely. TUI rendering is a Pi-only presentation enhancement, not a capability difference.

**Config path (D-02):** Universal discovery chain documented: `--config` flag > `MCP_CONFIG_PATH` env > `.mcp.json` in cwd > `~/.config/mcp/mcp.json`

### resolver.md — 2-row capability matrix

- Removed Kilo and Qoder rows
- 2 rows: Pi (Branch A, all ✅) and Universal MCP (Branch C, runtime-discovered)
- Universal config path table (4-level precedence chain)
- "Adding a New Agent" section notes most agents don't need a new adapter (D-08)

### deploy.md — Branch A + Branch C only

- Branch B section removed entirely
- Branch C shows `"command": "mcp-server"` (not `kilo-mcp-server`)
- Branch C documented as complete implementation with D-08 note
- Config path discovery documented (D-02)
- Verification uses `--agent universal-mcp`

### verify.md — Updated test matrix

- `--agent universal-mcp` replaces `--agent kilo` and `--agent qoder`
- Per-adapter test references removed (qoder-adapter.test.ts, qoder-sampling-provider.test.ts, store-adapter.test.ts)
- New Step 5: Protocol Forwarder Tests (protocol-sampling-forwarder.test.ts, protocol-elicitation-forwarder.test.ts, mcp-server-e2e.test.ts)
- Host × Target matrix updated: pi, universal-mcp (not kilo, qoder)

### README.md — Universal mcp-server documentation (D-08, D-10)

- Supported Agents table: 2 rows (Branch A: Pi, Branch C: Any MCP-compatible agent)
- Install > For other agents: shows `mcp-server` bin entry with JSON config example
- Universal entry point code: no QoderAdapter import; shows PiAdapter + mcp-server note
- Verification matrix: Universal MCP replaces Qoder row
- All per-agent references removed (kilo-mcp-server, qoder-mcp-bridge, KiloAdapter, QoderAdapter, createKiloResolver, createQoderResolver)

### CHANGELOG.md — Phase 12 migration entry (D-10)

- `[Unreleased] - Universal MCP Stdio Server`
- Breaking changes: kilo-mcp-server → mcp-server rename, qoder-mcp-bridge deletion, per-agent adapter deletion, resolver function removal
- New features: universal MCP stdio server, ProtocolSamplingForwarder, ProtocolElicitationForwarder, runtime capability discovery
- Migration steps: replace kilo-mcp-server with mcp-server, remove Qoder bridge setup, universal config path

### special-cases.md — Updated fork-only file registry

**Removed entries (5):**
- `adapters/kilo-adapter.ts` (deleted in 12-03)
- `adapters/qoder-adapter.ts` (deleted in 12-03)
- `adapters/store-adapter.ts` (deleted in 12-03)
- `bin/kilo-mcp-server.ts` (renamed to mcp-server.ts in 12-03)
- `bin/qoder-mcp-bridge.ts` (deleted in 12-03)

**Added entries (3):**
- `bin/mcp-server.ts` — Universal MCP stdio server; renamed from kilo-mcp-server.ts (D-05)
- `adapters/protocol-sampling-forwarder.ts` — Implements SamplingProvider via MCP Server→Client reverse call (D-06)
- `adapters/protocol-elicitation-forwarder.ts` — Implements UISystem.form via MCP Server→Client reverse call (D-07)

**Updated entries (4):**
- `interfaces/agent-api.ts` — AGENT_ADAPTERS simplified to universal-mcp + pi
- `interfaces/agent-paths.ts` — Removed createKiloResolver/createQoderResolver; createUniversalResolver added
- `package.json` — bin reduced to pi-mcp-adapter + mcp-server (D-10)
- `vitest.config.ts` — Removed coverage thresholds for deleted adapter files

**Footer:** Updated to 27 entries (was 28). `npm run upstream:check` exits 0 (264 diverged, 27 registered, 237 default-resolved, 0 stale).

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c "Branch B" SKILL.md` | 0 | 0 | PASS |
| `grep -c "Branch B" deploy.md` | 0 | 0 | PASS |
| `grep -c "kilo-mcp-server\|qoder-mcp-bridge\|KiloAdapter\|QoderAdapter\|StoreAgentAdapter" SKILL.md` | 0 | 0 | PASS |
| `grep -c "kilo-mcp-server\|qoder-mcp-bridge\|KiloAdapter\|QoderAdapter" README.md` | 0 | 0 | PASS |
| `grep -c "mcp-server" SKILL.md` | ≥1 | 7 | PASS |
| `grep -c "mcp-server" README.md` | ≥1 | 6 | PASS |
| `grep -c "best-effort" SKILL.md` | 0 | 0 | PASS |
| `grep -c "protocol-sampling-forwarder\|protocol-elicitation-forwarder" special-cases.md` | ≥1 | 2 | PASS |
| `grep -c "bin/mcp-server.ts" special-cases.md` | ≥1 | 2 | PASS |
| Deleted file entries in special-cases.md | 0 | 0 | PASS |
| `npm run upstream:check` exit code | 0 | 0 | PASS |
| SKILL.md line count | ≥100 | 254 | PASS |
| resolver.md universal-mcp refs | ≥1 | 2 | PASS |
| deploy.md mcp-server command | ≥1 | 4 | PASS |
| verify.md --agent universal-mcp | ≥1 | 2 | PASS |
| CHANGELOG migration section | ≥1 | 2 | PASS |
| CHANGELOG kilo-mcp-server rename | ≥1 | 2 | PASS |
| CHANGELOG qoder-mcp-bridge deletion | ≥1 | 1 | PASS |

## Commits

| Hash | Type | Message |
|------|------|---------|
| 7fe57c9 | docs | docs(12-05): simplify SKILL.md to Branch A + Branch C, remove Branch B and per-agent references |
| 1edacca | docs | docs(12-05): update README, CHANGELOG, and special-cases registry for universal MCP server |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Fixed deploy-verify.ts usage comment**
- **Found during:** Task 2 (verify.md references `--agent universal-mcp` but deploy-verify.ts help text still showed `--agent qoder`)
- **Issue:** The deploy-verify.ts script's usage comment on line 12 still referenced `--agent qoder` which is no longer a valid agent ID after 12-03's registry simplification. This created an inconsistency between the verify.md documentation (which now references `--agent universal-mcp`) and the script's own help text.
- **Fix:** Updated the comment from `--agent qoder` to `--agent universal-mcp`.
- **Files modified:** `scripts/deploy-verify.ts` (1 line)
- **Commit:** 1edacca

**2. [Rule 1 - Bug] Removed "best-effort" term from SKILL.md**
- **Found during:** Task 1 (verification grep)
- **Issue:** SKILL.md contained the term "best-effort" in the context of saying Branch C is NOT best-effort. Per D-08, the term should be removed entirely: "The term 'best-effort' is removed — Branch C is a complete implementation within the MCP protocol's scope."
- **Fix:** Reworded the sentence to remove "best-effort" entirely: "NOT 'lesser' than Branch A" instead of "NOT 'best-effort' or 'lesser' than Branch A".
- **Files modified:** `skills/mcp-adapter/SKILL.md`
- **Commit:** 7fe57c9

### GitNexus Impact Analysis Skip

Per AGENTS.md, GitNexus impact analysis should be run before editing symbols. GitNexus MCP tools were unavailable in this runtime. Per established Phase 12 precedent (12-01, 12-02, 12-03 all documented the same skip), manual analysis was performed instead:
- **All changes are to .md documentation files** — no .ts symbol modifications (except the 1-line comment fix in deploy-verify.ts, which is a comment change, not a symbol modification)
- **AGENTS.md GitNexus scope** = .ts symbols only; .md files are out of scope
- **Risk:** NONE — documentation-only changes, no runtime behavior affected

## Known Stubs

None. This is a documentation-only plan — no code stubs, no placeholder data, no unwired components.

## Threat Flags

None. No new security-relevant surface beyond the plan's `<threat_model>`:
- T-12-14 (Information Disclosure): accepted — documentation is public, no secrets disclosed
- T-12-SC (Tampering): accepted — no new packages, documentation-only plan

## Self-Check: PASSED

### Modified files exist:
- ✅ FOUND: skills/mcp-adapter/SKILL.md
- ✅ FOUND: skills/mcp-adapter/references/resolver.md
- ✅ FOUND: skills/mcp-adapter/references/deploy.md
- ✅ FOUND: skills/mcp-adapter/references/verify.md
- ✅ FOUND: README.md
- ✅ FOUND: CHANGELOG.md
- ✅ FOUND: skills/upstream-merge/references/special-cases.md
- ✅ FOUND: scripts/deploy-verify.ts

### Commits exist:
- ✅ FOUND: 7fe57c9 (docs(12-05): simplify SKILL.md to Branch A + Branch C...)
- ✅ FOUND: 1edacca (docs(12-05): update README, CHANGELOG, and special-cases registry...)
