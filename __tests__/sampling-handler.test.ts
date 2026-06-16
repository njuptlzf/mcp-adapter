import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateMessageRequest } from "@modelcontextprotocol/sdk/types.js";
import type { SamplingModel, SamplingProvider, SamplingResponse } from "../interfaces/sampling.ts";
import type { SamplingHandlerOptions } from "../sampling-handler.ts";

const mockProvider = vi.hoisted(() => ({
	resolveModel: vi.fn<[], Promise<SamplingModel | undefined>>(),
	complete: vi.fn<[], Promise<SamplingResponse>>(),
	confirm: vi.fn<[], Promise<boolean>>(),
}));

const model: SamplingModel = { provider: "anthropic", id: "claude-sonnet", name: "Claude Sonnet" };

function createOptions(overrides: Partial<SamplingHandlerOptions> = {}): SamplingHandlerOptions {
	return {
		serverName: "i18n",
		autoApprove: true,
		provider: mockProvider as unknown as SamplingProvider,
		getSignal: vi.fn(() => undefined),
		...overrides,
	};
}

async function runBasicSampling(
	overrides: Partial<SamplingHandlerOptions> = {},
	requestOverrides: Partial<CreateMessageRequest["params"]> = {},
): Promise<void> {
	const { handleSamplingRequest } = await import("../sampling-handler.ts");
	await handleSamplingRequest(createOptions(overrides), createSamplingRequest({
		messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
		maxTokens: 50,
		...requestOverrides,
	}));
}

function createSamplingRequest(params: CreateMessageRequest["params"]): CreateMessageRequest {
	return { method: "sampling/createMessage", params };
}

describe("sampling handler", () => {
	beforeEach(() => {
		mockProvider.resolveModel.mockReset().mockResolvedValue(model);
		mockProvider.complete.mockReset().mockResolvedValue({
			text: "Bonjour",
			model: "anthropic/claude-sonnet",
			stopReason: "endTurn",
		});
		mockProvider.confirm.mockReset().mockResolvedValue(true);
	});

	it("converts approved MCP sampling requests into provider completions", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");
		const result = await handleSamplingRequest(createOptions(), createSamplingRequest({
			systemPrompt: "Translate tersely.",
			messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
			maxTokens: 50,
			temperature: 0.2,
			metadata: { locale: "fr" },
		}));

		expect(mockProvider.resolveModel).toHaveBeenCalledWith(undefined);
		expect(mockProvider.complete).toHaveBeenCalledWith(
			model,
			{
				systemPrompt: "Translate tersely.",
				messages: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
				maxTokens: 50,
				temperature: 0.2,
				metadata: { locale: "fr" },
				signal: undefined,
			},
		);
		expect(result).toEqual({
			role: "assistant",
			content: { type: "text", text: "Bonjour" },
			model: "anthropic/claude-sonnet",
			stopReason: "endTurn",
		});
	});

	it("requires UI approval unless auto-approve is enabled", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");
		const providerWithoutConfirm = {
			resolveModel: mockProvider.resolveModel,
			complete: mockProvider.complete,
		} as unknown as SamplingProvider;

		await expect(handleSamplingRequest(
			createOptions({ autoApprove: false, provider: providerWithoutConfirm }),
			createSamplingRequest({ messages: [], maxTokens: 50 }),
		)).rejects.toThrow("MCP sampling requires interactive approval");
		expect(mockProvider.complete).not.toHaveBeenCalled();
	});

	it("asks for approval with inspectable request and response content", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");

		await handleSamplingRequest(createOptions({ autoApprove: false }), createSamplingRequest({
			systemPrompt: "Translate tersely.",
			messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
			maxTokens: 50,
		}));

		expect(mockProvider.confirm).toHaveBeenCalledTimes(2);
		expect(mockProvider.confirm.mock.calls[0][0]).toBe("Approve MCP sampling request");
		expect(mockProvider.confirm.mock.calls[0][1]).toContain("System: Translate tersely.");
		expect(mockProvider.confirm.mock.calls[0][1]).toContain("1. user: Hello");
		expect(mockProvider.confirm.mock.calls[1][0]).toBe("Return MCP sampling response");
		expect(mockProvider.confirm.mock.calls[1][1]).toContain("Bonjour");
	});

	it("falls back to UI form when provider has no confirm", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");
		const form = vi.fn(async () => ({ action: "submit" as const, values: {} }));
		const providerWithoutConfirm = {
			resolveModel: mockProvider.resolveModel,
			complete: mockProvider.complete,
		} as unknown as SamplingProvider;

		await handleSamplingRequest(
			createOptions({ autoApprove: false, provider: providerWithoutConfirm, ui: { notify: vi.fn(), form } }),
			createSamplingRequest({ messages: [{ role: "user", content: { type: "text", text: "Hello" } }], maxTokens: 50 }),
		);

		expect(form).toHaveBeenCalledTimes(2);
		expect(form.mock.calls[0][0]).toMatchObject({
			title: "Approve MCP sampling request",
			fields: [],
			submitLabel: "Approve",
			secondaryLabel: "Decline",
			cancelLabel: "Cancel",
		});
	});

	it("passes model preferences to the provider", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");
		await handleSamplingRequest(createOptions(), createSamplingRequest({
			messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
			maxTokens: 50,
			modelPreferences: { hints: [{ name: "haiku" }] },
		}));

		expect(mockProvider.resolveModel).toHaveBeenCalledWith({ hints: [{ name: "haiku" }] });
	});

	it("passes abort signal to the provider", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");
		const signal = new AbortController().signal;
		await handleSamplingRequest(createOptions({ getSignal: () => signal }), createSamplingRequest({
			messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
			maxTokens: 50,
		}));

		expect(mockProvider.complete).toHaveBeenCalledWith(
			model,
			expect.objectContaining({ signal }),
		);
	});

	it("rejects unsupported sampling features loudly", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");

		await expect(handleSamplingRequest(createOptions(), createSamplingRequest({
			messages: [{ role: "user", content: { type: "image", data: "abc", mimeType: "image/png" } }],
			maxTokens: 50,
		}))).rejects.toThrow("MCP sampling image content is not supported");

		await expect(handleSamplingRequest(createOptions(), createSamplingRequest({
			messages: [{ role: "user", content: { type: "audio", data: "abc", mimeType: "audio/wav" } }],
			maxTokens: 50,
		}))).rejects.toThrow("MCP sampling audio content is not supported");

		await expect(handleSamplingRequest(createOptions(), createSamplingRequest({
			messages: [],
			maxTokens: 50,
			includeContext: "thisServer",
		}))).rejects.toThrow("MCP sampling context inclusion is not supported");

		expect(mockProvider.complete).not.toHaveBeenCalled();
	});

	it("throws when no model is resolved", async () => {
		const { handleSamplingRequest } = await import("../sampling-handler.ts");
		mockProvider.resolveModel.mockResolvedValueOnce(undefined);

		await expect(handleSamplingRequest(createOptions(), createSamplingRequest({
			messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
			maxTokens: 50,
		}))).rejects.toThrow("No model available for MCP sampling");
	});
});
