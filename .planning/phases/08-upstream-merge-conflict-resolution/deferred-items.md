# Deferred Items — Phase 08

Items discovered during Phase 08 plan execution that are out of scope for
the current phase and should be picked up by a later phase, wave, or
human action. Mirrors the Phase 7 `deferred-items.md` pattern: 4
CONTEXT-deferred ideas + the 4-H2-per-item structure.

> **Context source:** `.planning/phases/08-upstream-merge-conflict-resolution/08-CONTEXT.md`
> §"Deferred Ideas" (4 items at planning time).

## CI hook / GitHub Action for divergence detection

- **Found during:** Phase 8 planning (CONTEXT §"Deferred Ideas" item 1).
- **Why deferred:** Out of scope per UPSTREAM-01-D ("manifest is a
  one-shot baseline; future drift detected via standard PR flow").
  Setting up a GitHub Action requires `.github/workflows/` directory +
  secrets + branch protection rules — not appropriate for Phase 8's
  documentation + dry-run delivery.
- **Description:** A `.github/workflows/upstream-divergence.yml` that
  runs on `schedule: cron: '0 6 * * 1'` (weekly Monday 06:00 UTC) and
  on `workflow_dispatch`, executes:
  ```bash
  GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream
  git diff upstream/main --name-status -- '*.ts' '*.md' '*.json' | wc -l
  ```
  and posts a `gh issue create` if the divergence count grows by >N
  files since the last manifest commit.
- **Suggested owner:** A future Phase 9 (or whoever next touches the
  manifest). The hook is small (~30 lines) but needs CI environment
  variables (`GITHUB_TOKEN`) + branch protection understanding.
- **Action taken:** None (out of scope per UPSTREAM-01-D).

## Merge conflict auto-resolve bot

- **Found during:** Phase 8 planning (CONTEXT §"Deferred Ideas" item 2).
- **Why deferred:** The bot would handle `ours`/`theirs` rows
  automatically (per the manifest) and escalate `assess` rows to a
  human. Implementation requires the `gh` CLI + a wrapper script
  (~100 lines) and a CI test matrix. Phase 8 is the **first**
  introduction of the skill; auto-resolving before the skill is
  battle-tested would amplify any false-positive / false-negative in
  the §3.1 grep.
- **Description:** A `scripts/upstream-auto-resolve.sh` that:
  1. Runs `git merge upstream/main`.
  2. For each conflicting file, looks up the row in
     `UPSTREAM-CHANGES.md`.
  3. If `Default Resolution = ours` → `git checkout --ours <path>`.
  4. If `Default Resolution = theirs` → `git checkout --theirs <path>`.
  5. If `Default Resolution = assess` → opens a draft PR with
     conflict markers intact and @-mentions the human reviewer.
  6. If `Default Resolution = manual` → opens the editor (or pauses
     the script).
- **Suggested owner:** A future Phase 9 or 10, after the skill has
  been used in ≥ 3 real merges to validate the §3.1 grep's
  false-positive / false-negative profile.
- **Action taken:** None (out of scope for Phase 8).

## Reverse-contribute upstream PRs

- **Found during:** Phase 8 planning (CONTEXT §"Deferred Ideas" item 3).
- **Why deferred:** Requires a license + contribution agreement
  discussion with the upstream maintainer (Nicobailon). The fork's
  parametric test framework, generic `AgentAPI` interface, and
  `CommandRegistrar` proposal (from dry-run Scenario 2) are all
  candidates for reverse-contribution, but the legal / process
  workflow (CLA, code-style, upstream PR review) is out of Phase 8
  scope.
- **Description:** When a local fork-side improvement (e.g., a
  DECOUPLE refactor, a parametric test extension) is generally
  useful, open a PR to `nicobailon/pi-mcp-adapter` via:
  ```bash
  gh pr create --repo nicobailon/pi-mcp-adapter \
    --head njuptlzf:mcp-adapter-decouple-foo \
    --base main \
    --title "feat: AgentAPI abstraction (mcp-adapter fork)" \
    --body-file .github/reverse-contribute-template.md
  ```
  The `reverse-contribute-template.md` would highlight (a) the
  generic-interface motivation, (b) the parametric test coverage,
  (c) the manifest rationale.
- **Suggested owner:** A future phase, after a discussion with
  upstream maintainer + a CLA / contribution agreement is in place.
- **Action taken:** None (out of scope for Phase 8; legal / process
  work is separate from fork-maintainer workflow).

## Quarterly manifest refresh schedule

- **Found during:** Phase 8 planning (CONTEXT §"Deferred Ideas" item 4).
- **Why deferred:** The manifest is a one-shot baseline (per
  UPSTREAM-01-D); a cron schedule would require a CI hook (deferred
  item 1) to actually run the refresh. Without the hook, a manual
  "quarterly reminder" is the only mechanism, and the maintainer
  (current: njuptlzf) can do that ad-hoc.
- **Description:** Add a calendar reminder / GitHub Issue label
  `upstream-manifest-stale` and a documented refresh procedure:
  ```bash
  # 1. Fetch upstream
  GIT_SSL_NO_VERIFY=1 git -c http.sslVerify=false fetch upstream --tags
  # 2. Re-derive the manifest
  git diff upstream/main --name-status -- '*.ts' '*.md' '*.json' | \
    awk -f scripts/build-manifest.awk > /tmp/upstream-divergence.tsv
  # 3. Update UPSTREAM-CHANGES.md
  node scripts/assemble-manifest.cjs
  # 4. Commit
  git add UPSTREAM-CHANGES.md
  git commit -m "docs(08): refresh upstream manifest @ <sha>"
  ```
- **Suggested owner:** The fork maintainer (njuptlzf) on a
  quarterly cadence (every 3 months). The skill's §2 already
  documents the freshness check (`|raw - manifest| ≤ 10`), so
  drift is visible to the agent on every merge.
- **Action taken:** None (out of scope for Phase 8).
