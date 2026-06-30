/**
 * Mock MCP Client fixture for in-process testing of protocol forwarders.
 *
 * Simulates an MCP Client that declares sampling and/or elicitation
 * capabilities, and records createMessage / elicitInput calls so tests
 * can assert forwarding behaviour without spawning a real MCP server.
 *
 * Used by:
 *   - __tests__/protocol-sampling-forwarder.test.ts
 *   - __tests__/protocol-elicitation-forwarder.test.ts
 *
 * D-13: in-process unit testing layer (no subprocess, no real MCP Client).
 */

import type {
	ClientCapabilities,
	CreateMessageRequestParamsBase,
	CreateMessageResult,
	ElicitRequestFormParams,
	ElicitRequestURLParams,
	ElicitResult,
} from "@modelcontextprotocol/sdk/types.js";

/** Capabilities the mock client declares (mirrors MCP ClientCapabilities). */
export interface MockMcpClientCapabilities {
	sampling?: unknown;
	elicitation?: { form?: unknown; url?: unknown };
}

/** Constructor options for overriding default mock return values. */
export interface MockMcpClientOptions {
	createMessageResult?: CreateMessageResult;
	elicitResult?: ElicitResult;
}

/**
 * In-process MCP Client mock.
 *
 * Structurally compatible with the subset of `Server` that the protocol
 * forwarders use (`getClientCapabilities`, `createMessage`, `elicitInput`).
 * In tests, cast via `as unknown as Server` when passing to a forwarder
 * constructor.
 */
export class MockMcpClient {
	private readonly _capabilities: MockMcpClientCapabilities;
	private readonly _createMessageResult: CreateMessageResult;
	private readonly _elicitResult: ElicitResult;

	/** Recorded createMessage calls, in call order. */
	readonly createMessageCalls: CreateMessageRequestParamsBase[] = [];
	/** Recorded elicitInput calls, in call order. */
	readonly elicitInputCalls: Array<ElicitRequestFormParams | ElicitRequestURLParams> = [];

	constructor(
		capabilities: MockMcpClientCapabilities,
		options?: MockMcpClientOptions,
	) {
		this._capabilities = capabilities;
		this._createMessageResult = options?.createMessageResult ?? {
			role: "assistant",
			content: { type: "text", text: "mock-sampling-response" },
			model: "mock-model",
			stopReason: "endTurn",
		};
		this._elicitResult = options?.elicitResult ?? {
			action: "accept",
			content: { field1: "mock-value" },
		};
	}

	/** Returns the capabilities declared in the constructor. */
	getClientCapabilities(): ClientCapabilities | undefined {
		return this._capabilities as ClientCapabilities | undefined;
	}

	/** Records the call and returns the configured (or default) mock result. */
	async createMessage(
		params: CreateMessageRequestParamsBase,
	): Promise<CreateMessageResult> {
		this.createMessageCalls.push(params);
		return this._createMessageResult;
	}

	/** Records the call and returns the configured (or default) mock result. */
	async elicitInput(
		params: ElicitRequestFormParams | ElicitRequestURLParams,
	): Promise<ElicitResult> {
		this.elicitInputCalls.push(params);
		return this._elicitResult;
	}
}
