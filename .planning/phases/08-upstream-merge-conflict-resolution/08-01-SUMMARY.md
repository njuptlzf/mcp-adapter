---
phase: 08-upstream-merge-conflict-resolution
plan: 01
subsystem: fork-maintenance
tags: [upstream, manifest, divergence, fork-maintainer, upstream-01, upstream-04]
provides:
  - UPSTREAM-CHANGES.md (5-column divergence manifest, 209 rows)
  - /tmp/upstream-divergence.tsv (intermediate TSV, 209 rows, 10 categories)
requires: []
affects:
  - Plan 08-02 (will read this manifest before authoring SKILL.md)
tech-stack:
  added: []
  patterns:
    - 5-column markdown table schema (Path/Status/Category/Default Resolution/Rationale)
    - awk-based initial-fill classifier (10 path regexes → 10 categories)
    - GnuTLS workaround for `git fetch upstream`
key-files:
  created:
    - UPSTREAM-CHANGES.md (247 lines, 209 data rows)
    - /tmp/upstream-divergence-raw.txt (209 lines raw diff)
    - /tmp/upstream-divergence.tsv (209 lines categorised)
  modified: []
decisions:
  - "Manifest is initially-filled by `git diff upstream/main --name-status -- '*.ts' '*.md' '*.json'` + awk classifier, then refined by judgment (per UPSTREAM-01-C)."
  - "D-21 cited in 4 rows: skills/mcp-adapter-test/SKILL.md + 3 references/agent-paths/<id>.md (UPSTREAM-04 merge-friendly anchor)."
  - "DECOUPLE-XX cited in 8 rows: DECOUPLE-01 (proxy-modes, direct-tools), DECOUPLE-02 (sampling-handler, elicitation-handler), DECOUPLE-06 (tool-result-renderer + 2 follow-up residuals), DECOUPLE-07 (agent-dir)."
  - "Default Resolution distribution: 114 ours / 84 assess / 11 manual (matches CONTEXT 12-category table)."
  - "Three known Pi-coupling residuals explicitly tagged: mcp-panel.ts + mcp-setup-panel.ts (DECOUPLE-06 follow-up needed) + index.ts (D-04 backward-compat)."
metrics:
  duration_minutes: 18
  completed_date: 2026-06-18
  tasks_completed: 3
  files_modified: 1
  manifest_rows: 209
  manifest_lines: 247
---

# Phase 8 Plan 1: UPSTREAM-CHANGES.md Manifest Summary

## Summary

Authored `UPSTREAM-CHANGES.md` at the repo root: a 5-column (Path / Status / Category / Default Resolution / Rationale) fork-vs-upstream divergence manifest. The manifest is initially-filled by `git diff upstream/main --name-status -- '*.ts' '*.md' '*.json'` + awk classifier, then refined by judgment (per UPSTREAM-01-C). It covers all 209 diverged files across 10 categories (adapter / interface / source / skill / test / docs / config / planning / agents_meta / other), sorted by Category then Path (DISCRETION-B). D-21 is cited 4× in the skill rows (UPSTREAM-04 anchor); DECOUPLE-01/02/06/07 are cited 8× across the source rows. The three known Pi-coupling residuals (`mcp-panel.ts`, `mcp-setup-panel.ts`, `index.ts`) are explicitly tagged in both the table Rationale column and the Special-cases footnotes section.

Plan 08-02 may now author `skills/upstream-merge/SKILL.md` against this manifest without re-running `git fetch upstream` (the ref is already local at `a764c25`).

## Commands run

```bash
# === Step 1: assert upstream remote exists ===
git remote get-url upstream
# → https://github.com/nicobailon/pi-mcp-adapter.git (exit 0)

# === Step 2: fetch upstream (GnuTLS-safe incantation) ===
GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags 2>&1 | tail -20
# (--unshallow failed: "fatal: --unshallow on a complete repository does not make sense";
#  omitted; plain `fetch --tags` succeeded silently)

# === Step 3: raw diff ===
git diff upstream/main --name-status -- '*.ts' '*.md' '*.json' > /tmp/upstream-divergence-raw.txt
wc -l /tmp/upstream-divergence-raw.txt
# → 209 /tmp/upstream-divergence-raw.txt

# === Step 4-5: awk classifier with vendor filter ===
git diff upstream/main --name-status -- '*.ts' '*.md' '*.json' 2>/dev/null | awk '
$1=="A" {status="new"; path=$2}
$1=="M" {status="modified"; path=$2}
$1=="D" {status="deleted"; path=$2}
{ if (path ~ /^node_modules\//) next
  if (path ~ /^dist\//) next
  if (path ~ /^coverage\//) next
  if (path ~ /^tests\/reports\//) next
  if (path ~ /app-bridge\.bundle\.js$/) next
  if (path ~ /^examples\/.*\/dist\//) next
  if (path ~ /^\.planning\//) cat="planning"
  else if (path ~ /^skills\//) cat="skill"
  else if (path ~ /^adapters\//) cat="adapter"
  else if (path ~ /^interfaces\//) cat="interface"
  else if (path ~ /^(__tests__|tests|examples)\//) cat="test"
  else if (path ~ /^(README|MAPPING|CHANGELOG|OAUTH)\.md$/) cat="docs"
  else if (path ~ /^(package\.json|package-lock\.json|vitest\.config\.ts|tsconfig\.json|\.gitignore|\.npmignore)$/) cat="config"
  else if (path ~ /^(AGENTS|CLAUDE)\.md$/) cat="agents_meta"
  else if (path ~ /^\.claude\//) cat="agents_meta"
  else if (path ~ /^[a-zA-Z][a-zA-Z0-9_.-]*\.ts$/) cat="source"
  else if (path ~ /^types\//) cat="source"
  else cat="other"
  print status "\t" cat "\t" path }' | sort -k2,2 -k3,3 > /tmp/upstream-divergence.tsv

# === Step 6: assemble manifest via node script ===
node /tmp/build-manifest-rows.cjs > /tmp/manifest-rows.md   # 209 rows
node /tmp/assemble-manifest.cjs                              # writes UPSTREAM-CHANGES.md

# === Validation commands (per VALIDATION.md) ===
test -f UPSTREAM-CHANGES.md && echo "UPSTREAM-01 file-existence: PASS"
grep -cP '^\| \`' UPSTREAM-CHANGES.md         # → 209
grep -c 'D-21' UPSTREAM-CHANGES.md            # → 6
grep -cE 'DECOUPLE-(01|02|06)' UPSTREAM-CHANGES.md   # → 12

# === Static alignment (per Task 3 Step 1) ===
RAW=$(wc -l < /tmp/upstream-divergence-raw.txt)        # 209
MANIFEST=$(grep -cP '^\| \`' UPSTREAM-CHANGES.md)      # 209
DIFF=$((RAW - MANIFEST))                              # 0  → PASS (|DIFF| ≤ 10)

# === Pre-commit audit (per AGENTS.md) ===
npx --no-install gitnexus detect-changes --repo mcp-adapter
# → "No changes detected." (markdown-only commit; no code symbols affected)
```

## Files changed

- **Created** `UPSTREAM-CHANGES.md` (247 lines, 209 data rows; 5 H2 sections: subtitle / Decision anchors / Divergence manifest / Special-cases footnotes / Generation notes)
- **Created (intermediate, /tmp)** `/tmp/upstream-divergence-raw.txt` (209 lines raw diff)
- **Created (intermediate, /tmp)** `/tmp/upstream-divergence.tsv` (209 lines tab-separated; sorted by Category then Path)
- **Created (intermediate, /tmp)** `/tmp/manifest-rows.md` (209 markdown data rows)

No existing tracked files were modified. `git status` shows only `UPSTREAM-CHANGES.md` as untracked before commit.

## Acceptance evidence

- `UPSTREAM-01 file-existence: PASS` (`test -f UPSTREAM-CHANGES.md` exits 0)
- `UPSTREAM-01 content count: PASS` (209 ≥ 60)
- `UPSTREAM-04 anchor: PASS` (6 D-21 citations; ≥ 1 required)

### Additional checks (per plan)

- `mcp-panel.ts` row contains "follow-up needed" Rationale (1× table + 1× footnote)
- `mcp-setup-panel.ts` row contains "follow-up needed" Rationale (1× table + 1× footnote)
- `panel-keys.ts` row contains "deprecated" / "do NOT" / "removed" rationale (1× table + 1× footnote)
- `index.ts` row Rationale contains "backward-compat" + "D-04 / ENTRY-02 / 05-05"
- `skills/mcp-adapter-test/SKILL.md` row Rationale contains "D-21" + "per-agent references 复制 `_template.md`"
- `interfaces/agent-api.ts` envHints row Rationale cites D-01..D-03 Capability Gate (legal Pi-coupling)
- H2 heading count = 5 (subtitle + Decision anchors + Divergence manifest + Special-cases footnotes + Generation notes) — ≥ 5 required

### Default Resolution distribution (sanity check)

- `ours` — 114 rows (fork-only: adapter / skill / planning / agents_meta / other + selected source)
- `assess` — 84 rows (core MCP logic + tests; Pi-coupling marker grep required)
- `manual` — 11 rows (interfaces / config / docs; human review required)

This matches CONTEXT §"UPSTREAM-03-A 12-category table" expectations:
- 0 `theirs` (no `theirs` rows — `theirs` is a runtime choice made by agent, not a static default)

## Alignment exceptions

**None** — Static alignment passed: `|RAW - MANIFEST| = 0` (RAW=209, MANIFEST=209). Per-file reconciliation via `comm` showed zero extras and zero missing files between the raw diff and the manifest table. No `## Alignment exceptions` section is needed.

## Issues encountered

1. **`--unshallow` failed in Step 2 fetch:** The GnuTLS-safe fetch with `--unshallow` returned `fatal: --unshallow on a complete repository does not make sense`. Resolution: dropped the `--unshallow` flag (the local clone is already complete — RESEARCH Dimension 8 verified this assumption). Plain `GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags` succeeded silently.

2. **zsh escaping quirk on `grep -cE '^\| \`'`:** The literal pattern from the plan's verify command trips zsh's quote handling. Used `grep -cP '^\| \`'` (PCRE) instead for accurate row count. The `grep -cP` output is identical to what `grep -cE` would produce in bash; the underlying regex behavior is the same.

3. **`gitnexus detect-changes` returned "No changes detected":** Expected — `UPSTREAM-CHANGES.md` is a pure-markdown documentation artefact with no indexed code symbols. Per AGENTS.md audit-trail requirement, this confirms blast radius = empty (no source-file impact). The 5-column markdown table contains only file paths, not code symbols, so the index has nothing to map. This is the desired outcome per Task 3 Step 4 note: "This commit only modifies markdown files (no code symbol), so the gitnexus blast radius is empty; running `npx gitnexus detect-changes` is for AGENTS.md audit-trail compliance, not for catching regressions."

4. **Plan-prescribed `panel-keys.ts` rationale ("deleted in upstream, kept in fork") contradicts reality:** The actual `git diff upstream/main` shows `panel-keys.ts` as Status=deleted in fork's perspective — the file exists in upstream but was removed from fork. The plan's verbatim rationale has the direction inverted. Resolution: used a corrected rationale ("**ours (deleted in fork)** — present in upstream; **fork removed it** (legacy; not referenced after D-04 Phase 3). Keep fork-side deletion; do NOT `git checkout --theirs panel-keys.ts` (would re-add an unused file).") which matches reality and the spirit of the plan's 4-step deleted-file rule. The Special-cases footnote also documents the fork-side deletion explicitly. **Impact: deviation documented; correctness preserved (the rationale still says "do not re-add from upstream" which is the intent).**

## Deviations from plan

### Auto-fixed issues (per execution deviation rules)

**1. [Rule 1 - Bug] Plan-prescribed `panel-keys.ts` rationale had inverted direction**
- **Found during:** Task 2 (writing manifest rows)
- **Issue:** Plan template said "deleted in upstream, kept in fork" but the actual data shows the file exists in upstream and the fork has removed it (opposite direction).
- **Fix:** Wrote a corrected rationale that matches the data and preserves the plan's intent (do NOT re-add from upstream).
- **Files modified:** `UPSTREAM-CHANGES.md` (one table row + one footnote)
- **Commit:** (this commit)

### Plan-prescribed adaptations

**2. [Plan adaptation] H2 subtitle as `##` heading (per plan structure hint)**
- **Context:** Plan acceptance criterion `grep -c '^## ' UPSTREAM-CHANGES.md ≥ 5` requires 5 H2 sections. Initially wrote 4 H2 sections (Decision anchors / Divergence manifest / Special-cases footnotes / Generation notes).
- **Fix:** Promoted the subtitle ("Tracks every file diverged from upstream…") from plain text to `##` heading per the plan's "H2 subtitle" label.
- **Files modified:** `UPSTREAM-CHANGES.md` (1 line)
- **Rationale:** Plan's "(Decision anchors / Divergence manifest / Special-cases footnotes / Generation notes + the 2 preamble headings)" count of 5 implies the subtitle is one of the 2 preamble headings, making it a `##`.

## Next steps

1. **Plan 08-02 may now begin** authoring `skills/upstream-merge/SKILL.md` + dry-run log against this manifest without re-running `git fetch upstream` (the ref is already local at `a764c25`).
2. **The manifest is a one-shot baseline** (per UPSTREAM-01-D). Future upstream sync = regenerate via PR re-running `git diff upstream/main --name-status` and updating the 5-column table.
3. **No CI hook** is created (per UPSTREAM-01-D, no scope creep). Manifest staleness detection relies on the standard PR flow.
4. **The 3 known Pi-coupling residuals** (`mcp-panel.ts` / `mcp-setup-panel.ts` / `index.ts`) are tagged and the rationale field makes them grep-able. Future Phase 9 follow-up should decouple `mcp-panel.ts` + `mcp-setup-panel.ts` behind the generic `RenderOutput` interface (DECOUPLE-06 expansion).

## Self-check

- [x] UPSTREAM-CHANGES.md exists (247 lines, 209 data rows)
- [x] 4 anchor sections present (Decision anchors / Divergence manifest / Special-cases footnotes / Generation notes) + 1 subtitle
- [x] D-21 cited 6× (4 in skill rows + 2 in Decision anchors)
- [x] DECOUPLE-01/02/06/07 cited 12× (table + Decision anchors)
- [x] Static alignment: |RAW - MANIFEST| = 0 (no exceptions section needed)
- [x] /tmp/upstream-divergence-raw.txt + /tmp/upstream-divergence.tsv present for Plan 08-02 cross-validation
- [x] All 5 acceptance commands PASS (per VALIDATION.md Per-Task Verification Map T-08-01-1/2/3)

## Self-Check: PASSED
