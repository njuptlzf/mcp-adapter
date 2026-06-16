# Phase 6: Second Agent Adapter - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

实现 Qoder 的 `AgentAPI` 适配器（`QoderAdapter`），证明 `createMcpAdapter` 通用入口的可移植性——非 Pi agent 可以通过实现 `AgentAPI` 接口接入 MCP 能力，且与 Pi 适配器达到功能对等。

</domain>

<decisions>
## Implementation Decisions

### Target Agent & Approach
- **D-01:** 目标 agent 为 **Qoder**（当前运行环境），直接对接真实 Qoder API（非 mock）。
- **D-02:** 功能范围为**完整对等**——实现 `AgentAPI` 所有方法（registerTool、registerCommand、registerFlag、on、getAllTools、getFlag、sendMessage、exec），与 PiAdapter 能力持平。

### Path Resolution
- **D-03:** Qoder 的 `AgentPathResolver` 默认路径为 `~/.qoder/agent/`，`MCP_AGENT_DIR` 环境变量可覆盖。
- **D-04:** 工厂函数命名为 `createQoderResolver`，放入 `interfaces/agent-paths.ts` 或独立文件。

### Sampling
- **D-05:** 实现 **Qoder 采样**（`QoderSamplingProvider`），对接 Qoder 的 LLM API。需探索 Qoder 如何调用模型（是否有 model/complete 等价 API）。
- **D-06:** 采样边界隔离在 `adapters/qoder-sampling-provider.ts`，不污染通用 `sampling-handler.ts`。

### UI System
- **D-07:** UISystem 实现为**最小版本**——仅 `notify`（消息通知）。`form`、`statusBar`、`theme` 为可选方法（`UISystem` 接口已支持 optional）。

### Commands & Events
- **D-08:** `registerCommand` 对接 Qoder 的 `/` 斜杠命令系统，将 MCP 工具命令注册到 Qoder 命令面板。
- **D-09:** `on` 事件系统通过 Qoder 消息系统模拟（如 `sendMessage`），不依赖 Pi 式的 `on('event', cb)` 原生机制。

### Testing & Verification
- **D-10:** 验证策略为**全流程对等**——跑 `mcp-adapter-test` 的完整流程（Section 4 MockAgent 兼容性 → Section 5 token benchmark → Section 6 E2E 全量 10 个 demo MCP server），产出与 Pi 适配器对等的报告。

### File Structure
- **D-11:** 文件布局：
  - `adapters/qoder-adapter.ts` — AgentAPI 实现
  - `adapters/qoder-sampling-provider.ts` — 采样适配器（如实现）
  - `adapters/qoder-renderer.ts` — 渲染适配器（如需要）
  - `interfaces/agent-paths.ts` 或独立文件 — `createQoderResolver`
  - `__tests__/qoder-adapter.test.ts` — 契约测试
  - `__tests__/qoder-adapter-integration.test.ts` — 集成测试

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Interfaces (Phase 1-5 产出)
- `interfaces/agent-api.ts` — AgentAPI、AgentContext、UISystem、ToolInfo 接口定义
- `interfaces/sampling.ts` — SamplingProvider、SamplingModel、SamplingRequest 接口
- `interfaces/agent-paths.ts` — AgentPathResolver 契约
- `adapters/entry.ts` — createMcpAdapter 通用入口（目标调用方）
- `adapters/pi-adapter.ts` — PiAdapter 参考实现（模式参照，不是复制）

### Phase 5 Output
- `adapters/pi-sampling-provider.ts` — PiSamplingProvider 参考（Qoder 采样参照此模式）
- `adapters/pi-renderer.ts` — piRenderWrapper 参考（如需 Qoder 渲染桥接）

### Project Docs
- `.planning/ROADMAP.md` — Phase 6 目标和需求
- `.planning/REQUIREMENTS.md` — ADAPTER-01、ADAPTER-02、ADAPTER-03 需求定义
- `MAPPING.md` — 接口映射文档

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `adapters/pi-adapter.ts` — 完整的 AgentAPI 实现参考，展示了 adaptPiContext、adaptCommand 等模式
- `adapters/entry.ts` — createMcpAdapter() 是适配器的消费方，了解其调用约定
- `interfaces/agent-api.ts` — 所有接口方法签名已定义，QoderAdapter 只需实现

### Established Patterns
- **Adapter Pattern**: Pi 特有逻辑 → `adapters/pi-*.ts`；通用核心 → `*.ts`（如 sampling-handler.ts）
- **Provider Injection**: SamplingProvider 通过 AgentContext 注入，init.ts 按需启用
- **Renderer Wrapper**: 通用代码返回字符串，agent 特有渲染在 `adapters/` 中包装

### Integration Points
- `init.ts` → `manager.setSamplingConfig(ctx.samplingProvider)` — 采样注入点
- `index.ts` / `createMcpAdapter()` — 入口点，决定使用哪个适配器
- `__tests__/` 下的契约测试模式 — 参照 `pi-adapter.test.ts` 写 Qoder 版本

</code_context>

<specifics>
## Specific Ideas

- 用户期望适配器完整功能对等（非最小 POC），便于后续反合上游时保持架构一致性。
- `~/.qoder/agent/` 作为 Qoder 默认配置路径，与 Pi 的 `~/.pi/agent/` 对等。
- E2E 验证要求与 Pi 适配器同等覆盖（10 server），确保"for every agent"不只是口号。

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Second Agent Adapter*
*Context gathered: 2026-06-16*
