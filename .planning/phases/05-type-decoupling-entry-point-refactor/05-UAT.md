---
status: complete
phase: 05-type-decoupling-entry-point-refactor
source: 05-00-SUMMARY.md, 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md
started: 2026-06-16T13:15:00+08:00
updated: 2026-06-16T13:25:00+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: 运行 `npx tsc --noEmit` 应无错误通过；运行 `npx vitest run --exclude='**/interactive-visualizer-server.test.ts'` 应全部通过（475 个测试），无回归失败。
result: pass

### 2. Pi Backward Compatibility — mcpAdapter 入口不变
expected: `index.ts` 中 `mcpAdapter(pi: ExtensionAPI)` 默认导出保持不变，`piMcpAdapter` 别名仍然存在，已有 Pi 集成测试（`__tests__/pi-adapter.test.ts`、`__tests__/index-lifecycle.test.ts`）全部通过。
result: pass

### 3. Agent-Agnostic Entry Point — createMcpAdapter
expected: `adapters/entry.ts` 导出 `createMcpAdapter(agentapi, ctx, config, cache)` 函数，接受通用 `AgentAPI` 而非 `ExtensionAPI`；`__tests__/entry.test.ts` 中有对应测试覆盖。
result: pass

### 4. MCP_AGENT_DIR 环境变量支持
expected: `agent-dir.ts` 中 `getAgentDir()` 优先读取 `MCP_AGENT_DIR`，`PI_CODING_AGENT_DIR` 作为向后兼容回退；`__tests__/agent-paths-integration.test.ts` 中相关测试通过。
result: pass

### 5. Type Decoupling — 核心文件零 Pi 类型导入
expected: `proxy-modes.ts`、`direct-tools.ts`、`tool-result-renderer.ts`、`sampling-handler.ts`、`elicitation-handler.ts`、`agent-dir.ts` 六个核心文件中无 `@earendil-works/pi-ai`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui` 的直接导入。
result: pass

### 6. Sampling Provider — 采样通过通用接口
expected: `sampling-handler.ts` 使用通用 `SamplingProvider` 接口（定义在 `interfaces/sampling.ts`），Pi 采样通过 `PiSamplingProvider`（`adapters/pi-sampling-provider.ts`）桥接；采样相关测试（`__tests__/sampling-handler.test.ts`、`__tests__/pi-sampling-provider.test.ts`、`__tests__/server-manager-sampling.test.ts`）共 22 个全部通过。
result: pass

### 7. Elicitation & Rendering — 通过 UISystem / RenderOutput
expected: `elicitation-handler.ts` 使用通用 `UISystem` / `FormConfig`（不再导入 `ExtensionUIContext`）；`tool-result-renderer.ts` 返回字符串 `RenderOutput`（不再导入 `@earendil-works/pi-tui`）；Pi 渲染通过 `adapters/pi-renderer.ts` 的 `piRenderWrapper` 桥接为 Pi `Text`。
result: pass

### 8. 全量测试套件最终验证
expected: 运行全量测试 `npx vitest run --exclude='**/interactive-visualizer-server.test.ts'` 全部 475 个测试通过，无失败或跳过。
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
