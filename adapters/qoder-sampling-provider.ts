/**
 * Qoder-specific implementation of the generic `SamplingProvider`.
 *
 * This file is the SOLE boundary between MCP sampling and the Qoder SDK
 * (`@qoder-ai/qoder-agent-sdk`). It is the only file outside
 * `adapters/qoder-*.ts` that imports the SDK (per D-06).
 *
 * Pitfall 3 mitigation: the `queryFn` constructor parameter defaults to the
 * real SDK `query` factory but is overridable so tests can inject a mock
 * `Query` async iterable without spawning a real `qodercli` subprocess.
 *
 * **Threat-model notes**
 *   - T-06-03 (Information Disclosure): `complete` NEVER logs
 *     `request.systemPrompt`, `request.messages`, or the resolved model API
 *     key. Error paths only log `console.debug` with a stable event name +
 *     the provider/id string. No payload content reaches `console.*`.
 *   - T-06-03b: `resolveModel` catches SDK errors silently and returns
 *     `undefined`. The caller (`sampling-handler.ts`) falls back to a
 *     default. The provider never throws a confusing SDK error into MCP
 *     sampling UX.
 *   - T-06-03d: `request.signal` is forwarded into `options.signal` so the
 *     caller can abort the underlying SDK query.
 *
 * Implementation note: PLAN.md / RESEARCH.md informally reference
 * `Query.getModels()`, but the SDK's actual exported method is
 * `Query.getAvailableModels()` (verified at `dist/types/options.d.ts:282`).
 * The smoke script at `scripts/qoder-smoke.ts` already documents this
 * naming discrepancy and falls back to duck-typing either name. This
 * implementation uses the typed SDK name `getAvailableModels` and rejects
 * any object missing that method with a clear error message.
 */

import { query } from "@qoder-ai/qoder-agent-sdk";
import type { ModelPreferences } from "@modelcontextprotocol/sdk/types.js";
import type {
	SamplingMessage,
	SamplingModel,
	SamplingProvider,
	SamplingRequest,
	SamplingResponse,
	SamplingTextContent,
} from "../interfaces/sampling.ts";

/**
 * Convenience alias for the `query` factory signature. Tests inject a
 * `vi.fn()` cast to this type so unit tests can verify behavior without
 * spawning a real `qodercli` subprocess.
 */
export type QoderQueryFn = typeof query;

/**
 * Shape of a single message emitted by the SDK's async iterable. We narrow
 * the union lazily so `resolveModel` only depends on `getAvailableModels`
 * and `complete` only depends on the `result` discriminator.
 */
interface QoderModelDescriptor {
	value: string;
	modelId?: string;
	displayName: string;
}

const QODER_PROVIDER = "qoder";

/**
 * Agent-agnostic sampling bridge for the Qoder SDK.
 *
 * Mirrors the constructor-injection pattern of `PiSamplingProvider` so the
 * production path uses the real SDK `query` factory while tests can pass a
 * mock. The optional `defaultModel` lets callers skip `resolveModel` and
 * pass a known-good model straight into `complete`.
 */
export class QoderSamplingProvider implements SamplingProvider {
	constructor(
		private readonly queryFn: QoderQueryFn = query,
		private readonly defaultModel?: SamplingModel,
	) {}

	/**
	 * Discover a usable Qoder model via `Query.getAvailableModels()`.
	 *
	 * Returns `undefined` (NEVER throws) when the SDK is unreachable, when
	 * the model list is empty, or when `getAvailableModels` is absent from
	 * the runtime Query handle. The caller (`sampling-handler.ts`) is
	 * expected to apply its own fallback chain when `undefined` is
	 * returned.
	 *
	 * Optional `prefs` honors `ModelPreferences.hints[].name` by case-
	 * insensitive substring match against `value`, `displayName`, and
	 * `modelId`. When no hint matches, the first available model is used.
	 */
	async resolveModel(prefs?: ModelPreferences): Promise<SamplingModel | undefined> {
		try {
			const handle = this.queryFn({
				prompt: "",
				options: { model: "default" },
			});
			if (!handle) {
				return this.defaultModel;
			}
			if (typeof handle.getAvailableModels !== "function") {
				console.debug("[mcp-adapter/qoder] resolveModel: getAvailableModels not available on Query");
				try {
					await handle.close();
				} catch {
					// ignore — best-effort cleanup
				}
				return this.defaultModel;
			}
			let models: unknown;
			try {
				models = await handle.getAvailableModels();
			} finally {
				try {
					await handle.close();
				} catch {
					// ignore — best-effort cleanup
				}
			}
			if (!Array.isArray(models) || models.length === 0) {
				console.debug("[mcp-adapter/qoder] resolveModel: no models available");
				return this.defaultModel;
			}
			const picked = pickModel(models as QoderModelDescriptor[], prefs);
			if (!picked) {
				console.debug("[mcp-adapter/qoder] resolveModel: no model matched hints");
				return this.defaultModel;
			}
			return {
				provider: QODER_PROVIDER,
				id: picked.value,
				name: picked.displayName,
			};
		} catch (err) {
			// T-06-03b: NEVER log the SDK error verbatim — it can contain
			// tokens or paths that the user opted into. Only log a stable
			// event name + the error class.
			console.debug(`[mcp-adapter/qoder] resolveModel: SDK call failed (${(err as Error).name ?? "Error"})`);
			return this.defaultModel;
		}
	}

	/**
	 * Drive a single-turn sampling completion against the Qoder SDK and
	 * return a normalized `SamplingResponse`.
	 *
	 * The provider's async iterable is consumed until the SDK emits a
	 * `result` message. After that the loop is short-circuited — Qoder
	 * sessions are single-turn for MCP sampling purposes.
	 *
	 * Throws when:
	 *   - the iterable ends without a `result` message, OR
	 *   - the result subtype is a generic `error` (rare on Qoder; the
	 *     typed errors below are returned with `stopReason` set instead).
	 *
	 * Never logs `request.systemPrompt`, `request.messages`, or API keys
	 * (T-06-03).
	 */
	async complete(model: SamplingModel, request: SamplingRequest): Promise<SamplingResponse> {
		const modelId = `${model.provider}/${model.id}`;
		const prompt = buildPrompt(request.messages);
		// The Qoder SDK does not expose a top-level `signal` option; signal
		// passthrough is bridged via `Options.abortController`. `maxTokens`
		// is not a typed `Options` field either (the SDK enforces turn
		// budgets via `maxTurns`), so we drop both here and rely on the
		// SDK's defaults. Documented for future enhancement.
		const options: Parameters<QoderQueryFn>[0]["options"] = {
			model: modelId,
		};
		if (request.signal !== undefined) {
			const controller = new AbortController();
			if (request.signal.aborted) {
				controller.abort(request.signal.reason);
			} else {
				request.signal.addEventListener(
					"abort",
					() => controller.abort(request.signal?.reason),
					{ once: true },
				);
			}
			options.abortController = controller;
		}

		const handle = this.queryFn({ prompt, options });
		try {
			for await (const raw of handle as AsyncIterable<unknown>) {
				const msg = raw as { type?: unknown; subtype?: unknown; result?: unknown; errors?: unknown };
				if (msg?.type !== "result" || typeof msg.subtype !== "string") {
					continue;
				}
				return interpretResult(
					{ subtype: msg.subtype, result: asString(msg.result), errors: asStringArray(msg.errors) },
					modelId,
				);
			}
			throw new Error("Qoder sampling returned no result message");
		} catch (err) {
			// T-06-03: log ONLY the provider/id string — never the prompt,
			// the messages, the systemPrompt, or any token-bearing field.
			// The thrown Error may carry the SDK's own message verbatim; we
			// re-throw it so the MCP handler can surface a structured
			// error, but we do NOT log the request payload.
			console.debug(`[mcp-adapter/qoder] complete: Qoder sampling failed for ${modelId}`);
			throw err;
		} finally {
			try {
				await handle.close();
			} catch {
				// best-effort cleanup
			}
		}
	}

	/**
	 * Auto-confirm dialog. Qoder does not expose a programmatic confirm UI
	 * at the time of writing, so the Qoder adapter defaults to auto-approve
	 * for MCP-sampling confirmations. Future enhancements may allow a
	 * caller-supplied confirm via a constructor parameter (out of scope
	 * for Phase 6).
	 */
	async confirm(_title: string, _message: string): Promise<boolean> {
		return true;
	}
}

/**
 * Pick the first model whose `value` / `displayName` / `modelId` matches a
 * preference hint (case-insensitive substring). If no hint is provided OR no
 * hint matches, return the first model. Returns `undefined` for empty input.
 */
function pickModel(
	models: QoderModelDescriptor[],
	prefs?: ModelPreferences,
): QoderModelDescriptor | undefined {
	if (models.length === 0) return undefined;
	const hints = prefs?.hints ?? [];
	for (const hint of hints) {
		const needle = hint.name?.trim().toLowerCase();
		if (!needle) continue;
		const matched = models.find((m) => {
			const haystacks = [m.value, m.displayName, m.modelId ?? ""];
			return haystacks.some((hay) => hay.toLowerCase().includes(needle));
		});
		if (matched) return matched;
	}
	return models[0];
}

/**
 * Reduce a list of MCP sampling messages to a single prompt string. The
 * Qoder SDK's `query()` accepts either a single string or an async iterable
 * of user messages; for MCP sampling we always use a string for simplicity.
 */
function buildPrompt(messages: SamplingMessage[]): string {
	const parts: string[] = [];
	for (const message of messages) {
		if (typeof message.content === "string") {
			parts.push(message.content);
			continue;
		}
		const text = message.content
			.map((block) => extractBlockText(block))
			.filter((value): value is string => value !== undefined)
			.join("");
		if (text) parts.push(text);
	}
	return parts.join("\n\n");
}

function extractBlockText(block: SamplingTextContent): string | undefined {
	if (typeof block === "object" && block !== null && (block as { type?: string }).type === "text") {
		return (block as { text: string }).text;
	}
	return undefined;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Convert a SDK result message into the agent-agnostic `SamplingResponse`.
 *
 * Mapping (per PLAN.md + SDK actuals):
 *   - `subtype === "success"` → `{ text: result, stopReason: "endTurn" }`
 *   - `subtype` starting with `error_` → `{ text: errors joined,
 *     stopReason: subtype }` (the SDK uses `error_during_execution`,
 *     `error_max_turns`, `error_max_budget_usd`,
 *     `error_max_structured_output_retries`).
 *   - `subtype === "error"` (rare; older SDK) → thrown as Error so the MCP
 *     handler reports a structured failure to the caller.
 */
function interpretResult(
	msg: { subtype: string; result?: string; errors?: string[] },
	modelId: string,
): SamplingResponse {
	if (msg.subtype === "success") {
		return {
			text: msg.result ?? "",
			model: modelId,
			stopReason: "endTurn",
		};
	}
	if (msg.subtype.startsWith("error_")) {
		const text = msg.errors && msg.errors.length > 0 ? msg.errors.join("\n") : (msg.result ?? "");
		return {
			text,
			model: modelId,
			stopReason: msg.subtype,
		};
	}
	if (msg.subtype === "error") {
		const detail = msg.errors && msg.errors.length > 0 ? msg.errors.join("\n") : (msg.result ?? "Qoder sampling failed");
		throw new Error(detail);
	}
	throw new Error(`Qoder sampling returned unknown result subtype: ${msg.subtype}`);
}
