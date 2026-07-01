# upstream-merge 反思与改进方案

> **Date**: 2026-07-01
> **Author**: bmad-party-mode 多视角反思
> **Status**: 草案 v1（待用户评审后落地）
> **Scope**: 覆盖 `skills/upstream-merge/SKILL.md` §1-§5 全部 + `docs/plan.md` Phase 1-Phase 7 关键路径

---

## 0. 摘要

第一次 `git merge upstream/main` 触发了 **11 个 conflict 文件**，跨 ~768 行 Pi-coupling 重新引入。按 SKILL.md §4 决策树走到 §4.2b 5-step follow-up 流程，但因 `gh` CLI 未认证 + 5 个 decouple refactor 估计 ~ 数小时工作，merge 主动中止。

本文档汇总 bmad-party-mode 多视角（架构师/资深开发者/QA/PM）反思的 4 个核心问题答案，并给出 P0/P1/P2 改进路线图。

**核心结论**：
1. **以 upstream 改进为准**（用户问题 1）→ 改写 SKILL.md §4.1，默认 `--theirs`
2. **同文件不同函数 = 都保留**（用户问题 2）→ 添加 §3.5 "import 区域冲突诊断" + 快速路径
3. **同函数冲突 = agent 分析**（用户问题 3）→ 强制要求 `git show :2:` + `:3:` diff
4. **冲突根因 = 架构抽象 + 大文件聚合**（用户问题 4）→ 拆分 `index.ts` (343 行) + `elicitation-handler.ts` (565 行) + `proxy-modes.ts` (958 行)

---

## 1. 冲突现场数据

### 1.1 复现条件

| 项 | 值 |
|---|---|
| 当前分支 | `main` (5e1aabc) |
| upstream | `nicobailon/pi-mcp-adapter` @ 240 commits ahead |
| fork 独有 | 13 commits (v3.0 milestone archived) |
| pre-flight | `npm run upstream:check` exit 0，269 diverged / 27 registered / 0 stale |
| merge 命令 | `git merge upstream/main --no-commit --no-ff` |
| 冲突文件数 | **11** |
| 冲突总行数 | **~1300 行**（含 conflict markers） |
| 净 Pi-coupling 重新引入 | **~768 行**（5 个 core 文件） |

### 1.2 11 个冲突文件分类

| # | 文件 | hunks | 冲突行范围 | 所在函数 | 冲突类型 | Pi-coupling 深度 |
|---|------|-------|----------|---------|---------|-----------------|
| 1 | README.md | 2 | L286-292, L487-625 | `adapter`, `resolver` | **同文件不同段落** | 无 |
| 2 | __tests__/elicitation-handler.test.ts | 1 | L23-120 | (顶层) | **同文件测试代码** | 0 |
| 3 | __tests__/init-elicitation.test.ts | 3 | L29, L69, L125 | (顶层 3 段) | **同文件不同段落** | 9 hits (theirs) |
| 4 | __tests__/server-manager-sampling.test.ts | 1 | L8-16 | `mocks` 函数 | **同函数内冲突** | 0 |
| 5 | commands.ts | 3 | L289, L367, L417 | 3 个 async 函数 | **同函数内冲突** | 13 hits (theirs) |
| 6 | direct-tools.ts | 1 | L1-6 | (import 区域) | **import 冲突** 🏛️ | 4 hits (theirs) |
| 7 | elicitation-handler.ts | 4 | L19, L61-326, L333, L394 | 1 大函数 + 3 段 | **同文件大块** | 2 hits (theirs) |
| 8 | **index.ts** | 2 | **L33-375 (343行)** | **mcpAdapter 整个函数** | **同函数体大冲突** 🔴 | 4 hits (theirs) |
| 9 | init.ts | 1 | L53-59 | async 函数 | **同函数内冲突** | 4 hits (theirs) |
| 10 | package.json | 1 | L116-119 | (dependencies 块) | **同结构** | 0 |
| 11 | proxy-modes.ts | 2 | L1-6, L16-21 | (import 区域) | **import 冲突** 🏛️ | 2 hits (theirs) |

### 1.3 分类统计

| 类别 | 数量 | 占比 | 解决策略 |
|------|------|------|---------|
| 🏛️ **import 区域冲突** | 3 | 27% | 架构抽象问题（direct-tools.ts, index.ts, proxy-modes.ts） |
| ⚠️ **同函数内冲突** | 3 | 27% | 需要 agent 现场分析（commands.ts ×3, init.ts, mocks） |
| 🔴 **同函数体大冲突** | 1 | 9% | 最难处理（index.ts mcpAdapter 343 行） |
| ✅ **同文件不同段落** | 4 | 37% | 用户规则 2 适用（README, 3 个测试, elicitation-handler.ts 段, package.json） |

### 1.4 Pi-coupling 命中统计

| 文件 | ours (main) hits | theirs (upstream) hits | 接受 theirs 的风险 |
|------|-----------------|----------------------|------------------|
| init.ts | 0 | 4 (Sub 1+4) | 🔴 高（直接 Pi 重新引入） |
| proxy-modes.ts | 0 | 2 (Sub 1+5) | 🔴 高（`getPiTools()` 新函数） |
| direct-tools.ts | 0 | 4 (Sub 1+2) | 🔴 高（`AgentToolResult` 重耦合） |
| elicitation-handler.ts | 0 | 1 (Sub 1) | 🟡 中（仅 `ExtensionUIContext`） |
| index.ts | 3 (H) | 2 (H) | 🔴 高（`ExtensionAPI/ToolInfo` 重耦合 + `getPiTools()`） |
| commands.ts | 0 | 13 (Sub 4) | ✅ 低（D-04 exception 覆盖） |
| __tests__/init-elicitation.test.ts | 0 | 9 (Sub 1+2) | ✅ 低（legal zone） |

---

## 2. 多视角反思：4 个核心问题

### 2.1 问题 1：合并原则 — 肯定以原代码仓的改进为准

#### 2.1.1 4 视角共识

| 视角 | 立场 | 关键论点 |
|------|------|---------|
| 🏛️ 架构师 | ✅ 同意 | "upstream 是演进方向，fork 应做下游而非对抗性分支" |
| 💻 资深开发者 | ✅ 同意 | "默认 `--theirs` 可以减少 80% 决策负担" |
| 🧪 QA | ✅ 同意 | "测试冲突保留两侧是合理的；不应让 fork 的 universal 测试阻碍 upstream 演进" |
| 🎯 PM | ✅ 同意 + **战略转向** | "这意味着 fork 放弃 'Universal' 独立定位，回归 'Pi 优先 + 兼容'" |

#### 2.1.2 改写建议：SKILL.md §4.1

**当前**:
```markdown
| `assess` | Run the §4.1 Pi-coupling marker grep; 0 hits → `--theirs`; ≥1 hit → §4.2b follow-up flow |
```

**改写为**:
```markdown
| `assess` | Default `--theirs` (prefer upstream improvements). §4.1 Pi-coupling grep is now **advisory** — 0 hits = clean accept; ≥1 hit = log warning, accept upstream, optionally create §4.2b follow-up issue (best-effort, not blocking). |
```

#### 2.1.3 §4.2b 5-step follow-up 降级

**当前**: 强制 5-step（accept + refactor + issue + refs + no manual edit）
**改写为**: 2-step soft follow-up（accept + optional issue）

```markdown
### 4.2b Pi-coupling soft follow-up (advisory, non-blocking)

When the §4.1 grep returns ≥1 hit in core source, the merge is **not blocked**. Best-effort follow-up:

1. **Accept the upstream diff** (mandatory). `git checkout --theirs <path> && git add <path>`.
2. **Optionally open a follow-up issue** (best-effort, only if `gh` CLI authenticated): `gh issue create --label pi-coupling-followup --title "pi-coupling-followup: <file> post-upstream-merge" --body "..."`. Skip if `gh` not authenticated.
3. **Do not block the merge on Pi-coupling** — the merge commit lands cleanly, follow-up is async.

> **Removed from v1**: step "Stage a follow-up commit that refactors the Pi-coupling out" is removed. Rationale: fork's decoupling direction has shifted — we accept upstream Pi-coupling as canonical and maintain adapter layer (`adapters/pi-adapter.ts`) for isolation, rather than fighting reintroduction in core.
```

---

### 2.2 问题 2：同文件不同函数 = 都保留

#### 2.2.1 适用情况

11 个冲突中**4 个**适用此规则（37%）：

| 文件 | hunk 范围 | 是否真独立 |
|------|----------|----------|
| README.md | L286-292 (adapter 段) + L487-625 (resolver 段) | ✅ 真独立（不同章节）|
| __tests__/elicitation-handler.test.ts | L23-120 (测试 setup) | ✅ 独立（新增测试 vs 旧测试）|
| __tests__/init-elicitation.test.ts | L29 + L69 + L125 (3 段) | ✅ 独立（3 个不同测试）|
| package.json | L116-119 (dependencies 块) | ✅ 独立（双侧都加新依赖）|

#### 2.2.2 关键验证步骤

**不能仅看文件名**——需要确认 hunk 是否在**独立代码单元**（不同函数/不同 import 块/不同 JSON key）。

**新增 §3.5 冲突诊断协议**:

```markdown
### 3.5 Conflict hunk independence check (NEW)

Before resolving any conflict, classify each hunk:

```bash
# 列出所有 conflict hunk 所在函数
git diff --name-only --diff-filter=U | while read f; do
  awk '
    /^<<<<<<< / { hunk=1; start=NR; next }
    /^=======/ { hunk=0; sep=NR; next }
    /^>>>>>>> / { hunk=0; end=NR; next }
    hunk && match($0, /^(export )?(async )?function ([A-Za-z_][A-Za-z0-9_]*)/, m) { fn=m[2] }
    /^>>>>>>> / { print FILENAME ": hunk@" start "-" end " in function: " fn }
  ' "$f"
done
```

**Decision matrix**:

| hunk 独立性 | 解决策略 |
|------------|---------|
| 同一文件 + 不同函数 | 保留两侧（`git checkout --ours` + 追加 `theirs` 内容，or 人工拼接）|
| 同一文件 + 同一函数不同段 | 视内容而定（追加模式 = 拼接，替换模式 = agent 分析）|
| 同一文件 + 同一函数同一段 | 强制 agent 阅读 + 决策（user rule 3）|
| 同一文件 + import 区域 | 检查是否真冲突（常常是同 package 不同版本）|
```

#### 2.2.3 README.md L487-625 特殊处理

**139 行大块冲突**——需要拆分：

```bash
# 拆分到独立片段
git show :2:README.md | sed -n '487,625p' > /tmp/readme-ours.txt
git show :3:README.md | sed -n '487,625p' > /tmp/readme-theirs.txt
diff -u /tmp/readme-ours.txt /tmp/readme-theirs.txt | less
```

决策依据：保留两侧都"独特"的内容（"Universal MCP Adapter" framing 来自 ours，新增的安装步骤来自 theirs）。

---

### 2.3 问题 3：同函数冲突 = agent 分析

#### 2.3.1 适用情况

11 个冲突中**3 个**适用此规则（27%）：

| 文件 | hunk 范围 | 所在函数 | 决策难度 |
|------|----------|---------|---------|
| commands.ts L289-297 | 8 行 | async 函数 1 | 🟡 中 |
| commands.ts L367-373 | 6 行 | async 函数 2 | 🟡 中 |
| commands.ts L417-425 | 8 行 | async 函数 3 | 🟡 中 |
| init.ts L53-59 | 6 行 | async 函数 | 🟢 低 |
| __tests__/server-manager-sampling.test.ts L8-16 | 8 行 | `mocks` 函数 | 🟢 低 |

#### 2.3.2 强制分析协议

**新增 §4.4 "agent 必须执行的 5 步分析"**:

```markdown
### 4.4 Same-function conflict resolution protocol (NEW)

When conflict hunk is in the same function, agent MUST execute:

1. **Extract ours**:
   ```bash
   git show :2:<file> | sed -n '<start>,<end>p' > /tmp/conflict-ours.txt
   ```

2. **Extract theirs**:
   ```bash
   git show :3:<file> | sed -n '<start>,<end>p' > /tmp/conflict-theirs.txt
   ```

3. **View function context** (10 lines before/after):
   ```bash
   git show :2:<file> | sed -n '<fn_start>,<fn_end>p'
   ```

4. **Classify merge mode** (3 categories):
   - **Append mode**: ours 在函数头加、theirs 在函数尾加 → 直接拼接
   - **Replace mode**: ours 替换函数中段、theirs 替换同一段 → 必须阅读代码决策
   - **Wrap mode**: ours 在函数外包了 try/catch、theirs 在函数内加 validation → 嵌套合并

5. **Document decision in commit body**:
   ```markdown
   upstream-merge: resolve <file> conflict
   - function: <fn_name>
   - mode: <append|replace|wrap>
   - decision: <ours|theirs|merge|hybrid>
   - rationale: <1-2 sentences>
   ```
```

#### 2.3.3 commands.ts 3 个 hunk 的具体预测

基于文件结构（438 行）和 hunk 位置（L289, L367, L417）：

| hunk | 预测函数 | 预测模式 |
|------|---------|---------|
| L289-297 | `mcpLogout` 或 `mcpStatus` async 函数 | 追加模式（错误处理块）|
| L367-373 | `mcpConnect` async 函数中段 | 替换模式（认证逻辑）|
| L417-425 | `mcpDisconnect` async 函数 | 追加模式（清理逻辑）|

**实际操作**: 跑 §4.4 协议确认。

---

### 2.4 问题 4：冲突根因 — 架构抽象 + 大文件聚合

#### 2.4.1 数据驱动的诊断

| 指标 | 数值 | 含义 |
|------|------|------|
| import 区域冲突占比 | 27% (3/11) | **架构边界在演进中被穿透** |
| 同文件不同段落占比 | 37% (4/11) | **大文件承载多个独立功能** |
| 同函数内冲突占比 | 27% (3/11) | **正常演进冲突**（不可避免）|
| 同函数体大冲突占比 | 9% (1/11) | **关键路径需要拆分** |

**关键发现**:
- 3 个 import 区域冲突**全部集中在 core 文件**（direct-tools.ts, index.ts, proxy-modes.ts）
- 1 个 343 行大冲突在 `mcpAdapter()` 函数体
- 2 个大文件（elicitation-handler.ts 565 行, proxy-modes.ts 958 行）承载多职责

#### 2.4.2 4 视角根因分析

| 视角 | 根因诊断 |
|------|---------|
| 🏛️ 架构师 | "**upstream 在演进中把'内部 Pi 类型'升级到'对外 API'**——这是 upstream 的架构债，fork 的 interfaces/agent-api.ts 抽象层完整但被穿透" |
| 💻 资深开发者 | "**index.ts 的 mcpAdapter() 函数体同时被两方大改**——单函数承载'注册工具 + 注册命令 + UI 初始化 + 错误处理'太多职责" |
| 🧪 QA | "**__tests__/init-elicitation.test.ts 有 3 个独立 hunk**——测试文件未按职责拆分（init-elicitation 应该按 'success'/'error'/'cancel' 拆成 3 个文件）" |
| 🎯 PM | "**'同文件不同段落'高比例不是冲突问题，是 file-level 架构问题**——一个文件承载多个独立功能时，upstream 和 fork 必然在'同一个文件上做不同事'" |

#### 2.4.3 架构抽象层评估

```
当前层次:
  upstream:  [调用方] → [Pi 类型直引] → [实现]
  fork:      [调用方] → [interfaces/agent-api.ts 抽象] → [adapters/pi-adapter.ts 实现]
                  ↑ 抽象层（interfaces/）
```

**interfaces/ 目录状态**:
- `interfaces/agent-api.ts` (45 行) — 已有 AgentAPI / AgentContext / UISystem
- `interfaces/agent-channel.ts` — 已有
- `interfaces/agent-paths.ts` — 已有
- `interfaces/sampling.ts` — 已有

**结论**: 抽象层**完整**——问题不在抽象层缺失，而在**调用方不遵守抽象边界**。

#### 2.4.4 改进方案：拆分大文件

| 文件 | 当前行数 | 建议拆分 |
|------|---------|---------|
| **index.ts** | 376 | `mcpAdapter` 343 行 → 拆为 `createMcpAdapter` (注册) + `setupUiHandlers` (UI) + `registerCommands` (命令) + `initConnections` (连接) 4 个小函数 |
| **elicitation-handler.ts** | 565 | 拆为 `form-handler.ts` (表单) + `url-handler.ts` (URL 弹窗) + `coerce.ts` (值验证) |
| **proxy-modes.ts** | 958 | 拆为 `proxy-manager.ts` (管理) + `proxy-stdio.ts` (stdio 模式) + `proxy-http.ts` (HTTP 模式) + `proxy-sse.ts` (SSE 模式) |
| **__tests__/init-elicitation.test.ts** | 149 (3 hunks) | 拆为 `init-elicitation-success.test.ts` + `init-elicitation-error.test.ts` + `init-elicitation-cancel.test.ts` |

**预期效果**:
- 减少 40-50% 冲突（同文件不同段落冲突降为 0）
- 单文件 < 300 行
- 每个文件单一职责

---

## 3. 改进路线图（P0/P1/P2）

### 3.1 P0 — 立即更新（本次会话内）

#### P0-1: 改写 SKILL.md §4.1

**目标**: 默认 `--theirs`，Pi-coupling 降为 advisory

**文件**: `skills/upstream-merge/SKILL.md` L99-103

**diff**:
```diff
-| `assess` | Run the §4.1 Pi-coupling marker grep; 0 hits → `--theirs`; ≥1 hit → §4.2b follow-up flow |
+| `assess` | Default `--theirs` (prefer upstream improvements). §4.1 Pi-coupling grep is **advisory** — 0 hits = clean accept; ≥1 hit = log warning + accept upstream + optionally open follow-up issue. |
```

#### P0-2: 改写 SKILL.md §4.2b 5-step → 2-step soft

**目标**: 不阻塞 merge，gh 不可用时优雅降级

**文件**: `skills/upstream-merge/SKILL.md` L160-180

**diff**:
```diff
-### 4.2b 5-step follow-up flow (Pi-coupling re-introduction)
+### 4.2b Pi-coupling soft follow-up (advisory, non-blocking)

-When the §4.1 grep returns ≥1 hit ..., the merge is **not blocked**. The follow-up flow extracts the Pi-coupling in a separate commit and tracks it with a labelled issue:
+When the §4.1 grep returns ≥1 hit in core source, the merge is **not blocked**. Best-effort follow-up:
 
-1. **Accept the upstream diff first.** ...
-2. **Stage a follow-up commit** that refactors the Pi-coupling out. ...
-3. **Open a follow-up issue** with title prefix `pi-coupling-followup:` ...
-4. **Reference the issue number in the merge commit body** ...
-5. **Do not manually re-edit the upstream diff during merge.** ...
+1. **Accept the upstream diff** (mandatory). `git checkout --theirs <path> && git add <path>`.
+2. **Optionally open a follow-up issue** (best-effort, only if `gh` CLI authenticated). Skip if `gh` not available.
+3. **Do not block the merge on Pi-coupling.**
+
+> **Removed from v1**: step "Stage a follow-up commit that refactors" is removed. Rationale: fork's decoupling direction has shifted — we accept upstream Pi-coupling as canonical and maintain adapter layer for isolation.
```

#### P0-3: 新增 §3.5 冲突独立性诊断协议

**目标**: 区分"同文件不同段落" vs "同函数内部"

**文件**: `skills/upstream-merge/SKILL.md` 新增章节（在 §3 之后 §4 之前）

**新增内容**:
```markdown
### 3.5 Conflict hunk independence check (NEW)

Before resolving any conflict, classify each hunk's independence:

```bash
# 列出所有 conflict hunk 所在函数
git diff --name-only --diff-filter=U | while read f; do
  awk '
    /^<<<<<<< / { hunk=1; start=NR; next }
    /^=======/ { hunk=0; sep=NR; next }
    /^>>>>>>> / { hunk=0; end=NR; next }
    hunk && match($0, /^(export )?(async )?function ([A-Za-z_][A-Za-z0-9_]*)/, m) { fn=m[2] }
    /^>>>>>>> / { print FILENAME ": hunk@" start "-" end " in function: " fn }
  ' "$f"
done
```

**Decision matrix**:

| hunk 独立性 | 解决策略 |
|------------|---------|
| 同文件 + 不同函数 | 保留两侧（拼接）|
| 同文件 + 同一函数不同段 | 视内容（追加/替换/包装 3 模式）|
| 同文件 + 同一函数同一段 | 强制 agent 阅读 + 决策（§4.4）|
| 同文件 + import 区域 | 检查 package 版本兼容性 |
```

#### P0-4: 新增 §4.4 同函数冲突分析协议

**目标**: 强制 agent 5 步分析，禁止拍脑袋决策

**文件**: `skills/upstream-merge/SKILL.md` 新增章节

**新增内容**:
```markdown
### 4.4 Same-function conflict resolution protocol (NEW)

When conflict hunk is in the same function, agent MUST execute 5-step:

1. **Extract ours**: `git show :2:<file> | sed -n '<start>,<end>p'`
2. **Extract theirs**: `git show :3:<file> | sed -n '<start>,<end>p'`
3. **View function context**: `git show :2:<file> | sed -n '<fn_start>,<fn_end>p'`
4. **Classify merge mode**: append | replace | wrap
5. **Document decision in commit body**:
   ```
   upstream-merge: resolve <file> conflict
   - function: <fn_name>
   - mode: <append|replace|wrap>
   - decision: <ours|theirs|merge|hybrid>
   - rationale: <1-2 sentences>
   ```
```

### 3.2 P1 — 下一阶段（数天-1 周内）

#### P1-1: 拆分 index.ts mcpAdapter (343 行)

**目标**: 拆为 4 个小函数

**新文件**:
- `src/setup-ui-handlers.ts` — UI handlers 注册
- `src/register-commands.ts` — 命令注册
- `src/init-connections.ts` — MCP 连接初始化
- `src/index.ts` — 仅保留入口 + 4 个函数调用

**预计工作量**: 4-6 小时（含测试）

#### P1-2: 拆分 elicitation-handler.ts (565 行)

**目标**: 拆为 3 个文件

**新文件**:
- `src/elicitation/form-handler.ts` — 表单处理
- `src/elicitation/url-handler.ts` — URL 弹窗
- `src/elicitation/coerce.ts` — 值验证工具

**预计工作量**: 2-3 小时

#### P1-3: 拆分 proxy-modes.ts (958 行)

**目标**: 拆为 4 个文件

**新文件**:
- `src/proxy/manager.ts` — 代理管理
- `src/proxy/stdio.ts` — stdio 模式
- `src/proxy/http.ts` — HTTP 模式
- `src/proxy/sse.ts` — SSE 模式

**预计工作量**: 4-6 小时

#### P1-4: 拆分 __tests__/init-elicitation.test.ts

**目标**: 拆为 3 个文件

**新文件**:
- `__tests__/init-elicitation-success.test.ts`
- `__tests__/init-elicitation-error.test.ts`
- `__tests__/init-elicitation-cancel.test.ts`

**预计工作量**: 1-2 小时

### 3.2.1 Fork-only 代码 L1/L2/L3 决策矩阵（2026-07-01 重新设计）

> **背景**: 用户的洞察——"fork 引入的独立代码应该独立成文件，避免与上游共享文件产生冲突"。
> 通过扫描 `git log upstream/main..main`（249 个 fork-only commits, 278 个 diverged files），
> 找到真正应该独立的代码段，而不是仅分析冲突的 11 个文件。

**全 fork 引入代码分类**：

| 类别 | 文件数 | 性质 | 行动 |
|------|--------|------|------|
| **Fork-ONLY 新文件** | 233 | fork 全新引入，✅ 已是独立文件 | 无需重构 |
| **Fork-MODIFIED upstream files** | 45 | 候选——fork 在 upstream 文件里加的代码段 | 见 L1/L2/L3 分类 |

**L1/L2/L3 决策矩阵**（fork-modified upstream files 的 45 个）：

| 层 | 类别 | 数量 | 策略 | 例子 |
|----|------|------|------|------|
| **L1** | REPLACEMENTS（Phase 3 抽象改造）| 9 | ❌ **接受冲突风险**——核心抽象，撤回 = 撤销 Phase 3 universal 目标 | `init.ts`, `commands.ts`, `proxy-modes.ts`, `direct-tools.ts`, `elicitation-handler.ts`, `config.ts`, `types.ts`, `sampling-handler.ts`, `tool-result-renderer.ts` |
| **L2** | ADDITIONS（fork 加 universal 段）| 8 | 🟡 **逐文件判断**——若 fork-only 段显著则抽到独立文件 | `agent-dir.ts` (+4), `ui-session.ts` (-1), `ui-resource-handler.ts` (-1), `mcp-panel.ts` (-3), `mcp-setup-panel.ts` (-4), `mcp-auth-flow.ts` (-97 ✅), `mcp-oauth-provider.ts` (-47 ✅), `server-manager.ts` (-49 ✅) |
| **L3** | TESTS（fork universal 测试）| ~10 | ✅ 已规划——按 Plan 14-02/03/04 拆分 | `__tests__/init-elicitation.test.ts` 等 5+ 文件 |

**关键洞察**：

1. **L1（9 个 REPLACEMENTS）**是 Phase 3 抽象改造的"已完成投资"——**不可撤回**。
   按 SKILL.md §4.4 同函数 5-step 协议处理合并冲突。

2. **L2（8 个 ADDITIONS）**大部分已经被 Phase 12"删除 per-agent code"工作**最小化**（5/8 的 delta 是负数）。
   仅 3 个文件（`agent-dir.ts`, `ui-session.ts`, `ui-resource-handler.ts`）的 fork 改动是"加 universal 段"——但 delta 都很小（+4/-1/-1 行），**不值得抽出**。

3. **L3（~10 个 TESTS）**按 Plan 14-04 拆 init-elicitation 即可。

**新原则**（应用到未来 fork 引入代码）：

> **当 fork 引入新功能时，必须是"独立文件"模式**：
> - ✅ 创建 `adapters/<new-agent>.ts`，不是修改 `adapters/entry.ts`
> - ✅ 创建 `__tests__/<new-agent>.test.ts`，不是扩展现有 `__tests__/init-*.test.ts`
> - ✅ 通过 `interfaces/agent-api.ts` 抽象扩展，不是直接 import Pi
>
> **目标**：把冲突粒度从"行级/函数级"推到**"文件级"**——这是冲突解决的最高效路径。

### 3.3 P2 — 长期（2-4 周内）

#### P2-1: 类型边界守卫

**目标**: 在 CI 中检测"import 区域 Pi 重新引入"

**实现**:
```yaml
# .github/workflows/check-pi-coupling.yml
- name: Check Pi-coupling in core
  run: |
    ! grep -rE 'from "@earendil-works/pi-' src/ \
      --include='*.ts' \
      --exclude-dir=adapters \
      --exclude-dir=__tests__ \
      --exclude='types/pi-*.d.ts' || \
    (echo "❌ Pi-coupling leaked to core"; exit 1)
```

**预计工作量**: 1-2 小时

#### P2-2: 冲突统计 dashboard

**目标**: 每次 merge 后自动统计冲突分布

**实现**: 在 `scripts/upstream-divergence.ts` 扩展 conflict 统计

**预计工作量**: 2-3 小时

#### P2-3: 同文件不同段落检测器

**目标**: 提前识别"潜在同文件冲突"——在 merge 之前

**实现**:
```typescript
// scripts/predict-conflicts.ts
// 跑 3-way diff，统计 hunk 独立性
```

**预计工作量**: 4-6 小时

---

## 4. 更新后的决策原则

### 4.1 核心原则

> **以 upstream 改进为准，fork 的改动作为补充。** 当 ours 和 theirs 都"做对了一部分"时，**优先保留 upstream**（`--theirs`），把 fork 的改动作为"补充"在 commit message 中说明。

### 4.2 决策矩阵

| 场景 | 决策 |
|------|------|
| 0 conflict | `--no-ff` merge → commit |
| 同文件不同段落 | 拼接保留两侧 → commit |
| 同函数追加模式 | 拼接 → commit |
| 同函数替换模式 | `--theirs`（默认） → 记录决策原因到 commit body |
| 同函数包装模式 | 嵌套合并 → 记录决策原因 |
| import 区域冲突 | 检查版本 → 双侧合并（同一 package） → 记录决策 |
| index.ts / 大文件 | **先 P1 拆分再 merge**（避免 343 行大冲突） |
| Pi-coupling 重新引入 | `--theirs` accept + advisory log + 可选 gh issue |

### 4.3 反模式（避免）

- ❌ **拒绝所有 upstream 改动**（破坏 fork 的"下游"定位）
- ❌ **强制 §4.2b 5-step**（在 gh 不可用时阻塞 merge）
- ❌ **在 343 行大冲突上做手工合并**（应先拆分再 merge）
- ❌ **用 "0 hits" 决策 ours**（与"以 upstream 为准"原则相反）
- ❌ **改写 SKILL.md 时丢失向后兼容**（应在 §4.1 加 advisory 注释而不是删除）

### 4.4 §5 Checklist 更新

**当前**:
```markdown
- (a) All conflicts resolved — `git diff --name-only --diff-filter=U | wc -l` returns 0
- (b) Pi-coupling markers = 0 in merged core code
- (c) TypeScript compiles
- (d) Tests are green
- (e) Divergence check passes
- (f) Commit message prefix is `upstream-merge:`
- (g) Step 2 propagation complete
```

**改写为**:
```markdown
- (a) All conflicts resolved (or documented exceptions with rationale in commit body)
- (b) Pi-coupling markers advisory log (no longer blocking; 记录命中数到 commit body)
- (c) TypeScript compiles
- (d) Tests are green
- (e) Divergence check passes
- (f) Commit message prefix is `upstream-merge:` + includes `merge-mode: <append|replace|wrap|import>` and `pi-coupling-hits: <N>`
- (g) Step 2 propagation complete
```

---

## 5. 验证方法

### 5.1 P0 验证

**改写后**:
- 重跑 `git merge upstream/main`（在干净 main 上）
- 预期：11 个 conflict 仍然存在（upstream 仍是大改动），但**解决流程简化**
- 验证 §3.5 + §4.4 协议输出正确
- 验证 commit body 包含 `merge-mode` + `pi-coupling-hits` 字段

### 5.2 P1 验证

**拆分后**:
- 重跑 `git merge upstream/main`
- 预期：conflict 文件数从 11 降至 6-7（消除了"同文件不同段落"误判）
- 验证 `npx tsc --noEmit` 仍然 PASS
- 验证 `npm test` 仍然全绿
- 验证拆分前后的行为一致（snapshot test）

### 5.3 P2 验证

**类型边界守卫后**:
- 在 `src/index.ts` 故意加一行 `import { ExtensionAPI } from "@earendil-works/pi-coding-agent"`
- 跑 CI
- 预期：❌ FAIL "Pi-coupling leaked to core"

**冲突 dashboard 后**:
- 跑 `scripts/upstream-divergence.ts`
- 预期：输出 JSON 包含 `hunk-independence` 字段

---

## 6. 与现有架构的协同

### 6.1 interfaces/ 抽象层

**当前**: `interfaces/agent-api.ts` (45 行) + 3 个相关文件

**改进后**: 不变（已完整）—— 调用方遵守即可

### 6.2 adapters/ 适配层

**当前**: `adapters/pi-adapter.ts` (180 行) + 5 个相关文件

**改进后**: 不变（已隔离 Pi-coupling 到 adapters/）

### 6.3 MAPPING.md

**当前**: 已存在 ~120 行，记录 Agent API 映射

**改进后**: 在 MAPPING.md 添加"Upstream Merge Conflict Resolution"章节，引用本文档

### 6.4 docs/plan.md

**当前**: 1024 行，5 个 Phase 改造计划

**改进后**: 在 Phase 1 "基础设施搭建" 添加 §1.4 "upstream-merge 策略对齐"，引用本文档

---

## 7. 实施时间表

| Week | 任务 | 负责人 | 验证 |
|------|------|--------|------|
| W1 Day 1-2 | P0-1, P0-2, P0-3, P0-4 (SKILL.md 改写) | 架构师 | 重跑 merge，conflict 解决流程简化 |
| W1 Day 3-4 | P1-4 (init-elicitation.test 拆分) | QA | npm test 全绿 |
| W1 Day 5 | P1-1 (index.ts mcpAdapter 拆分) | 资深开发者 | tsc + vitest pass |
| W2 Day 1-2 | P1-2 (elicitation-handler 拆分) | 资深开发者 | tsc + vitest pass |
| W2 Day 3-5 | P1-3 (proxy-modes 拆分) | 资深开发者 | tsc + vitest pass |
| W3 Day 1-2 | P2-1 (CI 类型边界守卫) | 架构师 | 故意引入 Pi-coupling 验证 CI 失败 |
| W3 Day 3-5 | P2-2 (冲突 dashboard) | 架构师 | 跑脚本输出 JSON |
| W4 | P2-3 (冲突预测器) + 文档同步 | 架构师 | 提前识别潜在冲突 |

**总工作量**: 约 30-40 小时

---

## 8. 风险评估

### 8.1 P0 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| SKILL.md 改写后下游 agent 不识别 | 🟢 低 | 中 | 保留旧 §4.1 注释为 "deprecated" 而非删除 |
| 默认 `--theirs` 引入 Pi-coupling 破坏 fork 目标 | 🟡 中 | 高 | MAPPING.md 同步更新，明确 "Universal = interface abstraction, not core decoupling" |

### 8.2 P1 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 拆分 index.ts 引入行为变更 | 🟡 中 | 高 | snapshot test + 行为对比 |
| 拆分 proxy-modes 引入 race condition | 🟡 中 | 高 | 集成测试 + stress test |

### 8.3 P2 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| CI 守卫太严格误报 | 🟡 中 | 中 | 先 WARN 不 FAIL，观察 1 周 |
| Dashboard 数据不准 | 🟢 低 | 低 | 与 git diff 交叉验证 |

---

## 9. 决策记录

### 9.1 战略决策：fork 定位

**Decision**: 放弃 "Universal MCP Adapter" 独立定位，回归 "Pi 优先 + 兼容"

**Rationale**:
- upstream 演进方向是 "Pi 优先"（import 直接依赖 Pi 类型）
- fork 强行 universal 化导致 import 区域冲突（27%）
- 用户新原则 "以原代码仓改进为准" 与 universal 化冲突

**Consequences**:
- 接受 Pi-coupling 重新进入 core
- 抽象层（interfaces/ + adapters/）保持但不再追求"core 完全 decoupled"
- MAPPING.md 重新定位为 "downstream integration guide" 而非 "abstraction enforcement"

### 9.2 战术决策：§4.1 改写

**Decision**: 默认 `--theirs`，Pi-coupling grep 降为 advisory

**Rationale**:
- 减少 80% 决策负担
- 与"以 upstream 为准"原则一致
- 避免 gh 不可用时阻塞 merge

**Consequences**:
- Pi-coupling 重新进入 core（已接受）
- §4.2b 5-step 简化为 2-step soft
- §5(b) Checklist 改为 advisory log

### 9.3 战术决策：拆分大文件

**Decision**: P1 阶段拆分 index.ts / elicitation-handler.ts / proxy-modes.ts

**Rationale**:
- 减少 40-50% 冲突
- 单文件 < 300 行
- 每个文件单一职责

**Consequences**:
- 短期工作量 ~10-15 小时
- 长期降低维护成本

---

## 10. 附录

### 10.1 完整 conflict 文件清单（11 个）

```bash
git diff --name-only --diff-filter=U
# README.md
# __tests__/elicitation-handler.test.ts
# __tests__/init-elicitation.test.ts
# __tests__/server-manager-sampling.test.ts
# commands.ts
# direct-tools.ts
# elicitation-handler.ts
# index.ts
# init.ts
# package.json
# proxy-modes.ts
```

### 10.2 ours vs theirs Pi-coupling 对比表

| File | ours Pi-hits | theirs Pi-hits | 接受 theirs 的影响 |
|------|-------------|---------------|-----------------|
| init.ts | 0 | 4 (ExtensionAPI/ExtensionContext + 3× ctx.ui.notify) | 🔴 Pi-coupling re-introduction |
| proxy-modes.ts | 0 | 2 (AgentToolResult/ToolInfo + getPiTools) | 🔴 重耦合 |
| direct-tools.ts | 0 | 4 (AgentToolResult/AgentToolUpdateCallback/ExtensionContext) | 🔴 重耦合 |
| elicitation-handler.ts | 0 | 1 (ExtensionUIContext) | 🟡 中等 |
| index.ts | 3 (H) | 2 (H) + ToolInfo | 🔴 重耦合 |
| commands.ts | 0 | 13 (Sub 4 ctx.ui.notify) | ✅ D-04 豁免 |
| __tests__/init-elicitation.test.ts | 0 | 9 (Sub 1+2) | ✅ legal zone |

### 10.3 拆分前/后文件大小对比（预期）

| 文件 | 当前 | P1 拆分后 |
|------|------|----------|
| index.ts | 376 行 | 50 行（入口） + 4 个 ~80 行 |
| elicitation-handler.ts | 565 行 | 50 行（re-export） + 3 个 ~170 行 |
| proxy-modes.ts | 958 行 | 50 行（manager） + 3 个 ~300 行 |
| __tests__/init-elicitation.test.ts | 149 行 | 3 个 ~50 行 |

### 10.4 参考资料

- `docs/plan.md` — 通用 MCP Adapter 改造完整计划
- `MAPPING.md` — Agent API 映射关系
- `interfaces/agent-api.ts` — 通用接口定义
- `adapters/pi-adapter.ts` — Pi 适配器实现
- `skills/upstream-merge/SKILL.md` — 当前 upstream-merge 技能
- `references/special-cases.md` — 手工策展的特殊情况
- `references/pi-coupling-markers.md` — Pi 耦合标记

---

## 11. 总结

**核心论点**：
1. **以 upstream 为准**不是技术问题，是**战略转向**——fork 从"对抗性分支"变成"下游用户"
2. **46% 冲突是"同文件不同段落"**——说明 fork 的文件级架构需要拆分（P1 解决）
3. **27% 冲突是 import 区域**——说明 fork 的接口边界被 upstream 演进穿透（接受 + 接受）
4. **9% 冲突是 343 行大函数**——必须 P1 拆分 index.ts 才能稳定 merge

**下一步行动**:
- ✅ 用户评审本文档
- ⏳ 用户批准 P0 改写 SKILL.md
- ⏳ 进入 P1 拆分大文件
- ⏳ 重新跑 upstream-merge 验证 conflict 数量下降

**不要忘记**:
- P0 改写 SKILL.md 后，**在 `docs/plan.md` Phase 1 添加引用**
- P1 拆分后，**更新 MAPPING.md 中的文件位置引用**
- P2 CI 守卫，**不要立即 FAIL，先 WARN 1 周观察**

---

## 12. L2 ADDITIONS 逐文件分析结果（2026-07-01）

> **背景**: Phase 14 Step 2 (B) —— 对 8 个 L2 ADDITIONS 文件做逐文件 `git log` 分析，识别真正应该抽但没抽的 fork-only 段。

### 12.1 8 个 L2 文件 fork 改动总览

| 文件 | fork_size delta | fork commits | fork + | fork - | 净增 fork-only 段 |
|------|----------------|--------------|--------|--------|------------------|
| `agent-dir.ts` | +4 | 2 | 5 | 1 | +4（env var 解析）|
| `mcp-panel.ts` | -3 | 0 | 9 | 12 | -3（无独立 fork-only 段）|
| `mcp-setup-panel.ts` | -4 | 0 | 9 | 13 | -4（无独立 fork-only 段）|
| `mcp-auth-flow.ts` | -97 | 0 | 30 | 127 | -97（Phase 12 大删 per-agent）|
| `mcp-oauth-provider.ts` | -47 | 0 | 1 | 48 | -47（Phase 12 大删 per-agent）|
| `ui-session.ts` | -1 | 0 | 1 | 2 | -1（无独立 fork-only 段）|
| `ui-resource-handler.ts` | -1 | 0 | 1 | 2 | -1（无独立 fork-only 段）|
| `server-manager.ts` | -49 | 0 | 39 | 88 | -49（Phase 12 大删 per-agent）|

### 12.2 关键发现

1. **6/8 L2 文件 fork 净改动是负的**（删 > 加）—— Phase 12 已经最大化 universal 化
2. **仅 `agent-dir.ts` 有显著 fork-only 段（+4 行）**—— `MCP_AGENT_DIR` env var 解析逻辑
3. **`mcp-panel.ts` 9 行 +** 实际是**替换**（非新加）—— fork 在用 universal API 替换 Pi-specific 段
4. **L2 没有需要抽到独立文件的代码**——5 行 env var 解析属于 `agent-dir.ts` 核心职责

### 12.3 决策

| 文件 | 决策 | 理由 |
|------|------|------|
| `agent-dir.ts` | ✅ 保留 | 5 行 env var 解析是核心职责，不值得抽 |
| `mcp-panel.ts` | ✅ 保留 | fork 改是替换非新加 |
| `mcp-setup-panel.ts` | ✅ 保留 | 同上 |
| `mcp-auth-flow.ts` | ✅ 已优化 | Phase 12 删 127 行 per-agent |
| `mcp-oauth-provider.ts` | ✅ 已优化 | Phase 12 删 48 行 per-agent |
| `ui-session.ts` | ✅ 保留 | 净 -1，无显著 fork-only 段 |
| `ui-resource-handler.ts` | ✅ 保留 | 同上 |
| `server-manager.ts` | ✅ 已优化 | Phase 12 删 88 行 per-agent |

### 12.4 结论

**L2 不需要重构**。这反过来验证了**用户的洞察**：当前 fork 已经很接近"独立代码独立文件"原则——233 个 fork-only 新文件已独立，8 个 L2 ADDITIONS 中只有 5 行真正的 fork-only 代码（在 `agent-dir.ts`），不值得抽。

未来引入新 fork-only 代码时，**严格遵守 SKILL.md §6.3 未来防护规则**：
- new adapter → new file
- new test → new file
- new abstract type → extend interfaces/agent-api.ts
- new universal helper → new file
- new doc → new file

