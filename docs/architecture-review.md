# mcp-adapter 架构评审与改造方案（upstream-sync 友好型）

> 状态：已与作者确认方向（2026-08-25）；**Phase 1「fork 宿主、不 fork 引擎」已落地**（见 [phase1-fork-host-refactor-plan.md](./phase1-fork-host-refactor-plan.md)）。本评审现为历史决策记录。
> 决策记录，非代码。配套验收清单已归档：[phase0-feature-diff-checklist.md](../.planning/milestones/phase0-feature-diff-checklist.md)。

---

## 0. 已确认的三个决策

1. **方向：fork 宿主，不 fork 引擎** —— 不继续维护 `adapters/entry.ts` 这套与上游 `index.ts` 并行的注册引擎。
2. **取舍：接受 Universal host 伪装成 `ExtensionAPI`** —— 对齐 `docs/upstream-merge-retrospective.md` §9.1 的「Pi 优先 + 兼容」定位。
3. **产物：本评审 + Phase 0 feature 差异验收清单**（见配套文件）。

---

## 1. 现状（证据）

### 1.1 README 定位

「Universal MCP Adapter」：Pi 是一等公民（Branch A 原生扩展），其他所有支持 MCP 协议的 agent 走 Branch C（`mcp-server` stdio 入口），运行时通过 MCP 协议发现能力；单一事实源是 `interfaces/agent-api.ts` 里的 `AGENT_ADAPTERS`。定位自身清晰合理。

### 1.2 实际是「两个引擎 + 一层半残抽象」

文档（`docs/architecture-comparison.md`、`.planning/codebase/ARCHITECTURE.md`）画的理想图是「core 全用 `AgentAPI`，Pi 只在 `adapters/pi-adapter.ts` 一处」。真实代码不是：

| 层 | 文件 | 谁在用 | 状态 |
|---|---|---|---|
| 上游 Pi 引擎 | `index.ts`(1171 行) + 13 个 core 文件 | 真实 Pi 生产路径 | 99% 上游原样（只差 4 个 `: any`） |
| fork 并行引擎 | `adapters/entry.ts`(389 行) | `bin/mcp-server.ts`、`deploy-verify`、测试 | 纯 fork 文件，与 `index.ts` 重复 ~70% 逻辑 |
| fork 抽象层 | `interfaces/agent-api.ts` + `adapters/pi-adapter.ts` | 仅测试 / `AGENT_ADAPTERS` 注册表 | **Pi 生产路径不用它** |

关键证据：

- `index.ts` 的 `installMcpAdapter(pi)` 自行直接调用 `pi.registerTool / pi.on / pi.events / pi.registerCommand / pi.registerFlag / pi.getAllTools() / pi.setActiveTools()`，不经过 `AgentAPI` / `PiAdapter`。
- `adapters/entry.ts` 的 `createMcpAdapter(agentapi, ctx, config, cache)` 另起炉灶，把「session 生命周期 + `/mcp` + `/mcp-auth` + proxy tool + direct tool + OAuth」用 `agentapi.xxx` 重写，再从同一批 core 借函数。
- 两者能共用 core，不是 core 真的 agent 无关，而是 pi-* 的 `.d.ts` 发布物断链使 `ExtensionAPI` 整体退化 `any`，`AgentAPI` 与 `ExtensionAPI` 靠鸭子类型「碰巧能对上」。

### 1.3 分歧数据：已经很干净

`git diff upstream/main --name-status` 中被修改的代码型上游文件只有：

| 文件 | +/− | 真实内容 |
|---|---|---|
| `index.ts` | 4/4 | 4 个 `: any` 注解 |
| `commands.ts` | 5/5 | 最小 `: any` 注解 |
| `mcp-code.ts` | 1/1 | `: any` 注解 |
| `sampling-handler.ts` | 3/3 | `: any` 注解 |
| `config.ts` | 29/12 | **唯一真正的 fork 逻辑**（4 参 `getConfigSources` + `--config` 修复） |
| 2 个测试 | 35/4 | 测试合并 |

即 core 13 文件已经全部 `--theirs` 接受上游；改动面只剩 `config.ts`（真 fork 逻辑）和 4 个文件的 `any` 补丁。这与 `.planning/upstream-merge-v2.27.0-status.md` §2「非侵入式 facade，不内联改上游」一致。

### 1.4 「改了好多版」的真正来源

sync 分支上 `fcd33e9` 合并 + 9 个 fix-up commit，成本已不是 git 冲突，而是**语义重移植**：57 个 tsc 错误分 A 类（19 个 facade 边界）与 B 类（38 个 pi-* 类型不匹配），几乎全部来自「`adapters/entry.ts` + `interfaces/*` 重新对上新的上游 core 签名」，外加 SDK v1→v2 迁移、facade 契约放宽、pi-* shim、3 个 CI 脚本修复。

---

## 2. 根因诊断

- **A（主因）并行引擎**：`index.ts` 与 `adapters/entry.ts` 是同一份注册逻辑的两份实现。上游每次改注册逻辑，后者不会自动跟上，只能人肉重移植。双份真源的永久 drift。
- **B `AgentAPI` 是 `ExtensionAPI` 的子集**：`AgentAPI` 只有 8 方法，而上游引擎实际用到的 `ExtensionAPI` 面更大（`pi.events`、`setActiveTools/unregisterTool/getActiveTools`、`getPiTools`）。所以当初被迫写一个「只覆盖 8 方法子集」的缩水引擎，**静默丢掉**了 26 项功能（见验收清单）。
- **C 4 个 `: any` 是 pi-* 发布物 bug 的症状补丁**：`@earendil-works/pi-*@0.84.x` 的 `.d.ts` 用 `.ts` 扩展名 re-export 但 tarball 不含 `.ts`，NodeNext 断链 → 类型退化 `any` → 25 个 `TS7006`。这 4 个补丁是唯一会撞行的 in-place 修改，应消除。
- **D `config.ts` 是唯一真正的 in-place fork 逻辑**，需收敛冲突面。
- **E 命名撞车**：上游 `index.ts:1145` 已有 `createMcpAdapter(options)`，fork 的 `adapters/entry.ts:60` 又导出同名不同参的 `createMcpAdapter(agentapi, ...)`。

---

## 3. 目标架构：fork 宿主，不 fork 引擎

装饰器方向正确，但要「装饰到底」——不要 fork 引擎，要 fork 宿主：把任意 MCP agent 装饰成 `ExtensionAPI`，从而让上游 `index.ts` 引擎一行不改地跑起来。

```text
                 ┌───────────────────────────────────────────────────┐
                 │   fork-only 宿主装饰层（新文件，永不与上游冲突）     │
                 │  bin/mcp-server.ts                                │
                 │  adapters/universal-host.ts  ← 核心新增           │
                 │     实现完整 ExtensionAPI 运行时形状               │
                 │     (见下「宿主 shim 最小面」)                      │
                 └───────────────────────┬───────────────────────────┘
                                         │  看起来就是一个 "pi"
                                         ▼
        ┌──────────────────────────────────────────────────────────┐
        │      上游引擎（一行不改，全 --theirs，byte-identical）      │
        │      index.ts  installMcpAdapter(pi, options)             │
        │      + core: init.ts / proxy-modes.ts / commands.ts /    │
        │        direct-tools.ts / namespace-tools.ts / …          │
        └────────────┬──────────────────────────────┬──────────────┘
                     │ ExtensionAPI                 │ ExtensionAPI
                     ▼                              ▼
              ┌─────────────┐              ┌──────────────────────────┐
              │   Pi 原生    │              │ 任何 MCP agent（stdio）   │
              │  (现状不变)   │              │ 经 mcp-server bin 接入    │
              └─────────────┘              └──────────────────────────┘
```

要点：

1. **退休 `adapters/entry.ts` 的引擎职责**（其「8 方法子集」重写是 drift 根源）。
2. **新增 `adapters/universal-host.ts`**：把 `bin/mcp-server.ts` 里现有最小 `AgentAPI` 实现升级成完整 `ExtensionAPI` 运行时形状，然后调用上游 `createMcpAdapter({config})(universalHost)`。
3. **用 fork-only 类型显式固定宿主面**（如 `interfaces/pi-extension-surface.ts`），替代靠 `any` 退化「碰巧能跑」的隐性契约。

### 宿主 shim 最小面（据 core 实际调用点归纳）

| 面 | 用途 | 出处 |
|---|---|---|
| `registerTool(tool)` | 直连/proxy/namespace/script 工具 | index.ts |
| `registerCommand(name, cfg)` | /mcp、/mcp-auth、prompt 命令 | index.ts |
| `registerFlag(name, cfg)` | `mcp-config` flag | index.ts |
| `on(event, handler)` | session_start/shutdown、input、tool_result | index.ts |
| `getAllTools()` | 工具消歧、namespace 工具 | core |
| `getFlag(name)` | flag 读取 | core |
| `sendMessage / exec` | 消息/命令执行 | core |
| `events` | approvalEvents、status 事件 | init.ts / mcp-status.ts |
| `getActiveTools?() / setActiveTools() / unregisterTool()` | direct/namespace 动态同步 | namespace-tools.ts |
| （config 转发）`getArgumentCompletions`、`renderShell`、`prepareArguments`、`promptSnippet` | 宿主只需原样转发工具/命令 config blob | index.ts |

> 关键洞察：`getArgumentCompletions` / `renderShell` / `prepareArguments` 不是独立 `ExtensionAPI` 方法，而是**引擎传给 `registerTool`/`registerCommand` 的 config 里的键**。宿主 shim 只需原样转发整个 config。因此「宿主 shim」面其实很小（上表 ~13 个方法 + config 转发），Phase 1 是可落地的；多数 feature parity 通过 config 转发「免费」回来。

---

## 4. 分阶段落地

- **Phase 0**：确认双引擎是唯一架构债；以 `phase0-feature-diff-checklist.md` 的 26 项为「合并后 Universal 又长回来了什么」的验收基准。
- **Phase 1（治本）**：实现宿主装饰器；`bin/mcp-server.ts` 改调上游 `createMcpAdapter`；删 `adapters/entry.ts` 引擎逻辑；按 26 项逐项验收。
- **Phase 2**：4 个 `: any` 移出上游文件（扩展 `types/pi-host-shims.d.ts` 或 `tsconfig` paths 指向 fork 自有声明），使 `index.ts/commands.ts/mcp-code.ts/sampling-handler.ts` 回到 0 diff。
- **Phase 3**：`config.ts` 的 fork 逻辑封成自有函数、只留一个调用点。
- **Phase 4（可选，长期最优）**：把 `AgentAPI` 抽象 PR 回上游，让上游 core 也只依赖 8 方法子集——唯一不产生双引擎的「协作上游」路线，需上游认可。

## 5. 收益（对照现状）

| 指标 | 现状 | 改造后 |
|---|---|---|
| 上游 `.ts` in-place 修改 | `config.ts` + 4 个 `: any`（5 个） | 只剩 `config.ts` 1 个 |
| core 冲突面 | 已 `--theirs`，但 `: any` 补丁仍撞行 | core 全 0 diff，`--theirs` 即完 |
| 发版语义重移植 | 9 fix-up + 57 tsc 错误 | 上游未动 `ExtensionAPI` 面→近 fast-forward；动了→只改 `universal-host.ts` + `pi-extension-surface.ts` |
| 双引擎 drift | Pi 与 Universal 功能不一致（丢 26 项） | 单引擎，Universal 补齐 Pi 功能 |
| 命名/类型安全 | 两个 `createMcpAdapter`；`any` 退化 | 单入口；宿主面显式契约 |

## 6. 分发策略（决策记录）

见 §「分发」结论：npm scoped 包 `@njuptlzf/mcp-adapter` + GitHub Release 预构建 `mcp-server.mjs`，一条 tag 驱动双通道。

## 7. 风险与取舍

1. 「伪装成 ExtensionAPI」把 Universal host 绑到 Pi 运行时形状——正是当初用 `unknown` 想避开的；换来「不再维护并行引擎」。对「下游 fork、sync 优先」定位，取舍值得。
2. `AgentAPI`/`PiAdapter` 改造后要么退休、要么降级为 `universal-host` 内部契约（保留 `AGENT_ADAPTERS` 测试矩阵）。
3. Phase 1 有一次性工作量（写 `universal-host.ts` + 补齐缺失功能），先变慢后变快。
4. `skills/upstream-merge` 决策树随 core 0 diff 简化：`special-cases.md` 里 `index.ts` 的 `decoupled-wrapper` 状态将改为「byte-identical `--theirs`」。
