# Phase 5: Type Decoupling & Entry Point Refactor - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 14
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `adapters/entry.ts` | entry / provider | request-response | `index.ts` | role-match |
| `interfaces/sampling.ts` | interface | request-response | `interfaces/agent-api.ts` | role-match |
| `adapters/pi-sampling-provider.ts` | adapter / service | request-response | `adapters/pi-adapter.ts` | role-match |
| `adapters/pi-renderer.ts` | adapter / utility | transform | `adapters/pi-adapter.ts` | role-match |
| `__tests__/entry.test.ts` | test | request-response | `__tests__/index-lifecycle.test.ts` | role-match |
| `__tests__/sampling-handler.test.ts` | test | request-response | `__tests__/sampling-handler.test.ts` (current) | exact |
| `__tests__/tool-result-renderer.test.ts` | test | transform | `__tests__/tool-result-renderer.test.ts` (current) | exact |
| `proxy-modes.ts` | service / utility | request-response | `proxy-modes.ts` (current) | exact |
| `direct-tools.ts` | service | request-response | `direct-tools.ts` (current) | exact |
| `tool-result-renderer.ts` | component / utility | transform | `tool-result-renderer.ts` (current) | exact |
| `sampling-handler.ts` | service | request-response | `sampling-handler.ts` (current) | exact |
| `elicitation-handler.ts` | service | request-response | `elicitation-handler.ts` (current) | exact |
| `index.ts` | entry / controller | request-response | `index.ts` (current) | exact |
| `agent-dir.ts` | utility / config | file-I/O | `agent-dir.ts` (current) + `interfaces/agent-paths.ts` | exact |

## Pattern Assignments

### `adapters/entry.ts` (entry, request-response)

**Analog:** `index.ts`

This is the new agent-agnostic entry point. Copy the registration/event-wiring logic from `index.ts`, but remove Pi-specific config/cache loading and receive all inputs via parameters.

**Imports pattern** (from `index.ts` lines 1-18, adapted):
```typescript
import type { McpExtensionState } from "./state.ts";
import { Type } from "typebox";
import { showStatus, showTools, reconnectServers, authenticateServer, logoutServer, openMcpAuthPanel, openMcpPanel, openMcpSetup } from "./commands.ts";
import { buildProxyDescription, createDirectToolExecutor, getMissingConfiguredDirectToolServers, resolveDirectTools } from "./direct-tools.ts";
import { flushMetadataCache, initializeMcp, updateStatusBar } from "./init.ts";
import { executeCall, executeConnect, executeDescribe, executeList, executeSearch, executeStatus, executeUiMessages } from "./proxy-modes.ts";
import { getConfigPathFromArgv, truncateAtWord } from "./utils.ts";
import { initializeOAuth, shutdownOAuth } from "./mcp-auth-flow.ts";
import { createMcpDirectToolCallRenderer, renderMcpProxyToolCall, renderMcpToolResult } from "./tool-result-renderer.ts";
import type { AgentAPI, AgentContext } from "./interfaces/agent-api.ts";
```

**Core entry pattern** (from `index.ts` lines 24-28, 80-99, 169-348):
```typescript
export function createMcpAdapter(
  agentapi: AgentAPI,
  ctx: AgentContext,
  config: McpConfig,
  cache: MetadataCache,
): void {
  let state: McpExtensionState | null = null;
  let initPromise: Promise<McpExtensionState> | null = null;
  let lifecycleGeneration = 0;

  // Delegate shutdown to shared helper or keep inline like index.ts
  async function shutdownState(currentState: McpExtensionState | null, reason: string): Promise<void> {
    // Copy from index.ts lines 30-58
  }

  const prefix = config.settings?.toolPrefix ?? "server";
  const envRaw = process.env.MCP_DIRECT_TOOLS;
  const directSpecs = envRaw === "__none__"
    ? []
    : resolveDirectTools(config, cache, prefix, envRaw?.split(",").map(s => s.trim()).filter(Boolean));
  const missingConfiguredDirectToolServers = getMissingConfiguredDirectToolServers(config, cache);
  const shouldRegisterProxyTool =
    config.settings?.disableProxyTool !== true
    || directSpecs.length === 0
    || missingConfiguredDirectToolServers.length > 0;

  for (const spec of directSpecs) {
    agentapi.registerTool({
      name: spec.prefixedName,
      label: `MCP: ${spec.originalName}`,
      description: spec.description || "(no description)",
      promptSnippet: truncateAtWord(spec.description, 100) || `MCP tool from ${spec.serverName}`,
      parameters: Type.Unsafe((spec.inputSchema || { type: "object", properties: {} }) as never),
      execute: createDirectToolExecutor(() => state, () => initPromise, spec),
      renderCall: createMcpDirectToolCallRenderer(spec.prefixedName),
      renderResult: renderMcpToolResult,
    });
  }

  const getAgentTools = (): ToolInfo[] => agentapi.getAllTools();

  agentapi.registerFlag("mcp-config", { description: "Path to MCP config file", type: "string" });

  agentapi.on("session_start", async (_event, sessionCtx) => {
    // sessionCtx may differ per agent; for Pi it is already converted by index.ts wrapper.
    // Use ctx (passed-in AgentContext) plus any runtime fields if needed.
    const generation = ++lifecycleGeneration;
    // ... copy lifecycle logic from index.ts lines 100-151, but call initializeMcp(agentapi, ctx)
  });

  agentapi.on("session_shutdown", async () => {
    // ... copy from index.ts lines 153-167
  });

  agentapi.registerCommand("mcp", { /* copy handler from index.ts lines 169-230 */ });
  agentapi.registerCommand("mcp-auth", { /* copy handler from index.ts lines 232-261 */ });

  if (shouldRegisterProxyTool) {
    agentapi.registerTool({
      name: "mcp",
      // ... copy from index.ts lines 263-347, using getAgentTools instead of getPiTools
    });
  }
}
```

**Key constraint:** Do **not** call `loadMcpConfig()` or `loadMetadataCache()` inside `createMcpAdapter`; the Pi wrapper in `index.ts` will continue to do that and pass the results in.

---

### `interfaces/sampling.ts` (interface, request-response)

**Analog:** `interfaces/agent-api.ts`

Keep the interface minimal, use `unknown`/optional members for agent divergence, and avoid importing Pi packages.

**Imports pattern** (from `interfaces/agent-api.ts` lines 1-16, adapted):
```typescript
/**
 * Agent-agnostic sampling abstractions for the universal MCP adapter.
 *
 * Design notes:
 *  - Keep Pi types out of this file.
 *  - SamplingProvider is injected by the agent-specific adapter.
 */
```

**Core interface pattern** (from `interfaces/agent-api.ts` lines 18-22, 63-74, adapted):
```typescript
import type { CreateMessageRequest, CreateMessageResult, ModelPreferences } from "@modelcontextprotocol/sdk/types.js";

export interface SamplingModel {
  provider: string;
  id: string;
  name?: string;
}

export interface SamplingRequest {
  systemPrompt?: string;
  messages: SamplingMessage[];
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface SamplingMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
}

export interface SamplingResponse {
  text: string;
  model: string;
  stopReason: string;
}

export interface SamplingProvider {
  resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined>;
  complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse>;
  confirm?(title: string, message: string): Promise<boolean>;
}
```

---

### `adapters/pi-sampling-provider.ts` (adapter / service, request-response)

**Analog:** `adapters/pi-adapter.ts`

Create a Pi-specific `SamplingProvider` implementation that imports `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent` and converts between generic `SamplingModel`/`SamplingRequest`/`SamplingResponse` and Pi types.

**Imports pattern** (from `adapters/pi-adapter.ts` lines 14-27, adapted):
```typescript
import { complete, type Api, type AssistantMessage, type Message, type Model, type TextContent } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { ModelPreferences } from "@modelcontextprotocol/sdk/types.js";
import type { SamplingProvider, SamplingModel, SamplingRequest, SamplingResponse } from "../interfaces/sampling.ts";
```

**Core adapter pattern** (from `adapters/pi-adapter.ts` lines 40-98, adapted):
```typescript
export class PiSamplingProvider implements SamplingProvider {
  constructor(
    private readonly modelRegistry: ModelRegistry,
    private readonly getCurrentModel: () => Model<Api> | undefined,
    private readonly confirm?: (title: string, message: string) => Promise<boolean>,
  ) {}

  async resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined> {
    // Move/clone resolveSamplingModel logic from sampling-handler.ts lines 118-161
  }

  async complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse> {
    // Convert SamplingModel back to Pi Model<Api>, then call pi-ai.complete
    // Clone convertSamplingMessage / convertAssistantResult from sampling-handler.ts lines 180-251
  }
}
```

---

### `adapters/pi-renderer.ts` (adapter / utility, transform)

**Analog:** `adapters/pi-adapter.ts`

A thin boundary that wraps the generic renderer output with Pi TUI `Text`.

**Imports pattern** (from `adapters/pi-adapter.ts` lines 14-27, adapted):
```typescript
import { Text } from "@earendil-works/pi-tui";
```

**Core adapter pattern** (from `adapters/pi-adapter.ts` lines 40-98, adapted):
```typescript
export type RenderOutput = string;

export function wrapPiRenderer<T extends (...args: unknown[]) => RenderOutput>(fn: T) {
  return (...args: Parameters<T>) => new Text(fn(...args), 0, 0);
}
```

---

### `__tests__/entry.test.ts` (test, request-response)

**Analog:** `__tests__/index-lifecycle.test.ts`

Use the same heavy mocking strategy as `index-lifecycle.test.ts`, but construct a generic `AgentAPI` mock instead of a Pi mock, and assert that `createMcpAdapter` registers tools/commands/flags/events correctly.

**Imports pattern** (from `__tests__/index-lifecycle.test.ts` lines 1-2, 87-124):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAPI, AgentContext, ToolInfo } from "../interfaces/agent-api.ts";
```

**Mock pattern** (from `__tests__/index-lifecycle.test.ts` lines 4-33, 110-124, adapted):
```typescript
const mocks = vi.hoisted(() => ({
  initializeMcp: vi.fn(),
  updateStatusBar: vi.fn(),
  flushMetadataCache: vi.fn(),
  initializeOAuth: vi.fn().mockResolvedValue(undefined),
  shutdownOAuth: vi.fn().mockResolvedValue(undefined),
  // ... (same as index-lifecycle.test.ts)
}));

vi.mock("../init.ts", () => ({
  initializeMcp: mocks.initializeMcp,
  updateStatusBar: mocks.updateStatusBar,
  flushMetadataCache: mocks.flushMetadataCache,
}));
// ... additional vi.mock blocks copied from index-lifecycle.test.ts lines 35-85

function createAgentApi(): AgentAPI {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerFlag: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(event, handler);
    }),
    getAllTools: vi.fn(() => []),
    getFlag: vi.fn((name: string) => (name === "mcp-config" ? "/tmp/cfg.json" : undefined)),
    sendMessage: vi.fn(),
    exec: vi.fn(async () => ({ code: 0, stdout: "", stderr: "" })),
    _handlers: handlers,
  } as unknown as AgentAPI;
}
```

**Test pattern** (from `__tests__/index-lifecycle.test.ts` lines 158-187, 216-254, adapted):
```typescript
it("registers direct tools and proxy tool with a generic AgentAPI", () => {
  const { createMcpAdapter } = await import("../adapters/entry.ts");
  const agentapi = createAgentApi();
  createMcpAdapter(agentapi, { cwd: "/work", hasUI: false }, { mcpServers: {} }, null);

  expect(agentapi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: "mcp" }));
  expect(agentapi.registerCommand).toHaveBeenCalledWith("mcp", expect.any(Object));
  expect(agentapi.registerFlag).toHaveBeenCalledWith("mcp-config", expect.any(Object));
});
```

---

### `__tests__/sampling-handler.test.ts` (test, request-response)

**Analog:** `__tests__/sampling-handler.test.ts` (current)

After decoupling, replace the `@earendil-works/pi-ai` mock with a `SamplingProvider` mock and remove Pi `Model<Api>` types from test fixtures.

**Imports pattern** (from current `__tests__/sampling-handler.test.ts` lines 1-5, adapted):
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateMessageRequest, ModelPreferences } from "@modelcontextprotocol/sdk/types.js";
import type { SamplingHandlerOptions } from "../sampling-handler.ts";
```

**Mock replacement pattern** (from current `__tests__/sampling-handler.test.ts` lines 6-12, adapted):
```typescript
const mocks = vi.hoisted(() => ({
  provider: {
    resolveModel: vi.fn(),
    complete: vi.fn(),
    confirm: vi.fn(),
  },
}));

vi.mock("../adapters/pi-sampling-provider.ts", () => ({
  PiSamplingProvider: vi.fn(() => mocks.provider),
}));
```

**Fixture pattern** (from current `__tests__/sampling-handler.test.ts` lines 23-56, adapted):
```typescript
const model = {
  provider: "anthropic",
  id: "claude-sonnet",
  name: "Claude Sonnet",
};

function createOptions(overrides: Partial<SamplingHandlerOptions> = {}): SamplingHandlerOptions {
  return {
    serverName: "i18n",
    autoApprove: true,
    provider: mocks.provider,
    ...overrides,
  };
}
```

---

### `__tests__/tool-result-renderer.test.ts` (test, transform)

**Analog:** `__tests__/tool-result-renderer.test.ts` (current)

Replace Pi `AgentToolResult` and `ToolRenderResultOptions` with local `McpToolResult` and a plain options object. Use `RenderOutput` (string) assertions instead of `Text.render()`.

**Imports pattern** (from current `__tests__/tool-result-renderer.test.ts` lines 1-8, adapted):
```typescript
import { describe, expect, it } from "vitest";
import {
  formatMcpDirectToolCallLines,
  formatMcpProxyToolCallLines,
  formatMcpToolResultLines,
  renderMcpToolResult,
  type McpToolResult,
} from "../tool-result-renderer.ts";
```

**Fixture pattern** (from current `__tests__/tool-result-renderer.test.ts` lines 10-18, adapted):
```typescript
type TestDetails = Record<string, unknown> & { error?: unknown };
type TestResult = McpToolResult<TestDetails>;

const collapsedOptions = { expanded: false, isPartial: false };
const plainTheme = { fg: (_name: string, text: string) => text };

function result(content: TestResult["content"], details: TestDetails = {}): TestResult {
  return { content, details };
}
```

**Assertion pattern** (from current `__tests__/tool-result-renderer.test.ts` lines 122-133, adapted):
```typescript
it("renders long error results expanded", () => {
  const output = renderMcpToolResult(
    result([{ type: "text", text: "Error: failed\nline 2\nline 3\nline 4" }]),
    collapsedOptions,
    plainTheme,
    { isError: true },
  );
  expect(output).toContain("line 4");
  expect(output).not.toContain("Ctrl+O to expand");
  expect(output).not.toContain("…");
});
```

---

### `proxy-modes.ts` (service / utility, request-response)

**Analog:** `proxy-modes.ts` (current)

Replace the Pi `AgentToolResult` import with a local `McpToolResult` type and use the generic `ToolInfo` from `interfaces/agent-api.ts`.

**Imports pattern** (from `proxy-modes.ts` line 1, adapted):
```typescript
import type { ToolInfo } from "./interfaces/agent-api.ts";
```

**Local result type pattern** (derived from `proxy-modes.ts` line 13 and `types.ts` lines 247-260):
```typescript
export interface McpToolResult<T = Record<string, unknown>> {
  content: Array<{ type: "text"; text: string } | { type: "image"; mimeType: string }>;
  details?: T;
}

type ProxyToolResult = McpToolResult<Record<string, unknown>>;
```

**Tool lookup pattern** (from `proxy-modes.ts` lines 474-480, 599-607):
```typescript
export async function executeCall(
  state: McpExtensionState,
  toolName: string,
  args?: Record<string, unknown>,
  serverOverride?: string,
  getAgentTools?: () => ToolInfo[],
): Promise<ProxyToolResult> {
  // ... existing logic, rename getPiTools parameter to getAgentTools
  const nativeTool = !serverOverride
    ? getAgentTools?.().find((tool) => tool.name === toolName && tool.name !== "mcp")
    : undefined;
  // ...
}
```

---

### `direct-tools.ts` (service, request-response)

**Analog:** `direct-tools.ts` (current)

Remove Pi `AgentToolResult`, `AgentToolUpdateCallback`, and `ExtensionContext` imports; use local `McpToolResult` and `AgentContext`.

**Type signature pattern** (from `direct-tools.ts` lines 263-269, adapted):
```typescript
import type { AgentContext } from "./interfaces/agent-api.ts";

type DirectToolExecute = (
  toolCallId: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
  onUpdate: ((update: McpToolResult<Record<string, unknown>>) => void) | undefined,
  ctx: AgentContext,
) => Promise<McpToolResult<Record<string, unknown>>>;
```

**Implementation note:** The `onUpdate` and `ctx` parameters are unused in the current body (lines 276+); keep the signature widened but the body unchanged.

---

### `tool-result-renderer.ts` (component / utility, transform)

**Analog:** `tool-result-renderer.ts` (current)

Replace Pi `AgentToolResult`, `ToolRenderResultOptions`, and `Text` with local `McpToolResult`, a plain options interface, and `RenderOutput` string. Move Pi `Text` wrapping to `adapters/pi-renderer.ts`.

**Imports pattern** (from `tool-result-renderer.ts` lines 1-2, adapted):
```typescript
import type { McpToolResult } from "./types.ts"; // or define locally if types.ts still imports pi-ai
```

**Renderer output pattern** (from `tool-result-renderer.ts` lines 99-103, 141-160, adapted):
```typescript
export type RenderOutput = string;

export interface ToolRenderResultOptions {
  expanded: boolean;
  isPartial: boolean;
}

function renderToolCallLines(lines: string[], theme: RenderTheme): RenderOutput {
  const [title = "mcp", ...rest] = lines;
  const styledTitle = theme.fg("toolTitle", theme.bold ? theme.bold(title) : title);
  const styledRest = rest.map(line => theme.fg("muted", line));
  return [styledTitle, ...styledRest].join("\n");
}

export function renderMcpToolResult(
  result: McpToolResult<McpToolResultDetails>,
  options: ToolRenderResultOptions,
  theme: RenderTheme,
  context?: McpToolRenderContext,
): RenderOutput {
  if (options.isPartial) {
    return theme.fg("warning", "Running MCP tool...");
  }
  // ... return plain string instead of new Text(...)
}
```

---

### `sampling-handler.ts` (service, request-response)

**Analog:** `sampling-handler.ts` (current)

Replace Pi AI imports and `ExtensionUIContext`/`ModelRegistry` with the generic `SamplingProvider` and `UISystem` from `interfaces/agent-api.ts`.

**Imports pattern** (from `sampling-handler.ts` lines 1-12, adapted):
```typescript
import { truncateAtWord } from "./utils.ts";
import type { UISystem } from "./interfaces/agent-api.ts";
import type { SamplingProvider } from "./interfaces/sampling.ts";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CreateMessageRequestSchema,
  type CreateMessageRequest,
  type CreateMessageResult,
  type ModelPreferences,
  type SamplingMessage,
  type SamplingMessageContentBlock,
} from "@modelcontextprotocol/sdk/types.js";
```

**Options pattern** (from `sampling-handler.ts` lines 14-23, adapted):
```typescript
export interface SamplingHandlerOptions {
  serverName: string;
  autoApprove: boolean;
  ui?: UISystem;
  provider: SamplingProvider;
}
```

**Handler core pattern** (from `sampling-handler.ts` lines 31-84, adapted):
```typescript
export async function handleSamplingRequest(
  options: SamplingHandlerOptions,
  request: CreateMessageRequest,
): Promise<CreateMessageResult> {
  const params = request.params;
  // validation unchanged
  const messages = params.messages.map(convertSamplingMessage);
  const model = await options.provider.resolveModel(params.modelPreferences);
  if (!model) throw new Error("No model available for MCP sampling");
  await confirmSampling(...);
  const result = await options.provider.complete(model, {
    systemPrompt: params.systemPrompt,
    messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    metadata: params.metadata as Record<string, unknown> | undefined,
    signal: options.provider.signal ?? undefined, // if provider exposes it
  });
  // convert result to CreateMessageResult
}
```

**Confirm fallback pattern** (from `sampling-handler.ts` lines 169-178, adapted):
```typescript
async function confirmSampling(options: SamplingHandlerOptions, title: string, message: string): Promise<void> {
  if (options.autoApprove) return;
  if (!options.ui) throw new Error("MCP sampling requires interactive approval.");
  if (options.provider.confirm) {
    const approved = await options.provider.confirm(title, message);
    if (!approved) throw new Error("MCP sampling request was declined");
    return;
  }
  if (typeof options.ui.form === "function") {
    const result = await options.ui.form({
      title,
      message,
      fields: [],
      submitLabel: "Approve",
      secondaryLabel: "Decline",
      cancelLabel: "Cancel",
    });
    if (result.action !== "submit") throw new Error("MCP sampling request was declined");
    return;
  }
  throw new Error("MCP sampling requires a UI with confirm or form support");
}
```

---

### `elicitation-handler.ts` (service, request-response)

**Analog:** `elicitation-handler.ts` (current)

Replace `ExtensionUIContext` with generic `UISystem` and `FormConfig`/`FormResult` from `interfaces/agent-api.ts`.

**Imports pattern** (from `elicitation-handler.ts` line 1, adapted):
```typescript
import type { UISystem, FormConfig, FormResult, FormField } from "./interfaces/agent-api.ts";
```

**Form conversion pattern** (from `elicitation-handler.ts` lines 12-85, adapted):
```typescript
export type ExtensionUIFormValue = string | number | boolean | string[] | undefined;

export interface ExtensionUIFormSelectOption {
  value: string;
  label?: string;
  description?: string;
}

export type ExtensionUIFormField =
  | { type: "text"; name: string; label: string; /* ... */ }
  | /* other variants */;

export interface ExtensionUIFormRequest {
  title: string;
  message?: string;
  fields: ExtensionUIFormField[];
  submitLabel?: string;
  secondaryLabel?: string;
  cancelLabel?: string;
}

export type ExtensionUIFormResult =
  | { action: "submit"; values: Record<string, ExtensionUIFormValue> }
  | { action: "secondary" }
  | { action: "cancel" };

export interface ElicitationHandlerOptions {
  serverName: string;
  ui: UISystem; // was ExtensionUIContext
  autoOpenUrls: boolean;
}
```

**Form call pattern** (from `elicitation-handler.ts` lines 112-125, 132-149):
```typescript
const form = convertMcpSchemaToPiForm(options.serverName, params) as FormConfig;
const result = await options.ui.form!(form);
```

---

### `index.ts` (entry / controller, request-response)

**Analog:** `index.ts` (current) + `adapters/pi-adapter.ts`

Keep the Pi-specific default export but strip out the generic registration logic, delegating to `createMcpAdapter`.

**Imports pattern** (from `index.ts` lines 1-19, adapted):
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpExtensionState } from "./state.ts";
import { loadMcpConfig } from "./config.ts";
import { loadMetadataCache } from "./metadata-cache.ts";
import { getConfigPathFromArgv } from "./utils.ts";
import { initializeOAuth, shutdownOAuth } from "./mcp-auth-flow.ts";
import { PiAdapter, adaptPiContext } from "./adapters/pi-adapter.ts";
import { createMcpAdapter } from "./adapters/entry.ts";
```

**Wrapper pattern** (from `index.ts` lines 24-29, 60-62, 100-125, adapted):
```typescript
export default function mcpAdapter(pi: ExtensionAPI) {
  let state: McpExtensionState | null = null;
  let initPromise: Promise<McpExtensionState> | null = null;
  let lifecycleGeneration = 0;

  const earlyConfigPath = getConfigPathFromArgv();
  const earlyConfig = loadMcpConfig(earlyConfigPath);
  const earlyCache = loadMetadataCache();

  const agentapi = new PiAdapter(pi);
  createMcpAdapter(agentapi, adaptPiContext({ cwd: process.cwd(), hasUI: false } as any), earlyConfig, earlyCache);

  // Replicate lifecycle wiring that needs ExtensionContext from Pi session_start
  pi.on("session_start", async (_event, ctx) => {
    const generation = ++lifecycleGeneration;
    // shutdownState(previousState) ...
    // await initializeOAuth() ...
    const promise = initializeMcp(agentapi, adaptPiContext(ctx));
    initPromise = promise;
    promise.then(nextState => {
      if (generation !== lifecycleGeneration) { /* stale cleanup */ return; }
      state = nextState;
    }).catch(err => { /* ... */ });
  });

  pi.on("session_shutdown", async () => {
    // shutdown state + OAuth
  });
}
```

**Alternative simpler wrapper:** If `createMcpAdapter` handles all registration and event wiring, `index.ts` only needs to construct `PiAdapter`, load config/cache, call `createMcpAdapter`, and expose the default export. Preserve existing exports per D-07.

---

### `agent-dir.ts` (utility / config, file-I/O)

**Analog:** `agent-dir.ts` (current) + `interfaces/agent-paths.ts`

Add `MCP_AGENT_DIR` as the primary env variable while keeping `PI_CODING_AGENT_DIR` as a backward-compatible fallback.

**Env resolution pattern** (from `agent-dir.ts` lines 4-16, adapted):
```typescript
export function getAgentDir(): string {
  const configured = process.env.MCP_AGENT_DIR?.trim() ?? process.env.PI_CODING_AGENT_DIR?.trim();
  if (!configured) {
    return join(homedir(), ".pi", "agent");
  }
  if (configured === "~") {
    return homedir();
  }
  if (configured.startsWith("~/")) {
    return resolve(homedir(), configured.slice(2));
  }
  return resolve(configured);
}
```

**Resolver integration pattern** (from `interfaces/agent-paths.ts` lines 14-20):
```typescript
export function createPiResolver(): AgentPathResolver {
  return {
    agentId: "pi",
    globalConfigPath: () => getAgentPath("mcp.json"),
    projectConfigName: () => ".pi/mcp.json",
  };
}
```

---

## Shared Patterns

### Agent-agnostic imports
**Source:** `interfaces/agent-api.ts`
**Apply to:** `proxy-modes.ts`, `direct-tools.ts`, `tool-result-renderer.ts`, `sampling-handler.ts`, `elicitation-handler.ts`, `adapters/entry.ts`
```typescript
import type { AgentAPI, AgentContext, UISystem, ToolInfo } from "./interfaces/agent-api.ts";
```

### Local tool result type
**Source:** `proxy-modes.ts` line 13 + `types.ts` lines 247-260
**Apply to:** `proxy-modes.ts`, `direct-tools.ts`, `tool-result-renderer.ts`
```typescript
export interface McpToolResult<T = Record<string, unknown>> {
  content: Array<{ type: "text"; text: string } | { type: "image"; mimeType: string }>;
  details?: T;
}
```

### Pi boundary cast pattern
**Source:** `adapters/pi-adapter.ts` lines 43-98
**Apply to:** `adapters/pi-sampling-provider.ts`, `adapters/pi-renderer.ts`
```typescript
// Cast at the boundary so the universal interface stays permissive.
(this.pi.registerTool as (tool: ToolRegistration) => unknown)(tool);
```

### Error-to-result formatting
**Source:** `proxy-modes.ts` lines 464-470, `direct-tools.ts` lines 408-418
**Apply to:** All tool executor surfaces
```typescript
const message = error instanceof Error ? error.message : String(error);
return {
  content: [{ type: "text" as const, text: `Failed: ${message}` }],
  details: { error: "...", message },
};
```

### Vitest mock + reset pattern
**Source:** `__tests__/index-lifecycle.test.ts` lines 1-33, 126-148
**Apply to:** `__tests__/entry.test.ts`, updated `__tests__/sampling-handler.test.ts`, updated `__tests__/tool-result-renderer.test.ts`
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ... }));
vi.mock("../module.ts", () => ({ ... }));

beforeEach(() => {
  vi.resetModules();
  for (const value of Object.values(mocks)) {
    if (typeof value === "function" && "mockReset" in value) {
      value.mockReset();
    }
  }
});
```

### Coverage threshold registration
**Source:** `vitest.config.ts` lines 22-34
**Apply to:** `interfaces/sampling.ts`, `adapters/entry.ts`, `adapters/pi-sampling-provider.ts`, `adapters/pi-renderer.ts`
Planner should add per-file thresholds for new source files in `vitest.config.ts`.

## No Analog Found

None — every file has a direct analog in the existing codebase.

## Metadata

**Analog search scope:** `/home/kingdee-xingkongqijian/go/src/github.com/njuptlzf/mcp-adapter` (root), `adapters/`, `interfaces/`, `__tests__/`
**Files scanned:** 14
**Pattern extraction date:** 2026-06-15
