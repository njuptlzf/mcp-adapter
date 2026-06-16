/**
 * Contract tests for `QoderSamplingProvider`.
 *
 * Strategy (Pitfall 3 from RESEARCH.md): inject a fake `queryFn` via the
 * constructor so no real `qodercli` subprocess is spawned. The fake
 * factory returns a `Query`-shaped object with `getAvailableModels`,
 * `close`, and an async iterator that yields the messages the test
 * wants to assert against.
 *
 * D-06 file boundary: this test imports `QoderSamplingProvider` (the
 * production boundary) but does NOT import anything from
 * `@qoder-ai/qoder-agent-sdk` directly. All SDK behavior is mocked via
 * dependency injection.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { QoderSamplingProvider, type QoderQueryFn } from "../adapters/qoder-sampling-provider.ts";
import type { SamplingModel, SamplingRequest, SamplingResponse } from "../interfaces/sampling.ts";

type ModelDescriptor = {
	value: string;
	modelId?: string;
	displayName: string;
};

type FakeQuery = Awaited<ReturnType<QoderQueryFn>> & {
	getAvailableModels: () => Promise<ModelDescriptor[]>;
	setModel: (model: string) => Promise<void>;
};

/**
 * Build a fake Query async iterable + control surface. The fake:
 *   - exposes `getAvailableModels` returning the supplied model list.
 *   - exposes `setModel` that records the requested model id.
 *   - iterates the supplied `messages` and then ends.
 *   - exposes `close` that resolves successfully.
 */
function makeFakeQuery(opts: {
	messages?: unknown[];
	models?: ModelDescriptor[];
}): FakeQuery {
	const messages = opts.messages ?? [];
	const models = opts.models ?? [];
	let lastSetModel: string | undefined;
	const asyncIter = (): AsyncIterator<unknown> => {
		let i = 0;
		return {
			next: () => {
				if (i < messages.length) {
					return Promise.resolve({ value: messages[i++], done: false });
				}
				return Promise.resolve({ value: undefined, done: true });
			},
		};
	};
	const fake = {
		[Symbol.asyncIterator]: asyncIter,
		getAvailableModels: () => Promise.resolve(models),
		setModel: (model: string) => {
			lastSetModel = model;
			return Promise.resolve();
		},
		close: () => Promise.resolve(),
		interrupt: () => Promise.resolve(),
	} as unknown as FakeQuery;
	// Attach helper for tests that need to inspect setModel side-effects.
	(fake as unknown as { __lastSetModel?: string }).__lastSetModel = lastSetModel;
	return fake;
}

function makeFakeQueryFn(opts: Parameters<typeof makeFakeQuery>[0]): {
	fn: QoderQueryFn;
	lastCall: () => { prompt?: string; options?: unknown } | undefined;
} {
	let lastCall: { prompt?: string; options?: unknown } | undefined;
	// Use vi.fn() so the test can introspect call counts/args via the mock's
	// own `.mock.calls` API if needed (Pitfall 3 mitigation: keep the mock
	// boundary explicit).
	const inner = vi.fn((params: { prompt: string; options?: unknown }) => {
		lastCall = { prompt: params.prompt, options: params.options };
		return makeFakeQuery(opts);
	});
	const fn = inner as unknown as QoderQueryFn;
	return {
		fn,
		lastCall: () => lastCall,
	};
}

const sampleModel: SamplingModel = { provider: "qoder", id: "gpt-4", name: "GPT-4" };

const sampleRequest: SamplingRequest = {
	systemPrompt: "You are a helpful assistant.",
	messages: [{ role: "user", content: "Hello" }],
	maxTokens: 256,
	temperature: 0.5,
};

describe("QoderSamplingProvider.resolveModel", () => {
	let errSpy: ReturnType<typeof vi.spyOn>;
	let logSpy: ReturnType<typeof vi.spyOn>;
	let debugSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	it("returns the first model from Query.getAvailableModels()", async () => {
		const { fn } = makeFakeQueryFn({
			models: [{ value: "gpt-4", displayName: "GPT-4" }],
		});
		const provider = new QoderSamplingProvider(fn);
		const selected = await provider.resolveModel();
		expect(selected).toEqual({ provider: "qoder", id: "gpt-4", name: "GPT-4" });
	});

	it("returns undefined when getAvailableModels returns an empty list", async () => {
		const { fn } = makeFakeQueryFn({ models: [] });
		const provider = new QoderSamplingProvider(fn);
		await expect(provider.resolveModel()).resolves.toBeUndefined();
	});

	it("returns undefined (does not throw) when queryFn throws", async () => {
		const throwingFn = (() => {
			throw new Error("qodercli unreachable");
		}) as unknown as QoderQueryFn;
		const provider = new QoderSamplingProvider(throwingFn);
		await expect(provider.resolveModel()).resolves.toBeUndefined();
	});

	it("returns the defaultModel when set and getAvailableModels fails", async () => {
		const throwingFn = (() => {
			throw new Error("sdk boot failure");
		}) as unknown as QoderQueryFn;
		const fallback: SamplingModel = { provider: "qoder", id: "fallback", name: "Fallback" };
		const provider = new QoderSamplingProvider(throwingFn, fallback);
		await expect(provider.resolveModel()).resolves.toBe(fallback);
	});

	it("honors ModelPreferences.hints via case-insensitive substring match", async () => {
		const { fn } = makeFakeQueryFn({
			models: [
				{ value: "haiku", displayName: "Claude Haiku" },
				{ value: "opus", displayName: "Claude Opus" },
			],
		});
		const provider = new QoderSamplingProvider(fn);
		const selected = await provider.resolveModel({ hints: [{ name: "OpUs" }] });
		expect(selected?.id).toBe("opus");
	});

	it("returns undefined when getAvailableModels is missing on the Query handle", async () => {
		// Fake Query without getAvailableModels — simulate older SDK.
		const fakeQuery = {
			[Symbol.asyncIterator]: (): AsyncIterator<unknown> => ({
				next: () => Promise.resolve({ value: undefined, done: true }),
			}),
			close: () => Promise.resolve(),
		};
		const fn = (() => fakeQuery) as unknown as QoderQueryFn;
		const provider = new QoderSamplingProvider(fn);
		await expect(provider.resolveModel()).resolves.toBeUndefined();
	});
});

describe("QoderSamplingProvider.complete", () => {
	let errSpy: ReturnType<typeof vi.spyOn>;
	let logSpy: ReturnType<typeof vi.spyOn>;
	let debugSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	it("returns SamplingResponse with text + model + stopReason on subtype 'success'", async () => {
		const { fn } = makeFakeQueryFn({
			messages: [{ type: "result", subtype: "success", result: "Hello there" }],
		});
		const provider = new QoderSamplingProvider(fn);
		const response = (await provider.complete(sampleModel, sampleRequest)) as SamplingResponse;
		expect(response.text).toBe("Hello there");
		expect(response.model).toBe("qoder/gpt-4");
		expect(response.stopReason).toBe("endTurn");
	});

	it("returns stopReason=error_during_execution with joined errors on that subtype", async () => {
		const { fn } = makeFakeQueryFn({
			messages: [
				{
					type: "result",
					subtype: "error_during_execution",
					errors: ["boom", "kapow"],
				},
			],
		});
		const provider = new QoderSamplingProvider(fn);
		const response = (await provider.complete(sampleModel, sampleRequest)) as SamplingResponse;
		expect(response.stopReason).toBe("error_during_execution");
		expect(response.text).toBe("boom\nkapow");
	});

	it("throws on subtype 'error' so MCP sampling-handler can surface it", async () => {
		const { fn } = makeFakeQueryFn({
			messages: [
				{
					type: "result",
					subtype: "error",
					errors: ["rate limited"],
				},
			],
		});
		const provider = new QoderSamplingProvider(fn);
		await expect(provider.complete(sampleModel, sampleRequest)).rejects.toThrow(/rate limited/);
	});

	it("throws when no result message is received before the iterator ends", async () => {
		const { fn } = makeFakeQueryFn({
			messages: [{ type: "assistant", content: "thinking..." }],
		});
		const provider = new QoderSamplingProvider(fn);
		await expect(provider.complete(sampleModel, sampleRequest)).rejects.toThrow(
			/no result message/,
		);
	});

	it("concatenates message content (string and SamplingTextContent[]) into a single prompt", async () => {
		const { fn, lastCall } = makeFakeQueryFn({
			messages: [{ type: "result", subtype: "success", result: "ok" }],
		});
		const provider = new QoderSamplingProvider(fn);
		await provider.complete(sampleModel, {
			messages: [
				{ role: "user", content: "First user line" },
				{
					role: "assistant",
					content: [{ type: "text", text: "Assistant reply" }],
				},
				{ role: "user", content: "Second user line" },
			],
		});
		const call = lastCall();
		expect(call?.prompt).toBe(
			"First user line\n\nAssistant reply\n\nSecond user line",
		);
	});

	it("passes the composite model id (`{provider}/{id}`) into options.model", async () => {
		const { fn, lastCall } = makeFakeQueryFn({
			messages: [{ type: "result", subtype: "success", result: "ok" }],
		});
		const provider = new QoderSamplingProvider(fn);
		await provider.complete(sampleModel, sampleRequest);
		const call = lastCall();
		expect((call?.options as { model?: string } | undefined)?.model).toBe("qoder/gpt-4");
	});

	it("never logs API keys, systemPrompt, or message content (T-06-03)", async () => {
		const { fn } = makeFakeQueryFn({
			messages: [
				{
					type: "result",
					subtype: "error_during_execution",
					errors: ["provider refused"],
				},
			],
		});
		const provider = new QoderSamplingProvider(fn);
		// Trigger an error path so any logger call would be exercised.
		const response = await provider.complete(sampleModel, sampleRequest);
		expect(response.stopReason).toBe("error_during_execution");
		// T-06-03: no console.* call may include the secret-bearing payload.
		// Patterns: api key, token, secret, the system prompt's text, or any
		// of the message strings.
		const SECRET_PATTERNS = /key|token|secret|prompt content|Hello/;
		const matches = (calls: unknown[][]): boolean =>
			calls.some((args) => args.some((a) => typeof a === "string" && SECRET_PATTERNS.test(a)));
		expect(matches(errSpy.mock.calls)).toBe(false);
		expect(matches(logSpy.mock.calls)).toBe(false);
		expect(matches(debugSpy.mock.calls)).toBe(false);
	});
});

describe("QoderSamplingProvider.confirm", () => {
	it("returns true by default (Qoder has no programmatic confirm UI yet)", async () => {
		const provider = new QoderSamplingProvider();
		await expect(provider.confirm("title", "message")).resolves.toBe(true);
	});
});
