---
phase: 08
slug: upstream-merge-conflict-resolution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for Phase 8 (Upstream Merge Conflict Resolution).
> **Source:** Derived from `08-RESEARCH.md` → "Validation Architecture" section (Dimension 7 + 8 实测数据).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.6 (existing) |
| **Config file** | `vitest.config.ts` (untouched — Phase 8 不修改 test config) |
| **Quick run command** | `npx vitest run __tests__/adapter-contract.test.ts` |
| **Full suite command** | `npm test` (含 `test:prebuild`) |
| **Estimated runtime** | ~30 s (quick) / ~90 s (full) |

**Phase 8 不引入新单元测试** —— 交付物是 `UPSTREAM-CHANGES.md` (manifest) + `skills/upstream-merge/SKILL.md` (流程文档) + 2 个 dry-run scenario log。但必须把现有 vitest 套件作为 checklist item "全绿"。

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/adapter-contract.test.ts` (确认现有测试不退化)
- **After every plan wave:** Run `npm test` (全套)
- **Before `/gsd-verify-work`:** Full suite must be green + 2 dry-run scenarios 跑通
- **Max feedback latency:** 90 s

---

## Per-Task Verification Map

> **Note:** 该表在 plan 写完后由 planner 填充。每个 task 必须能在此表找到对应行。

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Phase Requirements → Validation Method (1:1)

| Req ID | 验证维度 | 自动化命令 | Manual Review |
|--------|----------|-----------|---------------|
| **UPSTREAM-01** (manifest exists + diverged 文件覆盖) | file-existence + content count | `test -f UPSTREAM-CHANGES.md && [ "$(grep -cE '^\| \`' UPSTREAM-CHANGES.md)" -ge 60 ]` | human review 表格内容 + 类别分布 |
| **UPSTREAM-02** (skill 存在 + 4 section 结构) | file-existence + section count | `test -f skills/upstream-merge/SKILL.md && [ "$(grep -cE '^## [1-4]\.' skills/upstream-merge/SKILL.md)" -eq 4 ]` | human review skill 表达清晰度 |
| **UPSTREAM-03** (Pi-coupling 规则 + grep 模板可执行) | grep 模板跑通 + decision tree 走通 | `git diff upstream/main --name-only -- '*.ts' \| xargs grep -nE '\bExtensionAPI\b\|\bExtensionContext\b' 2>/dev/null` (零误报 `agentapi.X`) | dry-run scenarios 1+2 跑通 |
| **UPSTREAM-04** (minimize-edits 引用) | content check | `[ "$(grep -c 'D-21' UPSTREAM-CHANGES.md)" -ge 1 ]` | human review 是否在 manifest 适当位置引用 |

---

## Dry-run Scenario Validation

Phase 8 plan 必须包含 2 个 dry-run scenarios (per CONTEXT VERIFY-A):

| Must-have | Scenario 1 (假设 OAuth 加入 `init.ts`) | Scenario 2 (假设 `mcp-toggle` command 含 Pi import) |
|-----------|-------------------------------|---------------------------------------|
| Grep 模板可执行 | 0 marker 命中 → 接受 `--theirs` | ≥1 marker 命中 (`@earendil-works/pi-coding-agent`) → 触发 follow-up 流程 |
| Decision tree 完整 | 走 "assess → 0 hit → theirs" 分支 | 走 "assess → ≥1 hit → follow-up issue" 分支 |
| Checklist 6 项全 ✅ | tsc 0 / vitest 全绿 / marker 0 / diff stat 更新 / commit prefix 正确 / 流程文档跑通 | tsc 0 (after follow-up commit) / vitest 全绿 / marker 0 (after follow-up) / commit prefix 正确 + follow-up issue link / 流程文档跑通 |
| Follow-up issue 流程 | 不触发 (无 Pi-coupling) | 触发,issue title `pi-coupling-followup: refactor mcp-toggle`,label `pi-coupling-followup` |
| Resolution log 产出 | log 标记 `theirs` + grep 证据 + outcome | log 标记 `theirs + follow-up` + grep 证据 + outcome + issue ID |

---

## Cross-check Validation (Plan 完成后)

- **UPSTREAM-CHANGES.md 表格行数 vs `git diff upstream/main --name-status`:** 两边行数差 ≤ 10 (vendor/生成文件过滤后)
- **SKILL.md grep 模板 vs RESEARCH Dimension 3 修正版:** SKILL.md 内嵌的 grep 模板必须用 RESEARCH Dimension 3 修正版 (带 `\b` word boundary),**不能用 CONTEXT 原版的 `pi.X` 模式** (RESEARCH 已实测 false-positive)
- **Dry-run log vs manifest 表格:** 每个 scenario 的 "Manifest Default Resolution" 必须能在 `UPSTREAM-CHANGES.md` 中查到对应行
- **D-21 兼容预留:** `UPSTREAM-CHANGES.md` 在 `skills/*` 类别行注明 "per-agent reference 复制 `_template.md`",指向 Phase 7 D-21

---

## Wave 0 Requirements

- [x] **无新 framework install** — vitest 3.2.6 + git + bash 已存在
- [x] **无新 test fixtures** — Phase 8 无单元测试新增
- [x] **无新 conftest / setup files** — 现有基础设施完全覆盖

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `UPSTREAM-CHANGES.md` 表格内容质量 (rationale 列充实度) | UPSTREAM-01 | 需要 human judgement 评估 rationale 是否清晰 | 阅读表格随机抽 5 行,确认 rationale 1-2 行内可读 |
| `skills/upstream-merge/SKILL.md` 流程清晰度 | UPSTREAM-02 | 需要 human 模拟"未来 agent 第一次读"场景 | 找一名未参与本 phase 的 reviewer,让 ta 按 SKILL.md 模拟跑 dry-run scenario 1 |
| Dry-run scenario log 完整性 | UPSTREAM-03 / VERIFY-A | 需要 human 确认 log 字段完整 (decision/grep/outcome 三段齐备) | 阅读两份 dry-run log,逐行 vs RESEARCH dimension 5 模板 |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` with verifiable commands or behaviors
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Phase 8: N/A)
- [ ] No watch-mode flags in commands (`vitest run` instead of `vitest`)
- [ ] Feedback latency < 90 s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner 填充 per-task map)
- [ ] Dry-run scenarios 1+2 covered by at least one plan task each

**Approval:** pending — 待 planner 填充 per-task map 后批准
