import { truncateAtWord } from "./utils.ts";
import type { UISystem } from "./interfaces/agent-api.ts";
import type { SamplingProvider, SamplingMessage } from "./interfaces/sampling.ts";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	CreateMessageRequestSchema,
	type CreateMessageRequest,
	type CreateMessageResult,
	type ModelPreferences,
	type SamplingMessage as McpSamplingMessage,
	type SamplingMessageContentBlock,
} from "@modelcontextprotocol/sdk/types.js";

export interface SamplingHandlerOptions {
	serverName: string;
	autoApprove: boolean;
	ui?: UISystem;
	provider: SamplingProvider;
	getSignal: () => AbortSignal | undefined;
}

export type ServerSamplingConfig = Omit<SamplingHandlerOptions, "serverName">;

export function registerSamplingHandler(client: Client, options: SamplingHandlerOptions): void {
	client.setRequestHandler(CreateMessageRequestSchema, (request) => {
		return handleSamplingRequest(options, request as CreateMessageRequest);
	});
}

export async function handleSamplingRequest(
	options: SamplingHandlerOptions,
	request: CreateMessageRequest,
): Promise<CreateMessageResult> {
	const params = request.params;

	if ("task" in params && params.task) {
		throw new Error("MCP sampling tasks are not supported");
	}
	if (params.includeContext && params.includeContext !== "none") {
		throw new Error("MCP sampling context inclusion is not supported");
	}
	if (params.tools?.length) {
		throw new Error("MCP sampling tool use is not supported");
	}
	if (params.toolChoice) {
		throw new Error("MCP sampling tool choice is not supported");
	}
	if (params.stopSequences?.length) {
		throw new Error("MCP sampling stop sequences are not supported");
	}

	const messages = params.messages.map(convertSamplingMessage);
	const model = await options.provider.resolveModel(params.modelPreferences);
	if (!model) {
		throw new Error("No model available for MCP sampling");
	}
	await confirmSampling(
		options,
		"Approve MCP sampling request",
		formatRequestApproval(options.serverName, `${model.provider}/${model.id}`, params.systemPrompt, messages),
	);

	const result = await options.provider.complete(model, {
		systemPrompt: params.systemPrompt,
		messages,
		maxTokens: params.maxTokens,
		temperature: params.temperature,
		metadata: params.metadata as Record<string, unknown> | undefined,
		signal: options.getSignal(),
	});

	const converted: CreateMessageResult = {
		role: "assistant",
		content: { type: "text", text: result.text },
		model: result.model,
		stopReason: result.stopReason as CreateMessageResult["stopReason"],
	};

	await confirmSampling(
		options,
		"Return MCP sampling response",
		formatResponseApproval(options.serverName, converted),
	);
	return converted;
}

function formatRequestApproval(
	serverName: string,
	modelName: string,
	systemPrompt: string | undefined,
	messages: SamplingMessage[],
): string {
	const lines = [`${serverName} wants to sample ${messages.length} message${messages.length === 1 ? "" : "s"} with ${modelName}.`];
	if (systemPrompt) {
		lines.push(`System: ${truncateAtWord(systemPrompt, 400)}`);
	}
	for (const [index, message] of messages.entries()) {
		lines.push(`${index + 1}. ${message.role}: ${truncateAtWord(messageText(message), 400)}`);
	}
	return lines.join("\n\n");
}

function formatResponseApproval(serverName: string, response: CreateMessageResult): string {
	const text = response.content.type === "text" ? response.content.text : `[${response.content.type} content]`;
	return `${serverName} will receive this response from ${response.model}:\n\n${truncateAtWord(text, 1000)}`;
}

function messageText(message: SamplingMessage): string {
	if (typeof message.content === "string") return message.content;
	return message.content.map((block) => block.text).join("\n");
}

async function confirmSampling(options: SamplingHandlerOptions, title: string, message: string): Promise<void> {
	if (options.autoApprove) return;
	if (options.provider.confirm) {
		const approved = await options.provider.confirm(title, message);
		if (!approved) {
			throw new Error("MCP sampling request was declined");
		}
		return;
	}
	if (options.ui?.form) {
		const result = await options.ui.form({
			title,
			message,
			fields: [],
			submitLabel: "Approve",
			secondaryLabel: "Decline",
			cancelLabel: "Cancel",
		});
		if (result.action !== "submit") {
			throw new Error("MCP sampling request was declined");
		}
		return;
	}
	throw new Error("MCP sampling requires interactive approval. Set settings.samplingAutoApprove to true to allow it without UI.");
}

function convertSamplingMessage(message: McpSamplingMessage): SamplingMessage {
	const blocks = Array.isArray(message.content) ? message.content : [message.content];
	const textBlocks = blocks.map((block) => {
		if (block.type === "text") {
			return { type: "text" as const, text: block.text };
		}
		throw new Error(`MCP sampling ${block.type} content is not supported`);
	});
	return {
		role: message.role,
		content: textBlocks,
	};
}
