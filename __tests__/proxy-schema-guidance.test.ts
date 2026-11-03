import { describe, expect, it } from "vitest";
import { executeDescribe, executeSearch } from "../proxy-modes.ts";
import { createJsonSchemaValidator } from "../json-schema-validator.ts";
import type { JsonSchemaType } from "@modelcontextprotocol/client";
import type { McpExtensionState } from "../state.ts";

function stateFor(inputSchema: Record<string, unknown>): McpExtensionState {
  return {
    config: { mcpServers: { demo: { command: "unused" } } },
    toolMetadata: new Map([["demo", [{
      name: "demo_analyze", originalName: "analyze", description: "Analyze a document", inputSchema,
    }]]]),
    manager: { getConnection: () => undefined, isConnecting: () => false },
    failureTracker: new Map(),
  } as unknown as McpExtensionState;
}

function textFor(state: McpExtensionState): string {
  return executeDescribe(state, "demo_analyze").content.map(block => block.type === "text" ? block.text : "").join("\n");
}

function describedSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const json = textFor(stateFor(schema)).match(/^```json\n([\s\S]*?)\n```/m);
  expect(json, "the selected contract must be available in model-visible content").not.toBeNull();
  return JSON.parse(json![1]!);
}

const boundedSchema = {
  type: "object",
  properties: {
    max_heap_mb: {
      type: "integer", minimum: 128, maximum: 16384, default: 1024,
      description: "Maximum isolated analyzer heap in MiB.", examples: [1024, 2048],
    },
  },
  required: ["max_heap_mb"],
  additionalProperties: false,
};

describe("proxy discovery of details omitted by compact types", () => {
  it("retains explanations, integer requirements, bounds, defaults and examples", () => {
    const shown = describedSchema(boundedSchema);
    expect(shown).toEqual(boundedSchema);
    const validate = createJsonSchemaValidator().getValidator(shown as JsonSchemaType);
    for (const value of [128, 1024, 16384]) expect(validate({ max_heap_mb: value }).valid).toBe(true);
    for (const value of [127, 128.5, 16385]) expect(validate({ max_heap_mb: value }).valid).toBe(false);
    expect(validate({}).valid).toBe(false);
  });

  it("does not require a description to preserve a constraint", () => {
    const schema = { type: "object", properties: { count: { type: "integer" } } };
    expect(describedSchema(schema)).toEqual(schema);
  });

  it("preserves guidance and constraints reached through definitions", () => {
    const schema = {
      type: "object",
      properties: { heap: { $ref: "#/$defs/Heap" } },
      $defs: { Heap: { type: "integer", minimum: 128, description: "Heap in MiB" } },
    };
    expect(describedSchema(schema)).toEqual(schema);
  });

  it("retains nested item guidance, false/null defaults and schema annotations", () => {
    const schema = {
      type: "object",
      title: "Analysis options",
      properties: {
        tags: { type: "array", minItems: 1, items: { type: "string", pattern: "^[a-z]+$", description: "A lowercase tag" } },
        enabled: { type: "boolean", default: false },
        optional: { type: ["string", "null"], default: null },
      },
      "x-contract-note": { message: "Retain server-provided annotations" },
    };
    expect(describedSchema(schema)).toEqual(schema);
  });

  it.each([
    { type: "object", required: ["undeclared"] },
    { type: "object", properties: { label: { type: "string" } }, additionalProperties: false },
    { type: "object", properties: { mode: { oneOf: [{ type: "number" }, { type: "integer" }] } } },
    { type: "object", properties: { record: { properties: { label: { type: "string" } } } } },
  ])("does not treat non-structural validation rules as a complete compact shape: %j", schema => {
    expect(describedSchema(schema)).toEqual(schema);
  });

  it("keeps plain structural schemas compact, even when property names resemble schema keywords", () => {
    const state = stateFor({
      type: "object",
      properties: {
        description: { type: "string" },
        $ref: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        options: { type: "object", properties: { enabled: { type: "boolean" }, weight: { type: "number" } } },
      },
      required: ["description"],
    });
    const text = textFor(state);
    expect(text).toContain("Shape:");
    expect(text).toContain("description: string");
    expect(text).toContain("tags?: string[]");
    expect(text).not.toContain("```json");
  });

  it("keeps schema-bearing search compact and points to a full selected contract", async () => {
    const state = stateFor(boundedSchema);
    const result = await executeSearch(state, "demo_analyze");
    const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
    expect(text).toContain("summary");
    expect(text).not.toContain("```json");
    expect(text).not.toContain("Maximum isolated analyzer heap");
    const route = text.match(/mcp\((\{[^\n]*\})\)/);
    expect(route).not.toBeNull();
    expect(JSON.parse(route![1]!)).toEqual({ describe: "demo_analyze", server: "demo" });
    expect(describedSchema(boundedSchema)).toEqual(boundedSchema);
  });

  it("does not add schema text or a hint when search explicitly omits schemas", async () => {
    const result = await executeSearch(stateFor(boundedSchema), "demo_analyze", false, undefined, false);
    const text = result.content.map(block => block.type === "text" ? block.text : "").join("\n");
    expect(text).not.toContain("Shape:");
    expect(text).not.toContain("```json");
    expect(text).not.toContain("mcp(");
  });
});
