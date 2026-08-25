/**
 * Pi-specific implementation of the generic SamplingProvider.
 *
 * This is the only sampling-specific boundary file that imports
 * `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`.
 */

import { complete, type Api, type AssistantMessage, type Message, type Model, type TextContent } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { ModelPreferences, SamplingMessage as McpSamplingMessage } from "@modelcontextprotocol/client";
import type {
	SamplingModel,
	SamplingProvider,
	SamplingRequest,
	SamplingResponse,
	SamplingTextContent,
} from "../interfaces/sampling.ts";

export class PiSamplingProvider implements SamplingProvider {
	#piModels = new WeakMap<SamplingModel, Model<Api>>();

	constructor(
		private readonly modelRegistry: ModelRegistry,
		private readonly getCurrentModel: () => Model<Api> | undefined,
		private readonly confirmDialog?: (title: string, message: string) => Promise<boolean>,
	) {}

	async confirm(title: string, message: string): Promise<boolean> {
		if (!this.confirmDialog) {
			throw new Error("PiSamplingProvider was not constructed with a confirm dialog");
		}
		return this.confirmDialog(title, message);
	}

	async resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined> {
		const candidates: Model<Api>[] = [];
		const availableModels = this.modelRegistry.getAvailable();

		for (const hint of prefs?.hints ?? []) {
			const normalizedHint = hint.name?.trim().toLowerCase();
			if (!normalizedHint) continue;
			for (const model of availableModels) {
				const searchableNames = [`${model.provider}/${model.id}`, model.id, model.name];
				if (searchableNames.some((name) => name.toLowerCase().includes(normalizedHint))) {
					addSamplingCandidate(candidates, model);
				}
			}
		}

		const currentModel = this.getCurrentModel();
		if (currentModel) addSamplingCandidate(candidates, currentModel);

		for (const model of availableModels) {
			addSamplingCandidate(candidates, model);
		}

		const errors: string[] = [];
		for (const model of candidates) {
			const auth = await this.modelRegistry.getApiKeyAndHeaders(model);
			if (auth.ok === false) {
				errors.push(`${model.provider}/${model.id}: ${auth.error}`);
				continue;
			}
			const samplingModel: SamplingModel = { provider: model.provider, id: model.id, name: model.name };
			this.#piModels.set(samplingModel, model);
			return samplingModel;
		}

		if (errors.length > 0) {
			throw new Error(`No configured auth for MCP sampling model. ${errors.join("; ")}`);
		}
		throw new Error("No Pi model is available for MCP sampling");
	}

	async complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse> {
		const piModel = this.#piModels.get(model);
		if (!piModel) {
			throw new Error(`MCP sampling model ${model.provider}/${model.id} is not available`);
		}

		const auth = await this.modelRegistry.getApiKeyAndHeaders(piModel);
		if (auth.ok === false) {
			throw new Error(`${piModel.provider}/${piModel.id}: ${auth.error}`);
		}

		const messages = request.messages.map((message) => convertSamplingMessage(message as McpSamplingMessage));
		const result = await complete(
			piModel,
			{
				systemPrompt: request.systemPrompt,
				messages,
			},
			{
				apiKey: auth.apiKey,
				headers: auth.headers,
				maxTokens: request.maxTokens,
				temperature: request.temperature,
				metadata: request.metadata,
				signal: request.signal,
			},
		);

		return convertAssistantResult(result);
	}
}

function addSamplingCandidate(candidates: Model<Api>[], model: Model<Api>): void {
	if (!candidates.some((candidate) => candidate.provider === model.provider && candidate.id === model.id)) {
		candidates.push(model);
	}
}

function convertSamplingMessage(message: McpSamplingMessage): Message {
	const blocks = Array.isArray(message.content) ? message.content : [message.content];
	if (message.role === "user") {
		return {
			role: "user",
			content: blocks.map(convertUserContent),
			timestamp: Date.now(),
		};
	}

	return {
		role: "assistant",
		content: blocks.map(convertAssistantContent),
		api: "mcp-sampling",
		provider: "mcp",
		model: "sampling-request",
		usage: zeroUsage(),
		stopReason: "stop",
		timestamp: Date.now(),
	};
}

function convertUserContent(block: SamplingTextContent | unknown): TextContent {
	if (typeof block === "object" && block !== null && (block as { type?: string }).type === "text") {
		return { type: "text", text: (block as { text: string }).text };
	}
	if (typeof block === "string") {
		return { type: "text", text: block };
	}
	throw new Error(`MCP sampling ${(block as { type?: string })?.type ?? "unknown"} content is not supported`);
}

function convertAssistantContent(block: SamplingTextContent | unknown): TextContent {
	if (typeof block === "object" && block !== null && (block as { type?: string }).type === "text") {
		return { type: "text", text: (block as { text: string }).text };
	}
	throw new Error(`MCP sampling assistant ${(block as { type?: string })?.type ?? "unknown"} content is not supported`);
}

function convertAssistantResult(message: AssistantMessage): SamplingResponse {
	if (message.stopReason === "error") {
		throw new Error(message.errorMessage ?? "MCP sampling model call failed");
	}
	if (message.stopReason === "aborted") {
		throw new Error(message.errorMessage ?? "MCP sampling model call was aborted");
	}

	const text = message.content
		.map((block: { type: string; text?: string }) => {
			if (block.type === "text") return block.text;
			if (block.type === "thinking") return undefined;
			throw new Error(`MCP sampling result ${block.type} content is not supported`);
		})
		.filter((value: string | undefined): value is string => value !== undefined)
		.join("\n\n")
		.trim();

	if (!text) {
		throw new Error("MCP sampling result did not contain text content");
	}

	return {
		text,
		model: `${message.provider}/${message.model}`,
		stopReason: mapStopReason(message.stopReason),
	};
}

function mapStopReason(reason: AssistantMessage["stopReason"]): string {
	if (reason === "stop") return "endTurn";
	if (reason === "length") return "maxTokens";
	if (reason === "toolUse") return "toolUse";
	return reason;
}

function zeroUsage(): AssistantMessage["usage"] {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			total: 0,
		},
	};
}
