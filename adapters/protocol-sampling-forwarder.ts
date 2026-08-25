/**
 * ProtocolSamplingForwarder — forwards MCP sampling requests from downstream
 * servers to the Agent Client via the MCP Server→Client `sampling/createMessage`
 * reverse call.
 *
 * D-06: implements the `SamplingProvider` interface.
 * D-11: pure forwarding — no config check, no local approval. If the Agent
 *   Client declares `sampling` capability, mcp-adapter unconditionally
 *   forwards. The Agent handles user approval, LLM call, and result.
 *
 * Threat model:
 *   T-12-01 (Information Disclosure): `complete()` must NEVER log
 *   `request.messages` or `request.systemPrompt` — they may contain tokens
 *   or user content. Error paths only include the event name + error
 *   message, following the T-10-01 pattern from StoreAgentAdapter.
 */

import type {
	SamplingModel,
	SamplingProvider,
	SamplingRequest,
	SamplingResponse,
} from "../interfaces/sampling.ts";
import type {
	CreateMessageRequestParams,
	CreateMessageResult,
	ModelPreferences,
} from "@modelcontextprotocol/client";

/** Minimal Server→Client reverse-call surface the forwarder needs. */
type SamplingForwardTarget = {
	createMessage(params: CreateMessageRequestParams): Promise<CreateMessageResult>;
};

/**
 * Forwards MCP sampling requests to the Agent Client via
 * `server.createMessage()`.
 *
 * The forwarder is injected into `McpServerManager.setSamplingConfig()`
 * when the connecting Agent Client declares `sampling` capability.
 */
export class ProtocolSamplingForwarder implements SamplingProvider {
	constructor(private readonly server: SamplingForwardTarget) {}

	/**
	 * Returns a placeholder model. In pure forwarding mode (D-11), the Agent
	 * Client handles actual model selection. The model returned here is not
	 * used for the LLM call — it's only passed to `complete()` which ignores it.
	 */
	async resolveModel(_prefs?: ModelPreferences): Promise<SamplingModel | undefined> {
		return { provider: "mcp-protocol", id: "forwarded" };
	}

	/**
	 * Forward the sampling request to the Agent Client via
	 * `server.createMessage()`.
	 *
	 * Converts `SamplingRequest.messages` to MCP `CreateMessageRequestParam`
	 * messages (string content → text content block), calls
	 * `server.createMessage()`, and maps `CreateMessageResult` to
	 * `SamplingResponse`.
	 *
	 * T-12-01: does NOT log `request.messages` or `request.systemPrompt`.
	 */
	async complete(_model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse> {
		try {
			// Convert SamplingRequest messages to MCP createMessage params.
			// String content is wrapped as { type: "text", text }; array content
			// (SamplingTextContent[]) is passed through.
			const messages = request.messages.map((m) => ({
				role: m.role,
				content: typeof m.content === "string"
					? { type: "text" as const, text: m.content }
					: m.content,
			}));

			const result: CreateMessageResult = await this.server.createMessage({
				messages,
				systemPrompt: request.systemPrompt,
				// maxTokens is required by the MCP protocol; SamplingRequest.maxTokens
				// is optional at the interface level but always present at runtime
				// (the downstream server's createMessage request includes it).
				maxTokens: request.maxTokens ?? 0,
			});

			// Map CreateMessageResult → SamplingResponse
			const text = result.content.type === "text" ? result.content.text : "";
			return {
				text,
				model: result.model,
				stopReason: result.stopReason ?? "endTurn",
			};
		} catch (err) {
			// T-12-01: only log event name + error message — never request payload.
			throw new Error(
				`[ProtocolSamplingForwarder] complete failed: ${(err as Error).message}`,
			);
		}
	}

	/**
	 * D-11: No local approval — the Agent Client handles user approval.
	 * Always returns `true` unconditionally.
	 */
	async confirm(_title: string, _message: string): Promise<boolean> {
		return true;
	}
}
