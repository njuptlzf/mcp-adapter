# Phase 8: Upstream Merge Conflict Resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 8 — Upstream Merge Conflict Resolution
**Areas discussed:** UPSTREAM-01 manifest 范围与粒度, UPSTREAM-02 skill 决策格式, UPSTREAM-03 冲突解决规则边缘, 如何验证 manifest + skill 有效

---

## UPSTREAM-03 冲突解决规则边缘 (核心 — 优先讨论)

| Option | Description | Selected |
|--------|-------------|----------|
| 添加 per-file 类别决策 | adapters/<agent>/* 保留 ours,core MCP logic 接受 theirs,hybrid 手动 | ✓ (part of selected) |
| 定义 "Pi-coupling-free" 检测方法 | grep `ExtensionAPI` / `ExtensionUIContext` / `ExtensionContext` / `AgentToolResult` / `PI_CODING_AGENT_DIR` / `pi-ai` / `pi-tui` / `pi-coding-agent` 关键字 | ✓ (part of selected) |
| Upstream 引入 Pi-coupling 时的例外流程 | 接受 upstream diff → 立即本 fork follow-up commit 抽 adapter → 开 follow-up issue | ✓ (part of selected) |
| 三个都考虑 (推荐) | 完整规则集 — manifest 增加 Pi-coupling marker list, skill 提供决策树 | ✓ |

**User's choice:** 三个都考虑 (推荐)
**Notes:** 用户希望规则集最完整。Pi-coupling marker grep 列表必须在 skill 中可直接 copy-paste(已在 CONTEXT UPSTREAM-02-B 固化)。follow-up issue 流程确保不阻塞 merge 阶段。

---

## UPSTREAM-01 manifest 范围与粒度

| Option | Description | Selected |
|--------|-------------|----------|
| 只列 diverged 文件 (推荐) | 状态(new/modified/deleted) + 类别 + default resolution + rationale | ✓ |
| 全 tracked files 覆盖 | source + tests + docs + config 全部 | |
| 只列需要决策的文件 | 复杂问题文件才记录,零冲突文件跳过 | |

**User's choice:** 只列 diverged 文件 (推荐)
**Notes:** 用户偏好最小化 manifest 体积,方便 agent grep 定位。"未变文件" 通过 `git diff upstream/main --name-status` 自然过滤,无需手动维护。

### Manifest 详度

| Option | Description | Selected |
|--------|-------------|----------|
| 表格 + 短 rationale (推荐) | 5 列表格(路径/状态/类别/默认决策/1-2 行 rationale) | ✓ |
| 按类别分组 + 每文件段 | 按 adapter/interface/skill 分组,每文件 1 段 | |
| YAML 结构化 | 机器友好,人类可读性差 | |

**User's choice:** 表格 + 短 rationale (推荐)
**Notes:** 5 列 schema 适合 agent grep + 人类 review。rationale 1-2 行足够,长 rationale 拆到 LEARNINGS.md。

---

## UPSTREAM-02 skill 决策格式

| Option | Description | Selected |
|--------|-------------|----------|
| Step + decision tree + checklist (推荐) | 1) 何时调用 2) 读 manifest 3) 决策树 4) checklist | ✓ |
| 只提供决策表 | File category × Upstream change type → Resolution | |
| 示例驱动 | 1 个 hypothetical scenario 走一遍 | |

**User's choice:** Step + decision tree + checklist (推荐)
**Notes:** 4 个 section 覆盖 merge 全流程。decision tree 按文件类别分支,checklist 包含 Pi-coupling marker = 0 + tsc + vitest + diff stat 4 项验证。

---

## 验证:如何验证 manifest + skill 有效

| Option | Description | Selected |
|--------|-------------|----------|
| Plan 包含 dry-run task (推荐) | 2 个 hypothetical upstream 变更(OAuth in init.ts, mcp-toggle in commands.ts with Pi import)走一遍 | ✓ |
| 纯文档交付 + 静态检查 | manifest 跟 git diff upstream 交叉检查,skill 留给 future trigger | |
| 添加 divergence check script | `scripts/check-upstream-divergence.sh` 长期 CI hook | |
| 两个都做 (推荐) | dry-run + script | |

**User's choice:** Plan 包含 dry-run task (推荐)
**Notes:** 用户偏好 scope 收敛 — dry-run 验证 skill 可用即可,不引入新 CI script(避免 GitHub Actions 配置 scope creep)。divergence check script 留作 deferred(已在 CONTEXT deferred section 记录)。

---

## the agent's Discretion

以下 4 项留给 agent 实施时决定(CONTEXT.md 已记录):
- **DISCRETION-A:** skill 文件的具体 prose 风格
- **DISCRETION-B:** manifest 表格排序方式(按路径/按 Category/按 Status)
- **DISCRETION-C:** dry-run log 放在 `.planning/phases/08/...` 还是 `docs/`
- **DISCRETION-D:** SKILL.md 内的具体行数 / 章节标题

## Deferred Ideas

(Captured in CONTEXT.md §"Deferred Ideas" — 3 items:)
- CI hook / GitHub Action 自动化 divergence check — 未来 follow-up
- Merge conflict 自动 resolve bot — 未来 follow-up
- upstream patch 反向 contribute — 未来 follow-up
- 定期 manifest 刷新 schedule — 未来 follow-up
