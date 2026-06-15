import { encoding_for_model } from "tiktoken";
const enc = encoding_for_model("gpt-4o"); // cl100k_base

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function countToolDefinitions(tools: any[]): number {
  // Simulate OpenAI API's tools parameter serialization format
  const payload = {
    tools: tools.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }))
  };
  return countTokens(JSON.stringify(payload));
}

// Helper function to convert server spec to OpenAI format
export function toOpenAIFormat(tool: any): any {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.parameters || { type: "object", properties: {} }
    }
  };
}