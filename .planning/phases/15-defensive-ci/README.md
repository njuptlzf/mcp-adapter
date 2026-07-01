# Phase 15 — Defensive CI (P2 from retrospective)

**Status:** ✅ COMPLETE (2026-07-01)

## Deliverables

3 CI deliverables shipped (CI-01 + CI-02 + CI-03):

1. **CI-01**: `.github/workflows/check-pi-coupling.yml` (54 lines) — Advisory Pi-coupling re-introduction detection in `src/` core (excludes `adapters/`, `types/`, `__tests__/`)
2. **CI-02**: `scripts/upstream-divergence.ts --json` mode (24 lines added) + JSON Schema v1.0 documentation in `docs/upstream-merge-retrospective.md` §13 (75 lines)
3. **CI-03**: `.github/workflows/check-fork-only-ratio.yml` (101 lines) — Modify-to-new ratio target ≤ 2.0 (WARN at >2.0, FAIL at >5.0)

## Source

- `docs/upstream-merge-retrospective.md` §3.3 P2-1, P2-2, P2-3
- `skills/upstream-merge/SKILL.md` §6.4 Pre-commit guardrail

## Verification

- All 3 YAML files validated with `python3 -c "import yaml; yaml.safe_load(open('...'))"`
- `--json` output tested manually: valid JSON, exit 0
- tsc exit 0, npm test 528/528 PASS, npm run upstream:check exit 0

## Cross-references

- `skills/upstream-merge/SKILL.md` §6.4 — pre-commit guardrail principle
- `docs/upstream-merge-retrospective.md` §3.2.1 — L1/L2/L3 matrix that CI-03 enforces
- `docs/upstream-merge-retrospective.md` §13 — CI-02 JSON Schema v1.0
