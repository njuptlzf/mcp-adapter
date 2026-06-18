import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import { PiSamplingProvider } from "../adapters/pi-sampling-provider.ts";

type MockModelRegistry = {
	getAvailable: ReturnType<typeof vi.fn>;
	getApiKeyAndHeaders: ReturnType<typeof vi.fn>;
};

const usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

const model = {
	provider: "anthropic",
	id: "claude-sonnet",
	api: "anthropic-messages",
	name: "Claude Sonnet",
	baseUrl: "https://api.anthropic.com",
	input: ["text"],
	reasoning: false,
	cost: usage.cost,
	contextWindow: 200000,
	maxTokens: 8192,
} satisfies Model<"anthropic-messages">;

const opus = {
	...model,
	id: "claude-opus",
	name: "Claude Opus",
} satisfies Model<"anthropic-messages">;

const haiku = {
	...model,
	id: "claude-haiku",
	name: "Claude Haiku",
} satisfies Model<"anthropic-messages">;

const geminiFlash = {
	...model,
	provider: "google",
	id: "gemini-2.5-flash",
	api: "google-generative-ai",
	name: "Gemini 2.5 Flash",
	baseUrl: "https://generativelanguage.googleapis.com",
} satisfies Model<"google-generative-ai">;

function createProvider(
	registry: MockModelRegistry,
	getCurrentModel: () => Model<Api> | undefined = () => undefined,
	confirm?: (title: string, message: string) => Promise<boolean>,
): PiSamplingProvider {
	return new PiSamplingProvider(registry as unknown as ModelRegistry, getCurrentModel, confirm);
}

describe("PiSamplingProvider", () => {
	let registry: MockModelRegistry;

	beforeEach(() => {
		registry = {
			getAvailable: vi.fn(() => [model]),
			getApiKeyAndHeaders: vi.fn(async () => ({ ok: true, apiKey: "key", headers: { "x-test": "1" } })),
		};
	});

	it("selects the first available model by default", async () => {
		const provider = createProvider(registry);
		const selected = await provider.resolveModel();
		expect(selected).toEqual({ provider: "anthropic", id: "claude-sonnet", name: "Claude Sonnet" });
	});

	it("uses model preference hints before the current conversation model", async () => {
		registry.getAvailable.mockReturnValue([haiku, opus]);
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel({ hints: [{ name: "haiku" }] });
		expect(selected?.id).toBe("claude-haiku");
	});

	it("matches model preference hints case-insensitively after trimming", async () => {
		registry.getAvailable.mockReturnValue([haiku, opus]);
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel({ hints: [{ name: " HAIKU " }] });
		expect(selected?.id).toBe("claude-haiku");
	});

	it("matches model preference hints against display names", async () => {
		registry.getAvailable.mockReturnValue([geminiFlash, opus]);
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel({ hints: [{ name: "2.5 Flash" }] });
		expect(selected?.id).toBe("gemini-2.5-flash");
	});

	it("matches model preference hints against provider/id", async () => {
		registry.getAvailable.mockReturnValue([geminiFlash, opus]);
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel({ hints: [{ name: "google/gemini" }] });
		expect(selected?.id).toBe("gemini-2.5-flash");
	});

	it("preserves preference order across multiple model hints", async () => {
		registry.getAvailable.mockReturnValue([haiku, geminiFlash, opus]);
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel({ hints: [{ name: "gemini" }, { name: "haiku" }] });
		expect(selected?.id).toBe("gemini-2.5-flash");
	});

	it("falls back when hinted models do not have configured auth", async () => {
		registry.getAvailable.mockReturnValue([haiku, opus]);
		const getApiKeyAndHeaders = vi.fn(async (candidate: Model<Api>) => {
			if (candidate.id === "claude-haiku") return { ok: false, error: "missing key" };
			return { ok: true, apiKey: "key" };
		});
		registry.getApiKeyAndHeaders = getApiKeyAndHeaders;
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel({ hints: [{ name: "haiku" }] });

		expect(getApiKeyAndHeaders).toHaveBeenNthCalledWith(1, haiku);
		expect(getApiKeyAndHeaders).toHaveBeenNthCalledWith(2, opus);
		expect(selected?.id).toBe("claude-opus");
	});

	it("preserves current-model-first selection when no hints are provided", async () => {
		registry.getAvailable.mockReturnValue([haiku]);
		const provider = createProvider(registry, () => opus);
		const selected = await provider.resolveModel();
		expect(selected?.id).toBe("claude-opus");
	});

	it("exposes confirm when constructed with a dialog", async () => {
		const confirm = vi.fn(async () => true);
		const provider = createProvider(registry, () => undefined, confirm);
		await expect(provider.confirm("title", "message")).resolves.toBe(true);
		expect(confirm).toHaveBeenCalledWith("title", "message");
	});
});
