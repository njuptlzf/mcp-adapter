import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "json-tools", version: "1.0.0" });

server.tool("parse", "Parse JSON string", {
  json: z.string().describe("JSON string to parse"),
}, async ({ json }) => {
  try {
    const parsed = JSON.parse(json);
    return { content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: Invalid JSON - ${error.message}` }] };
  }
});

server.tool("stringify", "Stringify JSON object", {
  obj: z.string().describe("JSON string to stringify (already parsed)"),
  space: z.number().optional().default(2).describe("Number of spaces for indentation"),
}, async ({ obj, space }) => {
  try {
    const parsed = JSON.parse(obj);
    return { content: [{ type: "text", text: JSON.stringify(parsed, null, space) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: Invalid JSON - ${error.message}` }] };
  }
});

server.tool("get_path", "Get value at JSON path", {
  obj: z.string().describe("JSON object as string"),
  path: z.string().describe("JSON path (e.g., 'a.b[0].c')"),
}, async ({ obj, path }) => {
  try {
    const parsed = JSON.parse(obj);
    const parts = path.split(/[\.[\]]/).filter(p => p !== "");
    let current = parsed;
    for (const part of parts) {
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part)];
      } else {
        current = current[part];
      }
      if (current === undefined) {
        return { content: [{ type: "text", text: `Error: Cannot read property '${part}' of undefined` }] };
      }
    }
    return { content: [{ type: "text", text: JSON.stringify(current) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("merge", "Merge two JSON objects", {
  obj1: z.string().describe("First JSON object"),
  obj2: z.string().describe("Second JSON object"),
  mergeArrays: z.boolean().optional().default(false).describe("Whether to merge arrays or replace them"),
}, async ({ obj1, obj2, mergeArrays }) => {
  try {
    const o1 = JSON.parse(obj1);
    const o2 = JSON.parse(obj2);
    
    function merge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !(Array.isArray(source[key]) && !mergeArrays)) {
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = Array.isArray(source[key]) ? [] : {};
          }
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    }
    
    const result = merge(JSON.parse(JSON.stringify(o1)), o2);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

server.tool("validate_schema", "Validate JSON against schema", {
  data: z.string().describe("JSON data to validate"),
  schema: z.string().describe("JSON schema to validate against"),
}, async ({ data, schema }) => {
  try {
    const parsedData = JSON.parse(data);
    const parsedSchema = JSON.parse(schema);
    
    // Simple validation - just check if required properties exist
    if (parsedSchema.type === "object" && parsedSchema.required) {
      for (const requiredProp of parsedSchema.required) {
        if (!(requiredProp in parsedData)) {
          return { content: [{ type: "text", text: `Error: Missing required property '${requiredProp}'` }] };
        }
      }
    }
    
    return { content: [{ type: "text", text: "Validation passed" }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);