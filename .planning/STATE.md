---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: completed
stopped_at: Phase 9 Plan 01 complete + SUMMARY.md written (7 commits, 5 file modifications). Milestone v2.0 100% done (9/9 phases, 25/25 plans).
last_updated: "2026-06-23T01:53:00.070Z"
last_activity: 2026-06-23 — Milestone v2.0 completed and archived
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

**Created:** 2026-06-10T13:45:00+08:00
**Last updated:** 2026-06-22
**Status:** v2.0 milestone complete

## Current Position

Phase: Milestone v2.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-06-23 — Milestone v2.0 completed and archived

## Recent Progress

### Milestone v1.0 — Complete (4 phases, 7 plans)

- Phase 1: Foundation — AgentAPI/UISystem interfaces, PiAdapter, MAPPING.md
- Phase 2: Dependency Restructuring — AgentPathResolver, config.ts rewired
- Phase 3: Core Logic Abstraction — init.ts/commands.ts migrated to AgentAPI
- Phase 4: Testing & Verification — mock adapter + contract tests + coverage

### Phase 9 — Upstream Manifest Architecture C (COMPLETE)

- **09-01**: Architecture C refactor of Phase 8 `UPSTREAM-CHANGES.md` — retired repo-root manifest (51KB / 209 rows); created `skills/upstream-merge/references/special-cases.md` (37 lines, 17 anchored entries); added `scripts/upstream-divergence.ts` (D-34 contract: 3-category output, ANSI GREEN/YELLOW/RED, exit codes 0/1/2, GnuTLS workaround verbatim from 08-LEARNINGS.md L-4); inlined 12-category per-file default-resolution matrix (D-35) into SKILL.md §3.2a; rewired §1/§2/§4(e) from manifest → registry + script; added `npm run upstream:check` script (D-33 manual-only); deleted `UPSTREAM-CHANGES.md`; verified `per-category-default.md` was never created (D-35 + Q4).
- Final verification: `npm run upstream:check --no-color` exit 0; 222 diverged / 17 registered / 205 default-resolved / 0 stale.
- 7 atomic commits: b3d51e8 (registry) / 89810e8 (script) / 6350e94 (SKILL.md) / 72ae020 (npm script) / b22fdca (delete manifest) / 27d067d (no-op verify) / 89339ad (SUMMARY.md).
- UPSTREAM-01..05 all satisfied; 1 deviation documented (Rule 1 bug fix in SKILL.md §1 line 26 stale UPSTREAM-CHANGES.md reference).

### Phase 5 — Type Decoupling & Entry Point Refactor

- 05-00: Wave 0 stubs and validation update complete
- 05-01: Complete
- 05-02: agent-dir env decoupling + integration tests complete
- 05-03: sampling subsystem decoupled via SamplingProvider / PiSamplingProvider
- 05-04: elicitation and rendering decoupled behind UISystem / RenderOutput with Pi renderer
- 05-05: agent-agnostic createMcpAdapter entry point + Pi wrapper + PiAdapter context/renderer bridge complete

## Next Actions

**Milestone v2.0 — 100% COMPLETE (9/9 phases, 25/25 plans)**

All UPSTREAM-01..05 requirements satisfied. No outstanding work.

---

**Phase 8 (frozen as completed):** Verifier passed all 4 must-haves on 2026-06-18. All UPSTREAM-01..04 deliverables (manifest + SKILL.md + 2 dry-runs + deferred-items) accepted. 08-VERIFICATION.md `status: passed, score: 4/4, gaps: []`. **Not re-opened** — Phase 9 will retire the current manifest as part of its scope.

---

**Phase 5 (historical, complete):**

Requirements satisfied: DECOUPLE-01, DECOUPLE-03, DECOUPLE-04, DECOUPLE-06, DECOUPLE-07, ENTRY-01, ENTRY-02, ENTRY-03
Affected files: index.ts, adapters/pi-adapter.ts, adapters/entry.ts, adapters/pi-renderer.ts, adapters/pi-sampling-provider.ts, interfaces/sampling.ts, types.ts, tool-registrar.ts, proxy-modes.ts, direct-tools.ts, agent-dir.ts, sampling-handler.ts, elicitation-handler.ts, tool-result-renderer.ts, init.ts, and related tests.

Run `/gsd-verify-work 05-type-decoupling-entry-point-refactor` to verify the phase.

---

## Decisions & Preferences

### AgentAPI Interface (Phase 1)

- `sendMessage(message: unknown, options?: unknown)` - Flexible types for cross-agent compatibility
- `exec(command: string, args: string[])` returns `Promise<unknown>`
- All methods required, no optional agent methods

### UISystem Interface (Phase 1)

- `notify` required, all other methods optional
- `form` and `custom` may not exist in other agents
- `theme.fg` is optional

### Dependency Strategy (Phase 1)

- `@earendil-works/pi-coding-agent` → optional peerDependency
- `@earendil-works/pi-ai`, `@earendil-works/pi-tui` → optionalDependencies

### Adapter Architecture (Phase 1)

- Sampling / elicitation kept in core with adapter abstraction
- Backward compatibility maintained through existing `mcpAdapter` export + `piMcpAdapter` alias

### Sampling Provider Injection (05-03)

- `AgentContext.samplingProvider?: SamplingProvider` allows agents to opt into MCP sampling
- `PiSamplingProvider` is the only sampling boundary importing `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`
- `init.ts` only advertises sampling when `ctx.samplingProvider` is present

### QoderAdapter Integration Test (06-04)

- `__tests__/qoder-adapter-integration.test.ts` proves `createMcpAdapter` + `initializeMcp` work end-to-end through `QoderAdapter` against the calculator demo server
- Default CI run executes 8 tests (~2s); full 10-server smoke gated behind `QODER_INTEGRATION=1` env var (T-06-IT-04 DoS mitigation)
- No real qodercli spawned (fake Query via `streamInput` shim); no live LLM (samplingProvider unset)
- ADAPTER-03 satisfied; the QoderAdapter is empirically proven a drop-in replacement for PiAdapter at the universal entry point
- Two pre-existing `__tests__/interactive-visualizer-server.test.ts` failures (missing dist/ artifacts) confirmed unrelated to this plan; deferred

### Qoder Adapter mcp-adapter-test Skill Run (06-05)

- `tests/reports/qoder-adapter-test-report.md` (372 lines, gitignored per .gitignore:24) captures the full mcp-adapter-test skill run against the Qoder adapter; D-10 satisfied
- Section 4 MockAgent compatibility: 44/44 PASS for Qoder, matching Pi baseline exactly
- Section 5 token benchmark: proxy=250 tokens (≤300 ✓), 10-server savings=94% (baseline-bound; agent-agnostic serializer — same as Pi)
- Section 5B conversation simulation: search=147 tokens (≤300 ✓), 4-server savings=56% (baseline-bound; same as Pi)
- Section 6 E2E: 62/62 PASS (13 proxy + 15 directTools + 9 dt-e2e + 25 e2e-all-servers + 18 Qoder integration including all 10 demo servers via QODER_INTEGRATION=1)
- Capability Gate: Path A — `mcp` proxy tool registered (deterministic integration-test assertion; SKILL.md prose is Pi-biased, Phase 7 TEST-01..05 will generalize)
- Empty commit (`--allow-empty`) used because tests/reports/ is gitignored and plan threat-model T-06-VT-01 accepts gitignored-or-tracked status; commit body carries full run summary
- No Qoder regressions found; Phase 7 follow-ups recorded (TEST-01..05, DOC-01..03)

### Path Resolution (Phase 2)

- `AgentPathResolver` contract in `interfaces/agent-paths.ts`
- `createPiResolver` factory + `DEFAULT_AGENT_RESOLVER` constant
- `getPiGlobalConfigPath` retained as backward-compat wrapper around `resolveAgentGlobalConfigPath`
- `getAgentDir` now reads `MCP_AGENT_DIR` first, with `PI_CODING_AGENT_DIR` as backward-compatible fallback (05-02)

### Core Logic Migration (Phase 3)

- `utils.ts` / `state.ts` / `lifecycle.ts` / `init.ts` / `commands.ts` / `mcp-panel.ts` / `mcp-setup-panel.ts` migrated from `ExtensionAPI` / `ExtensionContext` to generic `AgentAPI` / `AgentContext` / `UISystem`
- `index.ts` creates `PiAdapter` and `adaptPiContext` internally at entry point
- `activate` signature unchanged for Pi backward compat

### Entry Point Decoupling (05-05)

- `adapters/entry.ts` exports agent-agnostic `createMcpAdapter(agentapi, ctx, config, cache)`
- `index.ts` is now a thin Pi-specific wrapper that loads config/cache, constructs `PiAdapter`, adapts context, and delegates to `createMcpAdapter`
- `PiAdapter` converts Pi `ExtensionContext` to `AgentContext` for tools, commands, and session events
- `PiAdapter` wraps string `renderCall`/`renderResult` outputs back to Pi `Text` via `piRenderWrapper`
- Public exports preserved: `mcpAdapter` default, `piMcpAdapter` alias, agent types, path resolvers

---

## Session Tracking

**Last session:** 2026-06-22T09:36:00.000Z
**Stopped at:** Phase 9 Plan 01 complete + SUMMARY.md written (7 commits, 5 file modifications). Milestone v2.0 100% done (9/9 phases, 25/25 plans).

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 06 P03 | 10 | 2 tasks | 3 files |
| Phase 06 P04 | ~10min | 1 task | 1 file (__tests__/qoder-adapter-integration.test.ts, 313 lines, 18 tests / 8 active + 10 gated; ADAPTER-03 satisfied) |
| Phase 06 P05 | ~12min | 1 task | 1 file (tests/reports/qoder-adapter-test-report.md, 372 lines; 132 targeted tests across 7 invocations all PASS; D-10 satisfied; Capability Gate Path A) |
| Phase 06 LEARN | ~8min | 1 file | 06-LEARNINGS.md (255 lines; 31 items extracted from 5 SUMMARY + CONTEXT + UAT + report) |
| Phase 8 P1 | ~18min | 3 tasks | 1 file (UPSTREAM-CHANGES.md, 247 lines, 209 data rows; D-21 + DECOUPLE-01/02/06/07 cited; static alignment \|RAW-MANIFEST\|=0) |
| Phase 8 P2 | ~28min | 5 tasks | 5 files (SKILL.md 141 lines + references 127 + Scenario 1 log 180 + Scenario 2 log 362 + deferred-items 112; 922 total lines added; 5 atomic commits 1b555cc..15e6b69) |
| Phase 9 P1 | ~22min | 3 tasks | 5 files (special-cases.md 37 lines + scripts/upstream-divergence.ts 117 lines + SKILL.md 142→176 lines + package.json +1 script + UPSTREAM-CHANGES.md deleted); 7 atomic commits b3d51e8..89339ad; 222 diverged / 17 registered / 205 default-resolved / 0 stale |

## Decisions

- [Phase 8]: Manifest initially-filled by git diff + awk classifier, then refined by judgment (UPSTREAM-01-C)
- [Phase 8]: Three Pi-coupling residuals tagged: mcp-panel.ts + mcp-setup-panel.ts (DECOUPLE-06 follow-up) + index.ts (D-04 backward-compat)
- [Phase 8]: Default Resolution distribution: 114 ours / 84 assess / 11 manual — no theirs rows (theirs is a runtime choice, not a static default)
- [Phase 8 P2]: 5 atomic commits per user instruction (SKILL.md / references / Scenario 1 / Scenario 2 / deferred-items) — not 1 combined commit
- [Phase 8 P2]: T-08-02-4 (checkpoint:human-verify) replaced with SELF-VERIFY for autonomous mode; §4 Checklist items marked PASS / DEFERRED with reasoning; user re-verification invited for (c)/(d) in real-merge context
- [Phase 8 P2]: 8 pi.<method> false-positive patterns catalogued in references §"DELETED markers" with rationale (agentapi.X substring collision) — NOT in SKILL.md §3.1 runnable position
- [Phase 8 P2]: §3.1 grep template uses RESEARCH Dimension 3 corrected version (\b word boundaries, types/pi-*.d.ts exclusion) — 0 false-positive hits in dry-runs
- [Phase 9]: Architecture C chosen over A/B — manifest becomes special-cases registry only (~15-20 entries), cross-checked by `scripts/upstream-divergence.ts` (D-31)
- [Phase 9]: Sub-option C2 — manifest sinks into `skills/upstream-merge/references/special-cases.md` (skill-local, not repo-root) (D-32)
- [Phase 9]: Manual trigger only — `npm run upstream:check` runs `tsx scripts/upstream-divergence.ts`; NO pre-commit / pre-merge / CI hook added anywhere (D-33)
- [Phase 9]: 12-category per-file default-resolution matrix inlined into SKILL.md §3.2a (NOT duplicated into special-cases.md or per-category-default.md) (D-35 + Q4)
- [Phase 9]: script exit-code contract: 0 = clean, 1 = stale entries (in-table-not-in-diff), 2 = diverged-not-registered warning; ANSI GREEN/YELLOW/RED; tty auto-detect via `process.stdout.isTTY` (D-34)
- [Phase 9]: 7 atomic commits — one per task/sub-action, not combined (b3d51e8 / 89810e8 / 6350e94 / 72ae020 / b22fdca / 27d067d / 89339ad)
- [Phase 9]: Phase 8 GnuTLS workaround copied verbatim from 08-LEARNINGS.md L-4 into `scripts/upstream-divergence.ts` `fetchUpstream()` (single source of truth for upstream fetch protocol)

## Naming Decisions

Cross-document decisions made at v2.0 milestone close. Resolves the tag-naming collision with upstream `v2.0.0`.

### What changed

- **Git tag renamed:** `v2.0` (created by `gsd-tools.cjs milestone complete v2.0`) → `v2.0.0-universal` (created manually after the push collision was detected).
  - **Old tag:** `v2.0` (`215c52e` → `1f493b1`), created 2026-06-23 09:56 +08:00, pushed to origin 2026-06-23 09:58 +08:00, deleted (local + remote) 2026-06-23 10:00 +08:00.
  - **New tag:** `v2.0.0-universal` (`84bf7e5` → `1f493b1`), created + pushed 2026-06-23 10:05 +08:00. Annotated, tag message documents the SemVer pre-release rationale and the 5 fork-derivative commits on top of upstream `v2.0.0`.

### What did NOT change

- **Milestone internal ID remains `v2.0`** — `STATE.md` frontmatter `milestone: v2.0`, `MILESTONES.md` heading "v2.0 Multi-Agent Adapter Completion", `ROADMAP.md` Milestones section, `PROJECT.md` Current State — all keep the `v2.0` namespace. The milestone is a project-internal concept; the tag is the external release artifact.
- **Archive directory naming remains `v2.0-*`** — `.planning/milestones/v2.0-ROADMAP.md` and `.planning/milestones/v2.0-REQUIREMENTS.md` keep their `v2.0-` prefix. Archive paths reference the milestone ID, not the release tag.
- **Prose in PROJECT.md / MILESTONES.md / ROADMAP.md** — all "v2.0 Multi-Agent Adapter Completion" references stay verbatim; the new tag name is added as an explicit `Release tag:` annotation alongside (not replacing) the milestone name.
- **CHANGELOG.md** — the only `v2.0.0` reference is `https://semver.org/spec/v2.0.0.html` (the upstream SemVer spec URL, unrelated to project tags).

### New requirement

- **Tag naming convention for fork derivative releases:** `vX.Y.Z-{fork-identifier}` where `X.Y.Z` matches the upstream version the fork is derived from, and `{fork-identifier}` is a SemVer pre-release identifier (current value: `universal`).
  - Fork hotfixes: `vX.Y.Z-universal.N` (e.g. `v2.0.0-universal.1` for the first fork hotfix on top of upstream `v2.0.0`).
  - Fork pre-releases: `vX.Y.Z-universal-rc.N` (e.g. `v2.1.0-universal-rc.1`).
  - Upstream sync snapshots (pure upstream drop, no fork changes): `upstream-vX.Y.Z` (no pre-release identifier, marks a clean sync).
- **Why SemVer pre-release identifier:** Per SemVer §11, a pre-release identifier ranks below the release it derives from (`v2.0.0-universal < v2.0.0`). This makes the fork tag visually distinct from upstream while preserving the upstream version anchor in the name. Compatible with git tag filters, npm `--tag` flag, Go modules (with `+incompatible`-style workarounds for pre-release handling), and most CI/CD tag-prefix matchers.
- **Filter patterns:** use `git tag -l 'v*-universal*'` to list all fork releases, `git tag -l 'v[0-9]*'` for all SemVer-shaped tags (both upstream and fork), and `git tag -l 'upstream-v*'` for pure upstream sync snapshots.

### Migration traceability

- **Documents changed in this Amendment:**
  - `.planning/PROJECT.md` — Line 3 (title), Line 6 (new `Release tag:` line), Line 52 (new status note in Current Milestone section), Line 99 (footer).
  - `.planning/MILESTONES.md` — Line 3 (title), Line 5 (new `Release tag:` line).
  - `.planning/STATE.md` — this `## Naming Decisions` section (new).
- **Documents intentionally NOT changed:**
  - `.planning/ROADMAP.md` — milestone name + archive-path references stay as `v2.0`.
  - `.planning/milestones/v2.0-ROADMAP.md` and `.planning/milestones/v2.0-REQUIREMENTS.md` — historical archive, frozen at 2026-06-23 09:53 +08:00 (pre-tag-rename); archive content references the milestone name, not the tag.
  - `CHANGELOG.md` — only `v2.0.0` reference is the upstream SemVer spec URL.
- **Tag operations log (executed):**
  - `git tag -d v2.0` (local delete)
  - `git push origin :refs/tags/v2.0` (remote delete, returned `[deleted] v2.0`)
  - `git tag -a v2.0.0-universal 1f493b1 -m "..."` (annotated create)
  - `git push origin v2.0.0-universal` (remote push, returned `[new tag] v2.0.0-universal -> v2.0.0-universal`)

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
