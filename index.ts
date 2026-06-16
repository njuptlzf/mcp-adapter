import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ToolInfo } from "./interfaces/agent-api.ts";
import { loadMcpConfig } from "./config.ts";
import { loadMetadataCache } from "./metadata-cache.ts";
import { getConfigPathFromArgv } from "./utils.ts";
import { PiAdapter, adaptPiContext } from "./adapters/pi-adapter.ts";
import { createMcpAdapter } from "./adapters/entry.ts";
import type { AgentAPI, AgentContext, UISystem } from "./interfaces/agent-api.ts";

export { PiAdapter, adaptPiContext };
export { DEFAULT_AGENT_RESOLVER, createPiResolver, resolveAgentGlobalConfigPath } from "./interfaces/agent-paths.ts";
export type { AgentAPI, AgentContext, UISystem } from "./interfaces/agent-api.ts";
export type { AgentPathResolver, AgentId } from "./interfaces/agent-paths.ts";
// Backward-compatible alias for the default `mcpAdapter` export. Existing
// Pi users can `import { piMcpAdapter } from "pi-mcp-adapter"` (D-15).
export { default as piMcpAdapter } from "./index.ts";

export default function mcpAdapter(pi: ExtensionAPI) {
	const earlyConfigPath = getConfigPathFromArgv();
	const earlyConfig = loadMcpConfig(earlyConfigPath);
	const earlyCache = loadMetadataCache();

	const agentapi = new PiAdapter(pi);
	const ctx = adaptPiContext({ cwd: process.cwd(), hasUI: false } as unknown as ExtensionContext);

	createMcpAdapter(agentapi, ctx, earlyConfig, earlyCache);
}
