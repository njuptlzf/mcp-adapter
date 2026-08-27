/**
 * Unit tests for ProtocolElicitationForwarder.
 *
 * Tests forwarding of MCP elicitation requests from downstream servers to the
 * Agent Client via `server.elicitInput()`, using the MockMcpClient fixture
 * for in-process testing (no real MCP server spawned).
 *
 * Covers D-07: protocol forwarding via elicitation/create reverse call.
 * Also tests the `convertFieldToSchema` helper for FormField → JSON Schema
 * property conversion.
 */

import { describe, expect, it } from "vitest";
import {
	ProtocolElicitationForwarder,
	convertFieldToSchema,
} from "../adapters/protocol-elicitation-forwarder.ts";
import { MockMcpClient } from "./fixtures/mock-mcp-client.ts";
import type { FormConfig, FormField } from "../interfaces/host-types.ts";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/** Minimal FormConfig for tests — text + select fields. */
function makeTestForm(): FormConfig {
	return {
		title: "Test Form",
		message: "Enter data",
		fields: [
			{
				name: "username",
				type: "text",
				label: "Username",
				required: true,
			} as FormField,
			{
				name: "role",
				type: "select",
				label: "Role",
				options: [{ value: "admin" }, { value: "user" }],
			} as FormField,
		],
	};
}

describe("ProtocolElicitationForwarder", () => {
	it("form forwards to elicitInput", async () => {
		const mockClient = new MockMcpClient({ elicitation: { form: {} } });
		const forwarder = new ProtocolElicitationForwarder(mockClient as unknown as Server);

		await forwarder.form(makeTestForm());

		// Assert elicitInput was called once
		expect(mockClient.elicitInputCalls).toHaveLength(1);

		// Assert params
		const call = mockClient.elicitInputCalls[0] as {
			mode: string;
			message: string;
			requestedSchema: {
				type: string;
				properties: Record<string, Record<string, unknown>>;
				required?: string[];
			};
		};
		expect(call.mode).toBe("form");
		expect(call.message).toBe("Enter data");
		expect(call.requestedSchema.type).toBe("object");

		// username field → string type
		expect(call.requestedSchema.properties.username.type).toBe("string");

		// role field → string type with enum
		expect(call.requestedSchema.properties.role.type).toBe("string");
		expect(call.requestedSchema.properties.role.enum).toEqual(["admin", "user"]);

		// required array contains "username"
		expect(call.requestedSchema.required).toContain("username");
	});

	it("accept result maps to submit", async () => {
		const mockClient = new MockMcpClient(
			{ elicitation: { form: {} } },
			{
				elicitResult: {
					action: "accept",
					content: { username: "testuser" },
				},
			},
		);
		const forwarder = new ProtocolElicitationForwarder(mockClient as unknown as Server);

		const result = await forwarder.form(makeTestForm());

		expect(result.action).toBe("submit");
		expect(result.values).toEqual({ username: "testuser" });
	});

	it("decline result maps to secondary", async () => {
		const mockClient = new MockMcpClient(
			{ elicitation: { form: {} } },
			{
				elicitResult: { action: "decline" },
			},
		);
		const forwarder = new ProtocolElicitationForwarder(mockClient as unknown as Server);

		const result = await forwarder.form(makeTestForm());

		expect(result.action).toBe("secondary");
	});

	it("cancel result maps to cancel", async () => {
		const mockClient = new MockMcpClient(
			{ elicitation: { form: {} } },
			{
				elicitResult: { action: "cancel" },
			},
		);
		const forwarder = new ProtocolElicitationForwarder(mockClient as unknown as Server);

		const result = await forwarder.form(makeTestForm());

		expect(result.action).toBe("cancel");
	});
});

describe("convertFieldToSchema", () => {
	it("converts select to string with enum", () => {
		const field: FormField = {
			name: "color",
			type: "select",
			label: "Color",
			options: [{ value: "red" }, { value: "blue" }],
		} as FormField;

		const schema = convertFieldToSchema(field);

		expect(schema).toEqual({
			type: "string",
			enum: ["red", "blue"],
			title: "Color",
		});
	});

	it("converts multiSelect to array with items enum", () => {
		const field: FormField = {
			name: "tags",
			type: "multiSelect",
			label: "Tags",
			options: [{ value: "a" }, { value: "b" }],
		} as FormField;

		const schema = convertFieldToSchema(field);

		expect(schema).toEqual({
			type: "array",
			items: { type: "string", enum: ["a", "b"] },
			title: "Tags",
		});
	});

	it("converts text to string", () => {
		const field: FormField = {
			name: "name",
			type: "text",
			label: "Name",
		} as FormField;

		const schema = convertFieldToSchema(field);

		expect(schema).toEqual({
			type: "string",
			title: "Name",
		});
	});
});
