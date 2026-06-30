/**
 * Unit tests for ProtocolSamplingForwarder.
 *
 * Tests forwarding of MCP sampling requests from downstream servers to the
 * Agent Client via `server.createMessage()`, using the MockMcpClient fixture
 * for in-process testing (no real MCP server spawned).
 *
 * Covers D-06, D-11: pure forwarding via protocol reverse call.
 */

import { describe, expect, it } from "vitest";
import { ProtocolSamplingForwarder } from "../adapters/protocol-sampling-forwarder.ts";
import { MockMcpClient } from "./fixtures/mock-mcp-client.ts";
import type { SamplingModel, SamplingRequest } from "../interfaces/sampling.ts";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

describe("ProtocolSamplingForwarder", () => {
	it("resolveModel returns placeholder model", async () => {
		const mockClient = new MockMcpClient({ sampling: {} });
		const forwarder = new ProtocolSamplingForwarder(mockClient as unknown as Server);

		const model = await forwarder.resolveModel();

		expect(model).toEqual({ provider: "mcp-protocol", id: "forwarded" });
	});

	it("complete forwards messages to createMessage", async () => {
		const mockClient = new MockMcpClient({ sampling: {} });
		const forwarder = new ProtocolSamplingForwarder(mockClient as unknown as Server);

		const model: SamplingModel = { provider: "mcp-protocol", id: "forwarded" };
		const request: SamplingRequest = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
			],
			systemPrompt: "test",
			maxTokens: 100,
		};

		const response = await forwarder.complete(model, request);

		// Assert createMessage was called once
		expect(mockClient.createMessageCalls).toHaveLength(1);

		// Assert params include systemPrompt and maxTokens from the request
		const call = mockClient.createMessageCalls[0];
		expect(call.messages).toHaveLength(2);
		expect(call.systemPrompt).toBe("test");
		expect(call.maxTokens).toBe(100);

		// Assert response mapping
		expect(response.text).toBe("mock-sampling-response");
		expect(response.model).toBe("mock-model");
		expect(response.stopReason).toBe("endTurn");
	});

	it("complete converts string content to text content blocks", async () => {
		const mockClient = new MockMcpClient({ sampling: {} });
		const forwarder = new ProtocolSamplingForwarder(mockClient as unknown as Server);

		const model: SamplingModel = { provider: "mcp-protocol", id: "forwarded" };
		const request: SamplingRequest = {
			messages: [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: [{ type: "text", text: "Hi" }] },
			],
			maxTokens: 50,
		};

		await forwarder.complete(model, request);

		const call = mockClient.createMessageCalls[0];

		// First message: string "Hello" should be converted to { type: "text", text: "Hello" }
		const firstContent = call.messages[0].content as { type: string; text: string };
		expect(firstContent).toEqual({ type: "text", text: "Hello" });

		// Second message: array content should pass through unchanged
		const secondContent = call.messages[1].content;
		expect(Array.isArray(secondContent)).toBe(true);
		expect(secondContent).toEqual([{ type: "text", text: "Hi" }]);
	});

	it("confirm returns true unconditionally", async () => {
		const mockClient = new MockMcpClient({ sampling: {} });
		const forwarder = new ProtocolSamplingForwarder(mockClient as unknown as Server);

		const result = await forwarder.confirm("title", "message");

		expect(result).toBe(true);
	});
});
