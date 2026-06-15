import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { countTokens, toOpenAIFormat } from "./token-counter.ts";

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to read and parse server spec
function readServerSpec(serverName: string) {
  // Go up one directory from token-benchmark to tests, then to demo-servers
  const specPath = join(__dirname, "..", "demo-servers", serverName, "server-spec.json");
  return JSON.parse(readFileSync(specPath, "utf8"));
}

const servers = ["01-calculator", "02-string-utils", "03-datetime", "04-unit-converter", "05-json-tools", "06-markdown", "07-file-stats", "08-http-mock", "09-kv-store", "10-text-analyzer"];
const results: Record<string, { tools: number; tokens: number; bytes: number }> = {};

for (const dir of servers) {
  const spec = readServerSpec(dir);
  const serialized = JSON.stringify({ tools: spec.tools.map(toOpenAIFormat) });
  results[spec.name] = {
    tools: spec.tools.length,
    tokens: countTokens(serialized),
    bytes: Buffer.byteLength(serialized),  // fallback metric
  };
}

const total = { 
  tokens: Object.values(results).reduce((sum, r) => sum + r.tokens, 0),
  bytes: Object.values(results).reduce((sum, r) => sum + r.bytes, 0)
};

console.log(`Total (10 servers): ${total.tokens} tokens / ${total.bytes} bytes`);

// Write results to files
import { writeFileSync } from "node:fs";
writeFileSync(
  join(__dirname, "baseline-results.json"),
  JSON.stringify(results, null, 2)
);

// Also output total for easy access
writeFileSync(
  join(__dirname, "total-baseline.json"),
  JSON.stringify({ total }, null, 2)
);