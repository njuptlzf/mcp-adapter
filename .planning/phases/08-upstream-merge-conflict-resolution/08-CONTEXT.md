# Phase 8: Upstream Merge Conflict Resolution - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

建立 fork-maintainer 工作流,把 upstream features/bugfixes 从 `https://github.com/nicobailon/pi-mcp-adapter` 合入本 fork (`njuptlzf/mcp-adapter`) 时,系统化地避免冲突与 Pi-coupling 重引入。交付物:

1. `UPSTREAM-CHANGES.md` — 当前 fork 与 upstream 实际 diverge 的文件清单(路径/状态/类别/默认决策/rationale 5 列表格)
2. `skills/upstream-merge/SKILL.md` — agent 在 merge conflict 出现时遵循的 step + decision tree + checklist
3. Phase 8 plan 内含 dry-run task — 选 1-2 个 hypothetical upstream 变更走完流程,生成 resolution log 证明 skill 可指导到 commit

Phase 8 **不**实施任何实际的 upstream merge(那是未来触发);它交付**流程+文档+验证**而非新代码改造。UPSTREAM-04("minimize source file modifications")的工程面已经在 Phase 5-6-7 通过 7 个 plan 主动落地(D-21),Phase 8 不重复执行,只把它固化为 manifest 里的 rationale 字段。

</domain>

<decisions>
## Implementation Decisions

### UPSTREAM-03 冲突解决规则 (核心决策 — 必须完整)

- **UPSTREAM-03-A (per-file 类别默认决策):** 文件按目录分类,默认决策不统一
  - `adapters/<agent>/*` (e.g. `adapters/pi-adapter.ts`, `adapters/qoder-adapter.ts`, `adapters/pi-renderer.ts`, `adapters/qoder-renderer.ts`, `adapters/pi-sampling-provider.ts`, `adapters/qoder-sampling-provider.ts`): **keep ours** (本地多 agent 架构;upstream 不会新增同 ID adapter)
  - `interfaces/agent-api.ts`, `interfaces/agent-paths.ts`, `interfaces/sampling.ts`: **keep ours + manual merge** (本地泛化;upstream 仍是 Pi-specific)
  - `adapters/entry.ts`: **keep ours** (本地 universal entry point,upstream 没有)
  - `skills/mcp-adapter-test/`, `skills/upstream-merge/`: **keep ours** (upstream 没有 skills 目录)
  - 核心 MCP 逻辑 (`init.ts`, `mcp-*.ts`, `lifecycle.ts`, `proxy-modes.ts`, `direct-tools.ts`, `commands.ts`, `state.ts`, `oauth-handler.ts`, `elicitation-handler.ts`, `sampling-handler.ts`, `tool-result-renderer.ts`): **assess via Pi-coupling marker grep** (见 B)
  - `types.ts`, `utils.ts`, `errors.ts`, `logger.ts`: **assess via Pi-coupling marker grep** (可能 upstream 修改)
  - `package.json` (peer/optional deps): **manual merge** (本地结构调整 + upstream 新依赖)
  - `__tests__/*`, `tests/*`, `examples/*`: **assess via Pi-coupling marker grep** (本地 parametric test 框架可能与 upstream 冲突)
  - `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.npmignore`: **assess via marker + line-by-line** (配置可能冲突)
  - `README.md`, `MAPPING.md`, `CHANGELOG.md`, `OAUTH.md`: **assess via intent alignment** (本地 "Universal MCP Adapter" hero 可能与 upstream "Pi-specific" framing 冲突)
  - `AGENTS.md`, `CLAUDE.md`: **keep ours** (本 fork 专用;upstream 没有)
  - `.planning/*`: **keep ours** (本 fork GSD 工作流;upstream 没有)

- **UPSTREAM-03-B (Pi-coupling marker 列表 — 用 grep 自动化判断 "Pi-coupling-free"):**
  - `ExtensionAPI`, `ExtensionContext`, `ExtensionUIContext`, `AgentToolResult`, `AgentToolUpdateCallback`
  - `ToolInfo` (注:`ToolInfo` 也存在于 `interfaces/agent-api.ts` 作为泛型 — grep 必须按 import path 区分)
  - `PI_CODING_AGENT_DIR` (env var)
  - `pi-coding-agent`, `pi-ai`, `pi-tui`, `earendil-works` (package names)
  - `pi\.registerTool`, `pi\.on\(`, `pi\.exec\(`, `pi\.sendMessage\(`, `pi\.getAllTools\(`, `pi\.registerCommand\(`, `pi\.registerFlag\(`, `pi\.getFlag\(` (Pi-specific API call patterns)
  - `ctx\.ui\.notify`, `ctx\.ui\.form`, `ctx\.ui\.custom`, `ctx\.ui\.theme` (Pi-specific UI context paths)
  - `\.pi/agent/mcp\.json` (Pi-specific config path)
  - **判定规则:** 合并 upstream diff 后,在受影响文件上跑 grep,任何 marker 命中即 "重引入 Pi-coupling"

- **UPSTREAM-03-C (重引入 Pi-coupling 时的例外流程):** 不是简单 accept/reject
  1. 先接受 upstream diff(merge 阶段不阻塞)
  2. 立即在本 fork 提交一个 follow-up commit,抽出 Pi 耦合部分为 adapter/wrapper(走 Phase 5 DECOUPLE 模式)
  3. 在 fork 仓库开一个 follow-up issue 跟踪(标记 `pi-coupling-followup` label)
  4. skill 在 checklist 里记录这个 follow-up 流程,防止忘记
  5. **不**在 merge 阶段手动 re-edit upstream diff(避免引入更多冲突)

### UPSTREAM-01 manifest 范围与粒度

- **UPSTREAM-01-A (覆盖范围):** 只列 diverged 文件(状态: new / modified / deleted),不记录未变文件。
- **UPSTREAM-01-B (5 列表格 schema):**
  - `Path` — repo-relative 路径 (e.g. `adapters/pi-adapter.ts`)
  - `Status` — `new` / `modified` / `deleted`
  - `Category` — `adapter` / `interface` / `skill` / `test` / `docs` / `config` / `source` / `planning`
  - `Default Resolution` — `ours` / `theirs` / `assess` / `manual` (assess = 跑 Pi-coupling marker grep)
  - `Rationale` — 1-2 行,说明为什么这个 default(链接到 D-21 / Phase 5 DECOUPLE-01..07 / D-07 等)
- **UPSTREAM-01-C (生成机制):** Phase 8 plan 包含一个 initial-fill task — 跑 `git fetch upstream` + `git diff upstream/main --name-status -- '*.ts' '*.md' '*.json'`,把输出按 schema 填入表格。然后人工 review 一遍(去掉 vendor / 内部生成文件,如 `coverage/`, `node_modules/`, `dist/`, `tests/reports/`).
- **UPSTREAM-01-D (维护机制):** manifest 是一次性 baseline 交付,**不**包含 CI hook / 自动化 sync(避免 scope creep)。未来如果 upstream 大量变更导致 manifest 过期,通过 `git diff upstream/main --name-status` 重新生成并 commit update(常规 PR 流程)。

### UPSTREAM-02 skill 决策格式

- **UPSTREAM-02-A (结构 — Step + decision tree + checklist):** SKILL.md 包含 4 个 section
  1. **When to invoke** — 触发条件: (a) `git fetch upstream` 后准备 merge 时, (b) `git pull` 后出现 conflict 时, (c) 准备 cherry-pick upstream commit 时
  2. **Read UPSTREAM-CHANGES.md first** — 定位冲突文件类别,查 Default Resolution 列
  3. **Decision tree** — 按文件类别分支:
     - `our-class` 类别 → 保留 ours
     - `assess` 类别 → 跑 Pi-coupling marker grep(给出 grep 模板),命中则走 follow-up issue 流程(UPSTREAM-03-C)
     - `manual` 类别 → 走 line-by-line review 步骤
  4. **Checklist** — 验证步骤: (a) 所有 conflict 已 resolved, (b) Pi-coupling markers = 0 in merged code, (c) `npx tsc --noEmit` exit 0, (d) `npx vitest run` 全绿, (e) `git diff upstream/main --stat` 表格更新, (f) commit message 包含 `upstream-merge: <summary>` 前缀
- **UPSTREAM-02-B (Pi-coupling marker grep 模板 — skill 内嵌):** 提供可直接 copy-paste 的 bash:
  ```bash
  # Pi-coupling marker scan in changed files
  git diff upstream/main --name-only | xargs grep -nE \
    'ExtensionAPI|ExtensionContext|ExtensionUIContext|AgentToolResult|PI_CODING_AGENT_DIR|pi-coding-agent|pi-ai|pi-tui|earendil-works' \
    2>/dev/null | head -50
  ```
  命中 = 走 follow-up issue 流程(UPSTREAM-03-C)。

### 验证 (Dry-run)

- **VERIFY-A (Phase 8 plan 内含 dry-run task):** plan 包含 1 个 dedicated task,设计 2 个 hypothetical upstream 变更场景:
  1. **Scenario 1:** 假设 upstream 修改了 `init.ts` 加了 OAuth refresh token logic(纯核心 MCP 改进,无 Pi-coupling)
  2. **Scenario 2:** 假设 upstream 修改了 `commands.ts` 增加了 `mcp-toggle` command,但实现直接 import `@earendil-works/pi-coding-agent`(重引入 Pi-coupling)
- **VERIFY-B (Resolution log 产物):** dry-run 完成后,生成 `docs/upstream-merge-dry-run-log.md`(或 `.planning/phases/08-upstream-merge-conflict-resolution/dry-run-log.md`),记录:
  - 2 个 scenario 的 conflict 描述
  - skill 推荐的 resolution
  - Pi-coupling marker grep 结果
  - follow-up issue 编号(如果 scenario 2 触发)
  - 最终 commit message 模板
- **VERIFY-C (manifest 静态对齐):** dry-run 之外,plan 包含一个 static-check task — `git fetch upstream` + 把 manifest 5 列表格 vs `git diff --name-status` 对比,任何 divergence 报告为 plan acceptance failure(强制 manifest 反映真实状态)。

### the agent's Discretion

- **DISCRETION-A:** skill 文件的具体 prose 风格(skill 内部不强制 markdown 风格 — GSD skill 模板即可)
- **DISCRETION-B:** manifest 表格排序方式(按路径 / 按 Category / 按 Status — 实施时选择最易 grep 的方式)
- **DISCRETION-C:** dry-run log 放在 `.planning/phases/08/...` 还是 `docs/`(实施时根据 docs 目录现状决定)
- **DISCRETION-D:** SKILL.md 内的具体行数 / 章节标题,只要覆盖 4 个 section 即可

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream Repository
- `https://github.com/nicobailon/pi-mcp-adapter` — upstream fork 源;Phase 8 manifest 的 diff 基准
- 本地 git remote 配置已存在:`upstream` → 上述 URL,`origin` → `https://github.com/njuptlzf/mcp-adapter`

### 既有架构文档 (Phase 1-7 产出)
- `.planning/PROJECT.md` — 项目愿景、v2.0 milestone 目标、Core Principles(Zero-risk refactoring, Easy upstream updates)
- `.planning/REQUIREMENTS.md` §"UPSTREAM: Upstream Merge Conflict Resolution" — UPSTREAM-01..04 原始定义
- `.planning/ROADMAP.md` §"Phase 8" — Phase 8 范围、deliverables、current state (无 plans)
- `.planning/STATE.md` §"Decisions & Preferences" — Phase 1-7 累积的架构决策(Adapter Architecture, Sampling Provider Injection, Entry Point Decoupling 等)

### Phase 1-3 接口与适配器(manifest 表格的 "Path" 列事实来源)
- `interfaces/agent-api.ts` — AgentAPI/UISystem/AgentContext + AGENT_ADAPTERS registry (D-07)
- `interfaces/agent-paths.ts` — AgentPathResolver contract
- `interfaces/sampling.ts` — SamplingProvider abstraction
- `adapters/entry.ts` — agent-agnostic `createMcpAdapter` entry point
- `adapters/pi-adapter.ts`, `adapters/pi-renderer.ts`, `adapters/pi-sampling-provider.ts` — Pi-specific adapter 三角形
- `adapters/qoder-adapter.ts`, `adapters/qoder-renderer.ts`, `adapters/qoder-sampling-provider.ts` — Qoder-specific adapter 三角形

### Phase 5 Decoupling 决策 (UPSTREAM-03 "core MCP logic assess" 判定基础)
- Phase 5 DECOUPLE-01..07 — 6 个 source file 已从 Pi type imports 迁移到 generic interfaces(`proxy-modes.ts`, `direct-tools.ts`, `tool-result-renderer.ts`, `sampling-handler.ts`, `elicitation-handler.ts`, `index.ts`, `agent-dir.ts`)
- 详细 plan 路径见 ROADMAP §"Phase 5"

### Phase 7 UPSTREAM-04 兼容预留
- `.planning/phases/07-integration-test-rebuild/07-LEARNINGS.md` §"D-21" — 新 adapter = 复制 `_template.md` → `<id>.md`,SKILL.md 主体不动
- `.planning/phases/07-integration-test-rebuild/07-CONTEXT.md` §"Phase 8 兼容性预留 (UPSTREAM-04)" — Phase 7 主动为 Phase 8 做准备的设计动机
- `skills/mcp-adapter-test/SKILL.md` (148 行) — 短 parametric 主文件;`references/agent-paths/{pi,qoder,_template}.md` — per-agent references
- `tests/reports/mcp-adapter-test-report.{md,json}` — Matrix Reporter 产物(虽然 gitignored,但 format 展示了 parametric 结构)

### 测试基础设施 (UPSTREAM-01 manifest "test" 类别决策参考)
- `__tests__/adapter-contract.test.ts` — parametric `describe.each(AGENT_ADAPTERS)` 框架
- `__tests__/capability-gate.test.ts` — Capability Gate (D-01..D-03)
- `__tests__/fixtures/mock-agent-api.ts` — generic MockAgentAPI
- `__tests__/compatibility/legacy-pi-mock.test.ts` — deprecated Pi-coupled mock(@deprecated)
- `tests/global-setup.ts` — prebuild safety net(deviation: vitest 3.2.6 SSR race)
- `tests/reporters/matrix-reporter.ts` — MatrixReporter 178 行
- `vitest.config.ts` — 已有 `reporters: ["default", "./tests/reporters/matrix-reporter.ts"]`

### Phase 1-7 累积 LEARNINGS (UPSTREAM-03 "decision tree" 验证基础)
- `.planning/phases/01..07/*-LEARNINGS.md` — 7 个 phase 提取的 D/L/P/S items;UPSTREAM-03 的 "Default Resolution" 列与 LEARNINGS 中的 Decisions 互相印证

### Phase 1-7 SUMMARYs (manifest rationale 引用源)
- `.planning/phases/01..07/*-SUMMARY.md` — 每个 phase 的实施记录,提供 manifest rationale 的事实基础

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AGENT_ADAPTERS` registry** (`interfaces/agent-api.ts`): 静态 adapter 列表,UPSTREAM-01 manifest "adapters" 类别的 ground truth — 任何 upstream 后期加新 adapter 都通过 registry 添加,**不**修改 adapter 实现文件
- **`AgentPathResolver` contract** (`interfaces/agent-paths.ts`): Pi/Qoder 各自的 path resolver 工厂;UPSTREAM-03 中 "adapters/pi-renderer.ts" 保留 ours 的事实来源
- **`SamplingProvider` / `RenderOutput` abstractions** (`interfaces/sampling.ts`, `adapters/pi-renderer.ts`): Phase 5 DECOUPLE-03/05/06 留下的抽象层,UPSTREAM-03-B "Pi-coupling marker" 列表的 "无命中" 证据

### Established Patterns
- **Adapter pattern** (Phase 5-6): 所有 Pi-specific 行为封装在 `adapters/<agent>/*`,core 不直接 import Pi types → UPSTREAM-04 "minimize source edits" 的工程基础
- **Main + per-agent references** (Phase 7 D-21): SKILL.md 拆为"主文件 + per-agent references",新 adapter 不改主文件 → UPSTREAM-03 中 `skills/*` 默认 "keep ours" 的依据
- **Parametric test framework** (Phase 7 D-09): `describe.each(AGENT_ADAPTERS)` 跑同 contract → UPSTREAM-03 中 `__tests__/*` "assess via marker grep" 的判定基础(新 agent 走 parametric,不改现有 test)
- **MockAgentAPI generic fixture** (Phase 7 D-08): `__tests__/fixtures/mock-agent-api.ts` 替代 Pi-coupled `MockAgent` → 未来 upstream 修改 test 时,本地 parametric 框架 + generic mock 减少冲突面

### Integration Points
- **Git remote `upstream`** → `https://github.com/nicobailon/pi-mcp-adapter.git` (已配置,Phase 8 plan 不需要 setup)
- **`UPSTREAM-CHANGES.md`** → 仓库根目录,Phase 8 创建后被 `skills/upstream-merge/SKILL.md` 引用
- **`skills/upstream-merge/SKILL.md`** → 新建 skill 目录,Phase 8 创建;agent 通过 skill 触发器 `/upstream-merge` 调用
- **`.planning/phases/08-upstream-merge-conflict-resolution/`** → Phase 8 plan / dry-run log / SUMMARYs 落地

</code_context>

<specifics>
## Specific Ideas

- **D-21 forward-compat 已经发生:** Phase 7 SKILL.md 拆分是 Phase 8 的"免费"前置工作。Phase 8 plan 不需要 backport D-21,只需在 UPSTREAM-01 manifest 表格的 `skills/mcp-adapter-test/SKILL.md` 行的 Rationale 列引用 D-21。
- **Pi-coupling marker list 是 skill 自动化的核心:** 简单 grep 列表胜过 prose 描述。UPSTREAM-02 skill 必须给出可直接 copy-paste 的 grep 命令(已在 UPSTREAM-02-B 决策中固化)。
- **dry-run scenarios 必须真实可触发:** Scenario 1(OAuth refresh in init.ts)和 Scenario 2(mcp-toggle in commands.ts with Pi import)选择这两个是因为它们对应真实可能出现的 upstream 变更类型 — OAuth 是 upstream 实际常见的 bugfix area, mcp-toggle 是新 feature area。
- **manifest 的 "Default Resolution" 列是 agent 的 fast path:** agent 读 manifest 不需要每次跑 grep;`ours`/`theirs` 行直接 git checkout --ours/--theirs,只有 `assess` 行才跑 marker grep。
- **skill 不替代 git merge 工具:** skill 提供 decision guidance,实际 merge 仍走 `git merge upstream/main` + 编辑器解决 conflict。skill 的价值是减少决策时间和避免主观判断错误。
- **避免 scope creep:** Phase 8 **不**实施实际的 upstream merge(那是未来触发);**不**创建 CI hook 自动检测 divergence(避免 GitHub Actions 配置);**不**改写任何已稳定的 source file(D-21 已确保)。

</specifics>

<deferred>
## Deferred Ideas

- **CI hook / GitHub Action 自动化 divergence check:** 未来如果 upstream 频繁变更,可能想加 `.github/workflows/upstream-divergence.yml` 自动跑 `git diff upstream/main` 并开 issue。Phase 8 留作 follow-up,不实施。
- **Merge conflict 自动 resolve bot:** 未来可以基于 UPSTREAM-03 规则写一个 bot(用 `gh` CLI + simple scripting)自动处理 `ours`/`theirs` 行的 conflict,只让 `assess` 行进编辑器。Phase 8 留作 follow-up。
- **upstream patch 反向 contribute:** 如果本地 fix 对 upstream 也有价值(e.g. parametric test framework 改进),可以通过 `gh pr create upstream` 反向 contribute。Phase 8 留作 follow-up,需要单独讨论 license + contribution agreement。
- **定期 manifest 刷新 schedule:** 未来可以每季度 review manifest 一次(尤其 upstream 大版本发布时)。Phase 8 留作 follow-up。

None of the above belong in Phase 8's scope — they're correctly deferred to "future trigger" categories.

</deferred>

---

*Phase: 08-upstream-merge-conflict-resolution*
*Context gathered: 2026-06-17 via discuss-phase (4 gray areas discussed, all decisions captured)*
