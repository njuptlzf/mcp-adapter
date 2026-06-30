# Phase 12: Universal MCP Stdio Server — Protocol-Category Simplification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 12-Universal MCP Stdio Server — Protocol-Category Simplification
**Areas discussed:** Architecture & Registry (pre-discussion), Protocol Forwarding (pre-discussion), Backward Compatibility, Sampling Approval Model, SKILL.md Simplification, Integration Test Strategy

---

## Pre-Discussion Decisions (from investigation conversation)

Before entering discuss-phase, 9 decisions were already confirmed through an extensive architecture investigation:

| Decision | Choice |
|----------|--------|
| D-01: AGENT_ADAPTERS | Pi + universal-mcp entry |
| D-02: Config path | Fully universalized |
| D-03: Pi positioning | Branch A only |
| D-04: Delete per-agent adapters | Yes — kilo, qoder, store, qoder-sampling-provider |
| D-05: Universal server entry | bin/kilo-mcp-server.ts → bin/mcp-server.ts |
| D-06: ProtocolSamplingForwarder | Implement SamplingProvider via server.createMessage() |
| D-07: ProtocolElicitationForwarder | Implement UISystem.form via server.elicitInput() |
| D-08: Advanced features | Best-effort — TUI/renderers remain Pi-only |
| D-09: Tests & README | Integration tests verify universal server; README declares verified agents |

---

## Backward Compatibility — bin Command Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Keep kilo-mcp-server alias | Register both mcp-server + kilo-mcp-server in package.json bin | |
| Direct rename + docs | Only register mcp-server, document migration in CHANGELOG | |
| Keep + deprecation warning | Old commands output deprecation warning, removed next major version | |

**User's choice:** Other — "只注册 mcp-server，在 CHANGELOG 中说明迁移步骤。Readme只保留最新描述，因为这个项目还没有上线"
**Notes:** Project has not launched yet, so there are no existing users to break. No need for backward compatibility aliases. README only contains latest description.
**Decision:** D-10

---

## Sampling Approval Model — Protocol Forwarding

| Option | Description | Selected |
|--------|-------------|----------|
| Forward + config gate | Check config.settings.sampling before forwarding; Agent handles approval | |
| Pure forwarding, no config | Unconditionally forward if Agent declares sampling capability; Agent handles everything | ✓ |
| Forward + local approval | Local approval if UI available (effectively pure forwarding in Branch C) | |

**User's choice:** Pure forwarding, no config control
**Notes:** mcp-adapter does not check any config settings. If Agent declares sampling capability, unconditionally forward. Same logic applies to Elicitation. Agent is fully responsible for user approval, LLM call, and result.
**Decision:** D-11

---

## SKILL.md Branch Simplification — User Interaction Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: Pi vs Other | Single question: "Pi or other MCP-compatible agent?" No registry reading | ✓ |
| Registry-driven: Pi + universal | Keep registry read and agent selection, list has Pi + "any MCP-compatible agent" | |
| No identification: two options | Skip agent identification entirely, show two deployment options directly | |

**User's choice:** Minimal: Pi vs Other
**Notes:** Phase 0 asks one question. Pi → Branch A; other → Branch C. No registry reading, no static capability matrix. Capabilities discovered at runtime. Branch B removed entirely. Branch terminology retained (A/C) for continuity.
**Decision:** D-12

---

## Integration Test Strategy — How to Verify Universal Server

| Option | Description | Selected |
|--------|-------------|----------|
| Dual-layer: unit + E2E | Unit tests in-process (Mock MCP Client); E2E tests subprocess (real MCP Client) | ✓ |
| In-process only | Mock MCP Client simulates agent connection, verify all features | |
| E2E only | Subprocess real MCP server, real MCP Client, no in-process tests | |

**User's choice:** Dual-layer: unit + E2E
**Notes:** Unit tests: in-process createMcpAdapter + protocol forwarders with Mock MCP Client declaring sampling/elicitation. E2E tests: subprocess bin/mcp-server.ts + real MCP Client connection verifying tool registration, calling, protocol forwarding. verify:deploy adapts to new architecture.
**Decision:** D-13

---

## Agent's Discretion

- universal-mcp registry entry factory: researcher/planner to determine whether to keep minimal StoreAgentAdapter (renamed) or inline into bin/mcp-server.ts
- ProtocolSamplingForwarder and ProtocolElicitationForwarder internal design: researcher to determine API shape, error handling, timeout behavior
- Test file organization and naming: planner to determine

## Deferred Ideas

- Roots forwarding (server.listRoots()) — future phase
- Logging forwarding (server.sendLoggingMessage()) — future phase
- MCP Prompts exposure (/mcp setup as MCP Prompt/Tool) — requires UX redesign
- OAuth management via tools (/mcp-auth as MCP tools) — requires UX redesign
- Dynamic capability declaration in AGENT_ADAPTERS — static entry sufficient for Phase 12
