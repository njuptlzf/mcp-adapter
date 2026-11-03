import { describe, expect, it } from "vitest";
import { executeDescribe, executeSearch } from "../proxy-modes.ts";
import { createJsonSchemaValidator } from "../json-schema-validator.ts";
import type { JsonSchemaType } from "@modelcontextprotocol/client";
import type { McpExtensionState } from "../state.ts";

function stateFor(inputSchema: Record<string, unknown>): McpExtensionState {
  return {
    config: { mcpServers: { demo: { command: "unused" } } },
    toolMetadata: new Map([["demo", [{
      name: "demo_inspect", originalName: "inspect", description: "Inspect a document", inputSchema,
    }]]]),
    manager: { getConnection: () => undefined, isConnecting: () => false },
    failureTracker: new Map(),
  } as unknown as McpExtensionState;
}

function describedSchema(state: McpExtensionState): Record<string, unknown> {
  const result = executeDescribe(state, "demo_inspect");
  const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
  const json = text.match(/^```json\n([\s\S]*?)\n```/m);
  expect(json, "the model-visible description must contain the original JSON Schema").not.toBeNull();
  return JSON.parse(json![1]!);
}

function referencedSchema(group = "$defs"): Record<string, unknown> {
  return {
    type: "object",
    properties: { payload: { $ref: `#/${group}/Payload` } },
    required: ["payload"],
    additionalProperties: false,
    [group]: {
      Payload: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 1 },
          attributes: { type: "object", additionalProperties: {} },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  };
}

describe("proxy discovery of unsupported referenced schemas", () => {
  it.each(["$defs", "definitions"])("preserves %s definitions and the accepted request contract", group => {
    const schema = referencedSchema(group);
    const before = structuredClone(schema);
    const shown = describedSchema(stateFor(schema));
    expect(shown).toEqual(schema);
    expect(schema).toEqual(before);

    const validate = createJsonSchemaValidator().getValidator(shown as JsonSchemaType);
    expect(validate({ payload: { id: "example" } }).valid).toBe(true);
    expect(validate({ payload: { id: "example", attributes: { score: 3, enabled: true } } }).valid).toBe(true);
    expect(validate({ payload: {} }).valid).toBe(false);
    expect(validate({ payload: { id: "" } }).valid).toBe(false);
  });

  it("does not expand recursive references or change escaped reference targets", () => {
    const schema = {
      type: "object",
      properties: { node: { $ref: "#/$defs/node~1with~0name" } },
      required: ["node"],
      $defs: {
        "node/with~name": {
          type: "object",
          properties: {
            name: { type: "string" },
            next: { $ref: "#/$defs/node~1with~0name" },
            attributes: { type: "object", additionalProperties: {} },
          },
          required: ["name"],
        },
      },
    };
    const shown = describedSchema(stateFor(schema));
    expect(shown).toEqual(schema);
    const validate = createJsonSchemaValidator().getValidator(shown as JsonSchemaType);
    expect(validate({ node: { name: "first", next: { name: "second" } } }).valid).toBe(true);
    expect(validate({ node: { name: "first", next: {} } }).valid).toBe(false);
  });

  it("retains unresolved external references instead of claiming a complete expanded shape", () => {
    const schema = {
      type: "object",
      properties: { payload: { $ref: "https://example.invalid/contracts/payload.json" } },
      required: ["payload"],
    };
    expect(describedSchema(stateFor(schema))).toEqual(schema);
  });

  it("retains unsupported compositions and their reference siblings", () => {
    const schema = {
      type: "object",
      properties: {
        payload: {
          $ref: "#/$defs/Payload",
          description: "A document with a verified identifier",
          allOf: [{ required: ["verified"] }],
        },
      },
      required: ["payload"],
      $defs: { Payload: { type: "object", properties: { verified: { const: true } } } },
    };
    expect(describedSchema(stateFor(schema))).toEqual(schema);
  });

  it("keeps search compact and provides a usable route to the full selected schema", async () => {
    const schema = referencedSchema();
    const state = stateFor(schema);
    const result = await executeSearch(state, "demo_inspect");
    const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
    expect(text).toContain("summary");
    const route = text.match(/mcp\((\{[^\n]*\})\)/);
    expect(route, "an abbreviated search result must identify the describe request").not.toBeNull();
    const request = JSON.parse(route![1]!);
    expect(request).toEqual({ describe: "demo_inspect", server: "demo" });
    expect(text).not.toContain(JSON.stringify(schema.$defs));
    expect(text).not.toContain("```json");
    expect(describedSchema(state)).toEqual(schema);
  });

  it("does not add schema guidance to an explicitly schema-free search", async () => {
    const result = await executeSearch(stateFor(referencedSchema()), "demo_inspect", false, undefined, false);
    const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
    expect(text).not.toContain("```json");
    expect(text).not.toContain("mcp(");
    expect(result.details).toMatchObject({ count: 1, matches: [{ tool: "demo_inspect" }] });
  });
});
