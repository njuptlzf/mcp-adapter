# Phase 16 — Upstream-merge 实战 (v3.1 protocols applied)

**Status:** 🚧 PLANNING (2026-07-01)

## Goal

Execute the first real `git merge upstream/main` using the v3.1 SKILL.md §3.5 + §4.2b + §4.4 protocols. Validate that conflict granularity moves from "line-level/function-level" (the 2026-07-01 first attempt) to "file-level/section-level" (per L1/L2/L3 classification in retrospective §3.2.1).

## Source

- `.planning/ROADMAP.md` Phase 16 entry
- `skills/upstream-merge/SKILL.md` §3.5 + §4.2b + §4.4 + §6 (v3.1 deliverables)
- `docs/upstream-merge-retrospective.md` (938 lines, first attempt analysis)

## Planned Plans (3)

1. **16-01-PLAN.md — Pre-merge preparation**
   - Fetch upstream
   - Run `npm run upstream:check -- --json` to see live divergence
   - Compare with 2026-07-01 baseline (278 diverged files)
   - Document expected conflicts based on v3.0/v3.1 fork-only commits

2. **16-02-PLAN.md — Execute `git merge upstream/main`**
   - Resolve conflicts using new protocols:
     - §3.5: Conflict hunk independence check (4 categories)
     - §4.4: Same-function 5-step protocol
     - §4.1: Default `--theirs` policy in `assess` rows
     - §4.2b: 2-step soft follow-up (skip step 2 if `gh` not authenticated)
   - Commit with `upstream-merge:` prefix including `merge-mode` + `pi-coupling-hits` metadata

3. **16-03-PLAN.md — Step 2 propagation + finalization**
   - `git checkout v1.0 && git merge main` per §1 two-step flow
   - Run `npx tsc --noEmit` + `npm test` + `npm run upstream:check`
   - Push to origin
   - Tag new release (v3.1.1-universal or v3.2.0-universal)
   - Open PR

## Expected Outcomes

- **Pre-merge divergence count:** ≤ 278 (no new conflicts beyond v3.1 baseline)
- **Conflict granularity:** all conflicts should be "different function" or "import region" per §3.5 (no "function-level" conflicts)
- **Pi-coupling behavior:** accept upstream by default per §4.1; log hit count in commit body per §5(b)
- **Tests:** 528/528+ tests pass (no regressions)

## Cross-references

- `docs/upstream-merge-retrospective.md` §3.2.1 L1/L2/L3 matrix
- `skills/upstream-merge/SKILL.md` §6 Architecture principles
- `.planning/milestones/v3.1-MILESTONE-AUDIT.md` (108 lines)
- `.github/workflows/check-fork-only-ratio.yml` (post-merge CI guardrail)
- `.github/workflows/check-pi-coupling.yml` (post-merge CI guardrail)
