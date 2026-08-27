# Phase 0 验收清单：index.ts vs adapters/entry.ts 功能差异

> 配套 [architecture-review.md](./architecture-review.md)。
> 目的：量化「并行引擎」导致的 feature drift，作为「fork 宿主」改造（Phase 1）合并后的验收基准。
> 图例：
> - ✅ 应补齐 —— agent-agnostic 的 MCP 能力，Parallel 引擎当前静默丢失；改造后经上游 index.ts 引擎「免费」回来，只需宿主 shim 满足底层 ExtensionAPI 面。
> - 🔵 宿主专属 —— Pi 宿主特有；Universal 侧由宿主 shim 转发 config 或降级为 no-op ／ MCP 等价物。
> - index.ts 行号基于 v2.27.0 merge 后（约 L1–1171）；adapters/entry.ts 共 389 行。

---

## A. 生命周期与鲁棒性（7 项）

| # | 功能 | index.ts 出处 | adapters/entry.ts 现状 | 类 | 验收标准 |
|---|---|---|---|---|---|
| A1 | init 30s 超时 | `awaitWithTimeout`+`INIT_WAIT_TIMEOUT_MS`(L55,598,897,1015) | 直接 await initPromise，无超时 | ✅ | init 挂起时 30s 内返回「仍初始化中」而非无限等待 |
| A2 | init 失败记忆 + 重试指引 | `retainInitFailure`/`buildInitRetryInstruction`(L116–130) | 仅 console.error | ✅ | 失败后再次调用返回可操作的修复指引 |
| A3 | 失败后网关自动重试 | `startGatewayRetryInitialization`(L135,1009) | 无 | ✅ | 配置失败进阶为 stale 后自动重建 |
| A4 | abort-owner 生命周期 | `createMcpRuntimeOwner`/`isOwnerAbortError`/`throwIfInactive`(L22,131,556…) | 无 | ✅ | 会话重启/shutdown 时旧回调被同步中止 |
| A5 | keep-alive 收敛（input 钩子） | pi.on(input) → ensureConverged(L592–613) | 无 | ✅ | 用户输入前 keep-alive 服务器健康收敛 |
| A6 | 启动期 eager/keep-alive 初始化 | `startLoadTimeInitialization`(L502,1142) | 无 | ✅ | 配置了 eager/keep-alive 的服务器启动即连 |
| A7 | 元数据更新回调 + freezeDirectTools | `onToolMetadataUpdated`/`directToolsFrozen`(L487–496) | 无 | ✅ | 服务器元数据变更时 re-sync direct/prompt；支持 freezeDirectTools |

## B. 命令面（4 项）

| # | 功能 | index.ts 出处 | adapters/entry.ts 现状 | 类 | 验收标准 |
|---|---|---|---|---|---|
| B1 | /mcp 参数补全 | `getArgumentCompletions`(L645–690) | 无 | 🔵 | 宿主 shim 原样转发命令 config；支持补全的宿主生效，否则忽略 |
| B2 | 子命令 prompts／token／disable／enable | L734,761,776 | 仅 reconnect/tools/setup/logout/status | ✅ | 四子命令经宿主转发可用；宿主无对应能力则文档化降级 |
| B3 | pi-mcp 别名命令 | L827 | 无 | 🔵 | Pi 专属别名；Universal 不需要 |
| B4 | /mcp-auth 认证成功后重连 | L873–877 | 简化版无 reconnect | ✅ | OAuth 成功后自动 reconnect 该服务器 |

## C. 工具面（11 项）

| # | 功能 | index.ts 出处 | adapters/entry.ts 现状 | 类 | 验收标准 |
|---|---|---|---|---|---|
| C1 | mcpScript 批处理工具 | L881–927 | 无 | ✅ | 受 settings.scriptMode 控制的一体化脚本工具可用 |
| C2 | proxy 富 schema：args 可为 object 或 string、instructions、limit、offset | L939–955 | 旧 schema（string-only，缺 3 参数） | ✅ | proxy 工具接受 object args 与 instructions／limit／offset |
| C3 | gateway 参数嵌套拒绝 | `hasGatewayMode`(L996–1006) | 无 | ✅ | 把 gateway 参数误塞进 args 时报清晰错误 |
| C4 | renderShell + 渲染器选项 | L935–936 | 裸 renderCall | ✅ | compact／自渲染与 toolRenderOptions 生效 |
| C5 | proxy 工具动态注册／注销 | `syncProxyTool`(L1102–1133) | 静态一次 | ✅ | disableProxyTool 变更时增删 mcp 工具 |
| C6 | direct 工具动态 re-sync（fingerprint／added／updated／deactivated） | L310–333 | 静态一次 | ✅ | 元数据变化时按指纹增量增删改 |
| C7 | strictDirectToolArguments → prepareArguments | L246–247 | 无 | ✅ | strict 模式下参数预校验 |
| C8 | 面板开关 applyDirectToolConfigChanges + syncToolSurface 通知 | L335–351 | 无 | ✅ | 面板切换 direct／proxy 后即时生效并通知 |
| C9 | namespace 代理工具 mcp__server | `syncNamespaceTools`(L358,1141) | 无 | ✅ | 每个 proxy-only 服务器暴露 mcp__server 命名空间工具 |
| C10 | prompt 命令 | `registerPromptCommands`/`syncPromptCommands`(L372–380) | 无 | ✅ | 缓存中的 MCP prompt 注册为命令 |
| C11 | TypeBox 兼容 normalize | `toToolParameters`(L223) | 直接 Unsafe | ✅ | 处理 OMP TypeBox shim 缺 Unsafe 的情况 |

## D. 运行时注册 & 事件（4 项）

| # | 功能 | index.ts 出处 | adapters/entry.ts 现状 | 类 | 验收标准 |
|---|---|---|---|---|---|
| D1 | 运行时服务器注册 API | `registerMcpServer` export + runtimeRegistrars + attachRuntimeServerLifecycle(L213,384,1162) | 无 | ✅ | 其他扩展可运行时注册／销毁 server |
| D2 | 状态事件发布 | `publishMcpStatusShutdown(pi.events)`(L149) | shutdownState 缺 | ✅ | 宿主 shim events 至少为 no-op 或转 MCP 通知 |
| D3 | 工具错误改写 | pi.on(tool_result) → toolErrorOverride(L641) | 无 | 🔵 | Pi 错误面；Universal 走 MCP 结果 details.error |
| D4 | 失败 backoff 过滤 direct tools | `activeFailureServers`(L262) | 无 | ✅ | backoff 中的服务器不在 direct 列表暴露 |

## 汇总

| 类 | 数量 |
|---|---|
| ✅ 应补齐（改造后经上游引擎「免费」回来） | 22 |
| 🔵 宿主专属（shim 转发或降级） | 4 |
| 合计 | 26 |

## 验收结果（Phase 1.6 — Phase 0 关闭）

> 引擎已统一为上游 `index.ts`（`adapters/entry.ts` 已删）→ 22 项 ✅ 经上游引擎「免费」回来；4 项 🔵 为宿主转发/降级。
> 验证证据三层：① 引擎单测 `__tests__/index-lifecycle.test.ts`(58) + `runtime-register.test.ts` + `mcp-code.test.ts` + `tool-result-renderer.test.ts`；② 宿主边界 `__tests__/universal-host-acceptance.test.ts`（Phase 1.6 新增）；③ smoke（`mcp-server.mjs --help`）+ 全量 `npx vitest run`。

| # | 类 | 结果 | 证据 |
|---|---|---|---|
| A1 init 30s 超时 | ✅ | ✅ | `index-lifecycle` L555/L1498（初始化 stall 有界等待） |
| A2 init 失败记忆 + 重试指引 | ✅ | ✅ | `index-lifecycle` L1530/L1559/L1588（retainInitFailure/retry guidance） |
| A3 网关失败自动重试 | ✅ | ✅ | `index-lifecycle` L1530（proxy 侧重试初始化） |
| A4 abort-owner 生命周期 | ✅ | ✅ | `index-lifecycle` L1466/L1913（shutdown 中止未决 init） |
| A5 keep-alive 收敛（input 钩子） | ✅ | ✅ | `index-lifecycle` L495/L588；`universal-host-acceptance`（fireInput 无抛） |
| A6 启动期 eager/keep-alive init | ✅ | ✅ | `index-lifecycle` L1325/L1386（load-time init） |
| A7 元数据更新 + freezeDirectTools | ✅ | ✅ | `index-lifecycle` L639/L677（freeze/metadata 热更新） |
| B1 /mcp 参数补全 | 🔵 | 🔵 降级 | `host.registerCommand("mcp")` 转 config；MCP stdio 无命令行面 → no-op |
| B2 子命令 prompts/token/disable/enable | ✅ | ✅ 转发 | `index-lifecycle` L1630/L1713/L1734（经 host 命令面转发） |
| B3 pi-mcp 别名命令 | 🔵 | 🔵 降级 | 注册于 `host.commands`；MCP stdio 无命令面 → no-op |
| B4 /mcp-auth 成功后 reconnect | ✅ | ✅ | `index-lifecycle` L1840/L1869 |
| C1 mcpScript 批处理工具 | ✅ | ✅ | `universal-host-acceptance`（注册）；`mcp-code.test.ts`（执行） |
| C2 proxy 富 schema | ✅ | ✅ | `universal-host-acceptance`（args object|string + instructions/limit/offset/server）；`index-lifecycle` L961 |
| C3 gateway 参数嵌套拒绝 | ✅ | ✅ | `index-lifecycle` L1006/L1034 |
| C4 renderShell + 渲染器选项 | ✅ | ✅ | `index-lifecycle` L304/L333（compact/boxed） |
| C5 proxy 动态注册/注销 | ✅ | ✅ | `universal-host-acceptance`（setActiveTools）；`index-lifecycle`（syncProxyTool） |
| C6 direct 动态 re-sync | ✅ | ✅ | `index-lifecycle` L458/L844 |
| C7 strictDirectToolArguments | ✅ | ✅ | `index-lifecycle` L1179 |
| C8 面板开关即时生效 | ✅ | ✅ | `index-lifecycle` L1257（memory-config 状态通知） |
| C9 namespace 代理工具 | ✅ | ✅ | `index-lifecycle` L710；`namespace-tools.test.ts` |
| C10 prompt 命令 | ✅ | ✅ | `index-lifecycle` L1684（prompt 热注册） |
| C11 TypeBox normalize | ✅ | ✅ | `index-lifecycle` L349/L385/L413 |
| D1 运行时注册 registerMcpServer | ✅ | ✅ | `runtime-register.test.ts`（全路径）；`universal-host-acceptance`（未安装抛错） |
| D2 状态事件发布 | ✅ | ✅ | `universal-host-acceptance`（shutdown 发 `MCP_STATUS_EVENT`）；`index-lifecycle` L789 |
| D3 工具错误改写 | 🔵 | 🔵 降级 | `index-lifecycle` L1959（tool_result 改写）；Universal 走 MCP results `details.error` |
| D4 backoff 过滤 direct tools | ✅ | ✅ | `index-lifecycle` L677/L710 |

**结论**：26/26 处理完毕。22 ✅ 经统一上游引擎生效（三层测试证据）；4 🔵 已明确「转发/降级/no-op」语义；宿主 shim 最小面满足，无需再补 `ExtensionAPI` 面。Phase 0 关闭，本清单归档。
