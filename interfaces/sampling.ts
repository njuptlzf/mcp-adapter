/**
 * Agent-agnostic sampling abstractions for the universal MCP adapter.
 *
 * Design notes:
 *  - Keep Pi types out of this file.
 *  - SamplingProvider is injected by the agent-specific adapter.
 */

import type { ModelPreferences } from "@modelcontextprotocol/sdk/types.js";

/** A generic sampling model with no agent-specific generics. */
export interface SamplingModel {
	provider: string;
	id: string;
	name?: string;
}

/** A text content block within a sampling message. */
export interface SamplingTextContent {
	type: "text";
	text: string;
}

/** A single message in a sampling request. */
export interface SamplingMessage {
	role: "user" | "assistant";
	content: string | SamplingTextContent[];
}

/** Request payload passed to a SamplingProvider. */
export interface SamplingRequest {
	systemPrompt?: string;
	messages: SamplingMessage[];
	maxTokens?: number;
	temperature?: number;
	metadata?: Record<string, unknown>;
	signal?: AbortSignal;
}

/** Response payload returned by a SamplingProvider. */
export interface SamplingResponse {
	text: string;
	model: string;
	stopReason: string;
}

/** Agent-agnostic contract for MCP sampling completion. */
export interface SamplingProvider {
	/** Select a model from preferences, falling back to a sensible default. */
	resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined>;

	/** Complete a sampling request with the selected model. */
	complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse>;

	/** Optional native confirmation dialog. */
	confirm?(title: string, message: string): Promise<boolean>;
}
