---
phase: 09-upstream-manifest-architecture-c
gathered: 2026-06-22
status: ready-for-planning
user_signed_off: 2026-06-22 (5/5 open questions resolved — see §user_decisions)
decides_upstream_decisions: D-31, D-32, D-33, D-34, D-35
supersedes: Phase 8 UPSTREAM-01-A, UPSTREAM-01-B, UPSTREAM-01-C
preserves: Phase 8 UPSTREAM-01-D, UPSTREAM-02..04
---

# Phase 9: Upstream Manifest Architecture C Refactor — Context

**Gathered:** 2026-06-22
**Status:** Ready for planning — user signed off 2026-06-22 (5/5 open questions resolved)

<domain>
## Phase Boundary

Phase 9 是 Phase 8 的**架构修正**——用 Architecture C 替换 Phase 8 决策的 UPSTREAM-01 manifest 设计。

**Phase 8 留下的产物**(本次不修改,只 superseded):
- `UPSTREAM-CHANGES.md`(51KB / 209 行 / 仓库根)—— Phase 9 退役
- `skills/upstream-merge/SKILL.md`(4 section)—— Phase 9 修改 §2 引用,其余不动
- `UPSTREAM-04` 工程面(adapters + wrapper 模式)—— 仍在 Phase 5/6/7 中,通过 D-21 落地,不动
- `__tests__/compatibility/` + `scripts/qoder-smoke.ts`—— 测试不变

**Phase 9 交付物**(本次新做):
1. **退役** `UPSTREAM-CHANGES.md`(仓库根)
2. **新建** `skills/upstream-merge/references/special-cases.md`(~40 行,~15-20 个特殊文件)
3. **新建** `scripts/upstream-divergence.ts`(~50 行,TypeScript,freshness checker)
4. **修改** `skills/upstream-merge/SKILL.md` §2(改 7 处引用,其余 142 行不动)
5. **新建** `package.json` scripts 字段 `upstream:check`(1 行)

**Phase 9 不做**(显式 scope boundary):
- ❌ 不改 `UPSTREAM-04` adapter 模式(已在 Phase 5/6/7 完成)
- ❌ 不改 Pi-coupling marker grep(D-24, §3.1 不变)
- ❌ 不改 5-step follow-up flow(D-25, §3.2 不变)
- ❌ 不改 6-item merge checklist(D-26, §4 不变,只把 (e) "manifest alignment check" 改为 "divergence script exit 0")
- ❌ 不加 pre-commit / pre-merge hook(D-33,显式 NOT)
- ❌ 不删 UPSTREAM-03 conflict resolution rules(D-23 12-category matrix 内联到 SKILL.md,功能不变)
- ❌ 不动 .planning/ 现有 8 个 phase 目录

</domain>

<decisions>
## Implementation Decisions

### D-31 (supersedes UPSTREAM-01-A/B/C) — Architecture C: special-cases only manifest

**Decision:** `UPSTREAM-CHANGES.md` 从"全 diverged 文件清单"(209 行)重构为"特殊文件 registry"(~15-20 行)。Manifest 只记录**不能由 §3.1 默认类别规则自动决定**的文件,其余 ~190 个文件由 `SKILL.md` 内联的 12-category 矩阵(D-32)按类别 default 处理。

**Schema**(4 列,比 Phase 8 5 列简化):

```
| Path | Status | Why special | Decision |
```

- **Path** — repo-relative 路径 (e.g. `index.ts`)
- **Status** — `fork-only` / `decoupled-wrapper` / `deleted-in-fork` / `sibling-config` / `framing-divergence`
- **Why special** — 1 行,说明为什么不能走 §3.1 类别 default(链接到 D-XX / Phase XX)
- **Decision** — `ours` / `manual` / `assess` / `wraps-theirs`

**Why it matters:**
- ~190 个 .planning/ / tests/ / types/ 等文件不再需要各自 Rationale 列(全部由类别规则默认 `ours` / `assess` 处理),消除 Phase 8 UPSTREAM-CHANGES.md 80% 的内容冗余
- Manifest 从 51KB / 209 行降到 ~40 行 / 15-20 条,可放进 SKILL.md 同一目录,成为 skill 的"已知特殊 case"附录
- Rationale 字段从"每个文件重复相同一句话"变成"每个特殊 case 独有的理由",signal-to-noise 比改善 10×

**Trade-off accepted:** Manifest 不再覆盖完整 diverged 文件列表,**必须配合 `scripts/upstream-divergence.ts` 使用**——脚本实时跑 `git diff` 给出 diverged 列表,与 registry 交叉检查。这就把 Phase 8 的"维护成本"(per UPSTREAM-01-D 重新生成 manifest)转嫁给了"运行成本"(每次 merge 跑一次脚本),但运行成本低(~5s)且 100% 准确。

**Reusable as:** "Special-cases only manifest + category-default rules + cross-check script" 是任何"agent 流程 vs 完整数据"权衡场景的通用模式。例如:lint 规则白名单、设计 token 覆盖表、API 路由兼容性表都可套用本模式。

---

### D-32 (sub-option of D-31) — Sink special-cases into `skills/upstream-merge/`

**Decision:** Special-cases registry 的物理位置:

```
skills/upstream-merge/
├── SKILL.md                     ← Phase 9 修改 §2 7 处引用
└── references/
    ├── pi-coupling-markers.md   ← Phase 8 已建,不动
    ├── per-category-default.md  ← Phase 9 删除(内容已内联到 SKILL.md §3.2 per D-35)
    └── special-cases.md         ← Phase 9 新建,~40 行
```

**Why C2 over C1 / C3:**
- **C1 (repo root + references/template/):** 引用路径 3 段(`skills/upstream-merge/references/special-cases.md`),agent 路径解析多 1 跳;C2 只有 1 跳
- **C2 (full descent to skill):** Manifest 与 SKILL.md 同目录,`SKILL.md` §2 用相对路径引用(`references/special-cases.md` 即可),agent 直接 read;`scripts/upstream-divergence.ts` 用 `path.resolve(__dirname, '../skills/upstream-merge/references/special-cases.md')` 解析
- **C3 (inline in SKILL.md):** SKILL.md 膨胀到 ~200 行;agent 读全文比读 references/ 慢;registry 与 SKILL.md 生命周期耦合(改一个必须改另一个)

**Trade-off accepted:** Special-cases registry 不再在仓库根,`git grep UPSTREAM-CHANGES.md` 会失效。Mitigation:`SKILL.md` 头部新增 1 行 "Retired UPSTREAM-CHANGES.md? See `references/special-cases.md`";`scripts/upstream-divergence.ts` 输出会同时打印 "scanning: skills/upstream-merge/references/special-cases.md",提供线索。

**Why it matters:** Sub-option C2 是 D-31 的物理落地。Phase 8 把 manifest 放仓库根是把 manifest 当 "documentation"(广义可达性优先);Phase 9 把 manifest 放 skill references/ 是把 manifest 当 "skill input"(功能内聚性优先)。Phase 9 的核心修改是"把 manifest 从 doc 变成 skill 的一部分"。

---

### D-33 (preserves + sharpens UPSTREAM-01-D) — Manual trigger only

**Decision:** Divergence check **仅手动触发**,不加任何自动化 hook。三个具体含义:

1. **No pre-commit hook:** 不在 `.husky/pre-commit` 里跑 `npm run upstream:check`(会污染日常 commit 噪声)
2. **No pre-merge hook:** 不在 `.husky/pre-merge-commit` 里跑(用户主动 merge 时跑一次即可,不要 hook 强迫)
3. **No CI hook:** 不在 `.github/workflows/` 里跑(GitHub Actions fork 上游经常 403/超时,触发频率低,价值低)
4. **Manual invocation surface:**
   - `npm run upstream:check` (1 行 npm script 包装)
   - `npx tsx scripts/upstream-divergence.ts` (直接调用,无 wrapper)
   - `SKILL.md` §2 step 1("before merge")人工提示 agent 跑一次

**Why A only (not A+B):**
- B(commit-time hook)每次 commit 跑 ~3s × 100+ commits/day = ~5min/天纯噪声
- B 重复了 merge-time hook 的工作(merge 时也会跑),没有额外信号
- B 违反 Phase 8 UPSTREAM-01-D "no CI hook" 原则(commit hook 是 CI hook 的子集)
- A+B 的"正确组合"就是把 A 包装为 npm script(就是 D-33 已实现的方案)

**Trade-off accepted:** 用户忘记跑脚本时,divergence drift 不被自动检测。Mitigation:`SKILL.md` §2 step 1 明确写 "Step 1: run `npm run upstream:check` BEFORE any merge attempt";§4 checklist (a) 改成 "divergence check script exit 0"。

---

### D-34 (new requirement UPSTREAM-05) — `scripts/upstream-divergence.ts` contract

**Decision:** 新建 TypeScript 脚本 `scripts/upstream-divergence.ts`,行为契约:

**Input:**
1. `git diff upstream/main --name-status -- '*.ts' '*.md' '*.json'`(Phase 8 GnuTLS workaround 复用)
2. `skills/upstream-merge/references/special-cases.md`(registry table,4 列)

**Output**(stdout,plain text + ANSI color by default;`--no-color` to disable;CI/non-tty auto-disables):

```
[divergence-check] upstream ref: main, scanned 209 files

\u001b[32m✓ registered (15):\u001b[0m
   index.ts → ours (D-04 backward-compat wrapper)
   ...

\u001b[33m⚠ diverged-but-not-registered (194): [category: assess]\u001b[0m
   adapters/pi-adapter.ts
   __tests__/pi-adapter.test.ts
   ...

\u001b[31m✗ stale (registry entry no longer diverged) (2):\u001b[0m
   panel-keys.ts  (file not in git diff — file deleted upstream?)
   ...

[divergence-check] summary: 209 diverged, 15 registered, 194 default-resolved by category, 2 stale
[divergence-check] exit: 1 (stale entries require manual review)
```

**Exit code:**
- `0`: 无 stale entries(diverged-but-not-registered 是 warning,exit 0)
- `1`: 有 stale entries(需要维护者清理 registry)
- `2`: git fetch 失败 / upstream ref 不存在 / registry 解析失败

**Stdout 字段:**
- `upstream ref`: 实际 fetch 的 ref
- `scanned N`: 实际 `git diff --name-status` 输出行数
- `registered (X)`: registry 中标为 `decoupled-wrapper` / `deleted-in-fork` 等且当前确实 diverged 的文件
- `diverged-but-not-registered (Y)`: 当前 diverged 但 registry 没列(默认按 §3.1 类别规则处理,这是 warning)
- `stale (Z)`: registry 列出但当前 `git diff` 不返回(可能 upstream 已追上,需要清理)
- `summary`: 4 个数字 + 一行结论

**Why it matters:** 脚本是 Phase 9 的"运行正确性"保证。没有它,registry drift 没人发现;有它但没正确分类,会噪声淹没信号。3 分类(registered / diverged-not-registered / stale)对应 3 种 action(✓ 默认 / ⚠ 警告但不阻塞 / ✗ 阻塞并需清理),action surface 最小化。

**Trade-off accepted:** 脚本不直接执行 merge / 不自动 commit / 不调用 §3.1 grep——纯 information tool。Merge 决策权仍归 agent / 维护者。Mitigation:脚本输出在 `stale > 0` 时 exit 1,`SKILL.md` §2 step 1 写 "if exit 1, STOP and clean registry first"。

---

**Color rules** (per Q2 user decision, default ON):
- **GREEN (`\u001b[32m…\u001b[0m`):** registered entries, summary header
- **YELLOW (`\u001b[33m…\u001b[0m`):** diverged-but-not-registered warnings
- **RED (`\u001b[31m…\u001b[0m`):** stale entries, fatal errors
- **Auto-detect tty:** If `!process.stdout.isTTY` (CI / piped / redirected), color auto-disabled
- **`--no-color` flag:** Force plain text even in tty (for grep-friendly output)
- **`--color` flag:** Force color even in non-tty (for log files)

**Why it matters:** Color turns the 3-category classification (registered / diverged / stale) into a glanceable visual. Without color, an agent parsing 200+ rows has to read each line's prefix character; with color, the eye filters in < 1s.

**Trade-off accepted:** ANSI escape sequences break pure-text grep (`grep '\\u001b[31m' file` returns 0 hits). Mitigation: `--no-color` flag + auto-detect non-tty.

---

### D-35 (preserves + relocates D-23) — Inline 12-category matrix into SKILL.md

**Decision:** Phase 8 的 D-23 12-category per-file default-resolution matrix(原位于 `references/pi-coupling-markers.md §"Per-category default"`)**完整原文内联到 `SKILL.md` §3.2**,作为"Decision tree → 类别 default"表格。

**为什么内联(而非引用):**
- Agent 在 §3 读 SKILL.md 时,category default 应该**与 decision tree 同页可见**(降低 context switch)
- References/ 是"detail expansion",§3 已经是 detail;再跳一层会让 agent 漏读
- Phase 8 之所以放 references/,是因为 manifest 在仓库根,SKILL.md 引用 manifest 时需要 references/ 解释 manifest 的 schema;Phase 9 没有 manifest 后,schema 直接进 SKILL.md,没有第二层

**Schema 内联格式**(原文照搬 D-23 表格,加 1 列 link to D-XX):

```
| Category | Default | Rationale | Source |
|---|---|---|---|
| `adapters/<agent>/*` | `ours` | Fork-only; upstream doesn't add adapters | D-21 |
| `adapters/entry.ts` | `ours` | Frozen signature per D-07 | D-07 |
| `skills/*` | `ours` | Fork-only skill additions | D-21 |
| `interfaces/*` | `manual` | Fork-generic; upstream remains Pi-specific | D-01..D-03 |
| `package.json` / `vitest.config.ts` | `manual` | Line-by-line; prefer fork structural choices | D-21 |
| `__tests__/*` / `tests/*` | `assess` | Run §3.1 grep; mostly legal but watch for new test fixtures | D-24 |
| Core MCP source (`init.ts`, `mcp-*.ts`, ...) | `assess` | Always run §3.1 grep; check D-04 wrapper boundaries | D-24, D-04 |
| `types.ts` / `utils.ts` / `errors.ts` / `logger.ts` | `assess` | Universal utility files; Pi-coupling unlikely but check | D-24 |
| `README.md` / `MAPPING.md` / `CHANGELOG.md` / `OAUTH.md` | `assess` (intent) | Preserve "Universal MCP Adapter" framing per D-18/D-19/D-20 | D-18..D-20 |
| `AGENTS.md` / `CLAUDE.md` | `ours` | Fork-specific | D-21 |
| `.planning/*` | `ours` | Planning artifacts are fork-specific | D-21 |
| `types/pi-*.d.ts` | `ours` | Fork-side type declarations for Pi (declarations ≠ coupling) | D-21 |
```

**Why it matters:** Phase 8 的 12-category matrix 是 fast-path(覆盖率 ~70%);Phase 9 的 special-cases registry 是 slow-path(覆盖率 ~10%,但每个都需要手写 rationale)。两者组合 = 80% 即时决策 + 20% 手动查询,实现 Phase 9 的"signal-to-noise"目标。

**Trade-off accepted:** `SKILL.md` 从 142 行膨胀到 ~180 行(+38 行 = 12-category 表格)。仍在 agent 工作记忆范围(< 200 行),可接受。

---

## Decisions vs Phase 8 (delta table)

| Phase 8 ID | Phase 8 决策 | Phase 9 决策 | 差异类型 |
|---|---|---|---|
| UPSTREAM-01-A | 只列 diverged 文件 | 只列 special cases 文件 (D-31) | **REPLACED** |
| UPSTREAM-01-B | 5 列表格 (Path/Status/Category/Default/Rationale) | 4 列表格 (Path/Status/Why special/Decision) | **REPLACED** |
| UPSTREAM-01-C | git diff + awk classifier (initial-fill only) | `scripts/upstream-divergence.ts` (per-merge cross-check) | **REPLACED** |
| UPSTREAM-01-D | no CI hook, one-shot baseline | manual-only, **never** hook, npm script wrapper | **SHARPENED** |
| UPSTREAM-02-A | 4-section skill (When/Read/Decide/Check) | 4-section skill, §2 references 改 7 处 | **MODIFIED** |
| UPSTREAM-02-B | §3.1 Pi-coupling grep | §3.1 Pi-coupling grep (unchanged) | **PRESERVED** |
| UPSTREAM-03-A | 12-category matrix (references/) | 12-category matrix inline SKILL.md (D-35) | **RELOCATED** |
| UPSTREAM-03-B | §3.2 follow-up flow (5 steps) | §3.2 follow-up flow (5 steps) | **PRESERVED** |
| UPSTREAM-03-C | §3.3 line-by-line manual | §3.3 line-by-line manual | **PRESERVED** |
| UPSTREAM-04 | Adapter pattern preservation | Adapter pattern preservation | **PRESERVED** |
| (new) UPSTREAM-05 | — | `scripts/upstream-divergence.ts` contract (D-34) | **NEW** |

</decisions>

<requirements>
## Implementation Requirements

### UPSTREAM-01 (revised) — Special-cases only manifest

- **UPSTREAM-01-A (revised):** Manifest 只列 ~15-20 个特殊文件,不列 209 个全 diverged 文件
- **UPSTREAM-01-B (revised):** 4 列表格 schema(Path / Status / Why special / Decision)
- **UPSTREAM-01-C (revised):** Manifest 由 `scripts/upstream-divergence.ts` 交叉验证,不是 initial-fill-only
- **UPSTREAM-01-D (preserved):** No CI hook, manual-only

### UPSTREAM-02 (preserved + modified) — Skill structure

- **UPSTREAM-02-A (modified):** §2 引用从 `UPSTREAM-CHANGES.md` 改为 `references/special-cases.md` + `npm run upstream:check`(改 7 处)
- **UPSTREAM-02-B (preserved):** §3.1 Pi-coupling marker grep,使用 `\b` + `types/pi-*.d.ts` 排除(D-27)
- **UPSTREAM-02-C (preserved):** §4 6-item checklist,(e) "manifest alignment check" → "divergence script exit 0"

### UPSTREAM-03 (preserved + relocated) — Conflict resolution rules

- **UPSTREAM-03-A (relocated):** 12-category matrix 从 `references/per-category-default.md` 内联到 SKILL.md §3.2(D-35);Phase 9 删除 `references/per-category-default.md`
- **UPSTREAM-03-B (preserved):** §3.2 follow-up flow,5 steps unchanged
- **UPSTREAM-03-C (preserved):** §3.3 line-by-line manual,unchanged

### UPSTREAM-04 (preserved) — Adapter pattern preservation

- All Phase 5/6/7 adapter/wrapper patterns unchanged
- `adapters/<agent>/*` 仍按 D-21 走 `ours`

### UPSTREAM-05 (new) — Divergence check script

- **UPSTREAM-05-A:** `scripts/upstream-divergence.ts` 实现 D-34 contract
- **UPSTREAM-05-B:** `package.json` scripts 字段添加 `upstream:check` (1 行)
- **UPSTREAM-05-C:** 脚本复用 Phase 8 GnuTLS workaround snippet(D-23,no re-derive)

</requirements>

<success>
## Success Criteria

Phase 9 完成的判定标准(全部满足):

1. **UPSTREAM-01 (revised) PASS:** `UPSTREAM-CHANGES.md` 已从仓库根删除,`skills/upstream-merge/references/special-cases.md` 已创建,15-20 条 special cases 完整覆盖 Phase 8 manifest 的 4 条 special footnotes(`mcp-panel.ts` DECOUPLE-06 / `mcp-setup-panel.ts` 同 / `index.ts` D-04 / `panel-keys.ts` deleted-in-fork / `interfaces/agent-api.ts` legal JSDoc)
2. **UPSTREAM-02 PASS:** `SKILL.md` §2 的 7 处 `UPSTREAM-CHANGES.md` 引用全部改为 `references/special-cases.md` + `npm run upstream:check`,其余 142 行无变更(diff 验证)
3. **UPSTREAM-03 PASS:** 12-category matrix 已内联到 SKILL.md §3.2(per D-35),`references/per-category-default.md` 原文件已删除(per Q4 user decision),内容已 100% 保留到 SKILL.md
4. **UPSTREAM-04 PASS:** `adapters/<agent>/*` 仍按 `ours` 处理,`index.ts` 仍按 `ours`(D-04 backward-compat wrapper 不动)
5. **UPSTREAM-05 PASS:** `scripts/upstream-divergence.ts` 跑通,输出符合 D-34 contract,`npm run upstream:check` exit 0(在干净 repo + 当前 upstream main 上)

**Manual verification steps** (execute + verify 阶段):
- `npm run upstream:check` — 脚本输出符合 D-34 contract,exit 0
- `git grep UPSTREAM-CHANGES.md` — 应返回 0 hits(manifest 完全退役)
- `git grep references/special-cases.md` — 应返回 ≥7 hits(SKILL.md 引用 + 可能的 follow-up 文档)
- `wc -l skills/upstream-merge/references/special-cases.md` — 应 ~40 行,15-20 条 special cases
- `wc -l skills/upstream-merge/SKILL.md` — 应 ~180 行(142 + ~38 行 12-category 表格)
- `npx tsc --noEmit` — exit 0(脚本是 .ts,Phase 9 必须保证 type-correct)

</success>

<risks>
## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| 用户忘记跑 `npm run upstream:check` 导致 divergence drift | Medium | Low | `SKILL.md` §2 step 1 + §4(a) checklist 双重提示 |
| 脚本 stdout 格式被未来 tty / locale 破坏 | Low | Low | ANSI color 默认开(Q2),但加 `--no-color` / `--color` flag + auto-detect non-tty,纯文本 grep 友好 |
| 12-category matrix 内联后,SKILL.md 超过 agent 工作记忆 | Low | Medium | 控制在 ~180 行,若超过 200 行回退到 references/(D-35 trade-off 已接受) |
| Phase 8 GnuTLS workaround 在新 OS 失效 | Low | Medium | 脚本内 hardcode snippet,失败时退出 2 + 明确错误信息 |
| Phase 9 修改 `SKILL.md` 时误改 §3 / §4 | Low | High | Plan 含 "diff verification" step:§3/§4 byte-identical to Phase 8 |
| Special-cases registry 的 15-20 条漏列重要文件 | Medium | Medium | Phase 9 plan 包含 "Phase 8 manifest footnote → registry" 显式迁移表 |
| `package.json` scripts 字段冲突(已有 `upstream:*` prefix) | Low | Low | Phase 9 plan 包含 `git grep '"upstream' package.json` 检查 |

</risks>

<user_decisions>
## User Decisions (resolved 2026-06-22)

All 5 open_questions resolved. Captured here for traceability.

| # | Question | Answer | Where reflected |
|---|---|---|---|
| Q1 | Special cases 数量 15 条是否完整? | **Y** (15 条完整) | D-31 schema; `references/special-cases.md` 内容 (index.ts / mcp-panel.ts / mcp-setup-panel.ts / panel-keys.ts / interfaces/agent-api.ts / interfaces/agent-paths.ts / interfaces/sampling.ts / package.json / vitest.config.ts / tsconfig.json / README.md / MAPPING.md / CHANGELOG.md / OAUTH.md / types/pi-{coding-agent,ai,tui}.d.ts) |
| Q2 | Script output 是否需要 ANSI color? | **Y** (默认开, `--no-color` 关) | D-34 output section + Color rules block (Q2 决定) |
| Q3 | Phase 8 LEARNINGS.md 是否回写 D-31/32/33/34/35 作为 Amendment 段? | **Y** (回写 D-31/32/33/34/35 作为 Amendment 段) | 单独修改 `08-LEARNINGS.md`, 追加 "Amendment (added 2026-06-22 by Phase 9)" 段 |
| Q4 | `references/per-category-default.md` 删除 / 保留 archive? | **删除** | D-32 directory tree + D-35 inline section + UPSTREAM-03-A requirement + success criteria #3 |
| Q5 | `package.json` 是否加 `// DO NOT add pre-commit hook` 注释? | **N** (不加) | D-33 manual-trigger section 已经有显式禁止说明; 不再需要 package.json 注释冗余 |

</user_decisions>

<open_questions>
## ~~Open Questions~~ (all resolved 2026-06-22 — see §user_decisions)

1. ✅ **Special cases 数量 15 条** — 完整, 不追加 / 删除
2. ✅ **Script output ANSI color** — 默认开, 加 `--no-color` flag, non-tty auto-disable
3. ✅ **Phase 8 LEARNINGS.md 回写** — D-31/32/33/34/35 作为 Amendment 段 (在 08-LEARNINGS.md 末尾追加)
4. ✅ **`references/per-category-default.md`** — 删除 (内容已内联到 SKILL.md §3.2)
5. ✅ **`package.json` 注释** — 不加 (D-33 显式禁止说明足够)

</open_questions>

<next_action>
## Next Action (ready to enter plan-phase)

```
1. /gsd-plan-phase 09-upstream-manifest-architecture-c
   → produces 09-PLAN.md (must be atomic, no cross-plan dependencies)
   → expected: 1 plan covering 4 deliverables
     (a) delete UPSTREAM-CHANGES.md
     (b) create scripts/upstream-divergence.ts + npm script wrapper
     (c) create references/special-cases.md + migrate footnotes + delete references/per-category-default.md
     (d) modify SKILL.md §2 (7 reference updates) + inline 12-category matrix
   → input: this 09-CONTEXT.md + 08-LEARNINGS.md (with Amendment segment appended)
   → output: 09-PLAN.md with verification at end

2. /gsd-execute-phase 09
   → runs 09-PLAN.md with verification at end (5 success criteria)

3. /gsd-verify-work 09
   → runs manual verification steps + checks against UPSTREAM-01..05
```

**Prerequisite:** 08-LEARNINGS.md must have Amendment segment appended BEFORE plan-phase starts (per Q3 user decision). Both files are CONTEXT-complete inputs to plan-phase.

</next_action>