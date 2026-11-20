# Fork architecture principles

> Moved from `upstream-merge/SKILL.md` §6 (v3.1/v3.2) for progressive disclosure.
> These are background principles for preventing future merge conflicts at the source,
> not steps in the merge execution flow. Section numbers below refer to the main SKILL.md.

**Purpose**: Prevent future merge conflicts at the source, not just resolve them better.
Source: User insight 2026-07-01 ("fork 引入的代码，如果是独立的，应该独立成文件") + retrospective §3.2.1 L1/L2/L3 decision matrix.

## 1. Core principle

**When introducing fork-only code, ALWAYS prefer "独立文件" over "修改 upstream 文件".**

The conflict resolution cost grows with granularity:

| 粒度 | 冲突表现 | 解决成本 |
|------|---------|---------|
| 文件级 | 整个文件 conflict | 🟢 1 行 |
| 段落级 | 文件内某段 conflict | 🟡 需 `resolve-conflicts` skill（plan-first 框架） |
| 函数级 | 同一函数内 conflict | 🟠 需 `resolve-conflicts` skill（plan-first 框架） |
| 行级大块 | 同一函数 343 行同时被改 | 🔴 灾难 |

**Target: 把所有 fork 引入的独立代码推到"文件级"粒度。**

> Note: the old "§4.4 5-step protocol" referenced here in earlier versions was removed in v3.2 — conflict resolution is now delegated to the `resolve-conflicts` skill (main SKILL.md §3.5 / §4.4).

## 2. L1/L2/L3 decision matrix (for current fork state)

> Full matrix in `docs/upstream-merge-retrospective.md` §3.2.1.

| Layer | Category | Action |
|-------|----------|--------|
| **L1** | REPLACEMENTS（9 个 Phase 3 抽象改造）| **接受冲突**——撤回 = 撤销 universal 目标 |
| **L2** | ADDITIONS（8 个 fork 加 universal 段）| 大部分已优化（Phase 12 删除 per-agent）；剩余不值得抽 |
| **L3** | TESTS（~10 个 fork universal 测试）| 按 Plan 14-04 拆 init-elicitation |

## 3. Future-proofing rules (apply to all new fork code)

When adding new fork-only functionality:

1. **New agent adapter** → create `adapters/<new-agent>.ts`, NOT modify `adapters/entry.ts`
2. **New test scenario** → create `__tests__/<new-scenario>.test.ts`, NOT extend existing `__tests__/init-*.test.ts`
3. **New abstract type** → extend `interfaces/agent-api.ts`, NOT import Pi types directly in core
4. **New universal helper** → create `adapters/<helper>.ts` or `utils/<helper>.ts`, NOT add as inline closure in `entry.ts`
5. **New fork-only documentation** → create `docs/<new-topic>.md`, NOT extend `docs/upstream-merge-retrospective.md` in place (use references + cross-links)

**Anti-pattern**: Adding a new `registerCommand` or `registerTool` call inline in `adapters/entry.ts` `createMcpAdapter` body. This creates future merge conflict at the function level (243-line function body).

**Correct pattern**: Create a new file like `adapters/commands/<new-command>.ts` exporting a `setup<NewCommand>(agentapi, getState, getInitPromise)` function, then call that function from `createMcpAdapter`.

## 4. Pre-commit guardrail (CI in Phase 15)

Phase 15 P2-3 will add a CI check that runs:

```bash
# Count: new files vs modified files in this PR
new_files=$(git diff --name-only --diff-filter=A origin/main...HEAD | wc -l)
modified_files=$(git diff --name-only --diff-filter=M origin/main...HEAD | wc -l)

# Warn if too many modifications relative to new files
# (suggests inline additions rather than new file extractions)
ratio=$(echo "scale=2; $modified_files / ($new_files + 1)" | bc)
if (( $(echo "$ratio > 2.0" | bc -l) )); then
  echo "⚠ High modify-to-new ratio: $ratio. Consider extracting independent code to new files."
fi
```

**Target ratio**: ≤ 2.0 modifications per new file. If exceeded, PR review should consider whether fork code could be extracted to a new file.

## 5. Cross-references

- `docs/upstream-merge-retrospective.md` §3.2.1 — full L1/L2/L3 matrix with empirical data (249 fork-only commits, 278 diverged files)
- `docs/upstream-merge-retrospective.md` §2.4 — multi-perspective reflection on conflict granularity
- Main `SKILL.md` §1 — Two-step git merge flow (the merge strategy that this principle supports)

## 6. Code structure optimization: how to reduce future conflicts (v3.2)

Based on the 2026-07-01 first merge attempt (11 conflicts, 249 fork-only commits, 278 diverged files), the following code structure changes would reduce future conflict frequency:

**1. Fork-only code in independent files (not modify upstream files)**

When adding new fork-only functionality, create new files — do NOT add code to upstream files that upstream will also modify:

- ✅ New agent adapter → `adapters/<new-agent>.ts` (not modify `adapters/entry.ts`)
- ✅ New test scenario → `__tests__/<new-scenario>.test.ts` (not extend `__tests__/init-*.test.ts`)
- ✅ New abstract type → extend `interfaces/agent-api.ts` (not import Pi types in core)
- ✅ New universal helper → `adapters/<helper>.ts` or `utils/<helper>.ts` (not inline in `entry.ts`)
- ✅ New fork-only doc → `docs/<new-topic>.md` (not extend `docs/upstream-merge-retrospective.md` in place)

**2. Avoid large functions that both sides will modify** (REVISED 2026-07-02: heuristic, not absolute)

The 2026-07-01 attempt showed `adapters/entry.ts` `createMcpAdapter` (324 lines) as the hardest conflict — both fork and upstream modify the same function body. Break large functions into smaller, independently-modifiable units:

- ❌ One 324-line function → ✅ 4 small functions (~80 lines each) + thin orchestrator
- ❌ Inline session lifecycle in `createMcpAdapter` → ✅ Extract to `setupSessionHandlers()`
- ❌ Inline command registration → ✅ Extract to `registerCommands()`

> **Heuristic, not absolute rule** (REVISED 2026-07-02): "Large function" is not well-defined — 30 lines of pure logic is large, but 300+ lines of YAML/JSON/case-statement config may be reasonable. Use `npm run check:large-functions` (default 300 lines) as a **heuristic indicator**, not an absolute threshold. A function being detected as "large" does NOT automatically mean it should be refactored — **refactor only if**:
>
> 1. The function is in a file that both fork and upstream actively modify (verify with `git log upstream/main..main -- <file>` + `git log main..upstream/main -- <file>`)
> 2. AND the function has been the source of past merge conflicts (check retrospective)
> 3. AND the function's body is "structurally simple" (not just long due to data tables/cases)
>
> If any of the above conditions is false, the line count is not a merge-conflict risk — leave it alone. **The root cause of merge conflicts is "both sides modify the same function", not "the function is long".**

**3. Keep import sections stable**

Import conflicts are the easiest to resolve but still cost time. Minimize import churn:

- Use `interfaces/agent-api.ts` abstractions instead of direct Pi type imports (fork-specific imports don't conflict with upstream Pi imports)
- Group imports consistently (std → external → internal → relative)
- When adding a new dependency, add it in a new file, not in an existing core file

**4. Separate fork-only config from upstream config**

- ✅ Fork config in `.planning/` (fork-only, never conflicts)
- ✅ Fork CI in `.github/workflows/` (fork-only, never conflicts)
- ❌ Fork config inline in `package.json` or `tsconfig.json` (shared with upstream, will conflict)

**5. Run `npm run upstream:check` before every PR**

The `--json` mode (CI-02) provides machine-readable divergence data. Use it to detect new divergence early.
