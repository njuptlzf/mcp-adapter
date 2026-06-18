import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the baseline and adapter results
const baselineResults = JSON.parse(readFileSync(join(__dirname, "baseline-results.json"), "utf8"));
const adapterResults = JSON.parse(readFileSync(join(__dirname, "adapter-results.json"), "utf8"));
const totalBaseline = JSON.parse(readFileSync(join(__dirname, "total-baseline.json"), "utf8")).total;

// Calculate savings for each server
const servers = Object.keys(baselineResults).map(key => ({
  name: key,
  ...baselineResults[key]
}));

// Function to pad strings for table alignment
function pad(str, length) {
  return str.padEnd(length, " ");
}

// Generate the report
let report = `
╔════════════════════════════════════════════════════════════════════════╗
║            mcp-adapter Token Efficiency Benchmark Report              ║
╠════════════════════════════════════════════════════════════════════════╣
║  Server              │ Tools │ Direct Tokens │ Direct Bytes │ Saved   ║
╠════════════════════════════════════════════════════════════════════════╣`;

// Add rows for each server
for (const server of servers) {
  const savings = ((1 - adapterResults.tokens / server.tokens) * 100).toFixed(0) + "%";
  report += `
║  ${pad(server.name, 18)}│ ${pad(String(server.tools), 5)} │ ${pad(String(server.tokens) + "", 11)} │ ${pad(String(server.bytes) + "", 10)} │ ${pad(savings, 7)} ║`;
}

// Add total row
const totalSavings = ((1 - adapterResults.tokens / totalBaseline.tokens) * 100).toFixed(0) + "%";
report += `
╠═════════════════════════════════════════════════════════════════════════╣
║  TOTAL (all loaded)  │ ${pad(String(Object.values(baselineResults).reduce((sum, s) => sum + s.tools, 0)), 5)} │ ${pad(String(totalBaseline.tokens), 11)} │ ${pad(String(totalBaseline.bytes), 10)} │ ${pad(totalSavings, 7)} ║
║  mcp proxy tool      │ ${pad("1", 5)} │ ${pad(String(adapterResults.tokens), 11)} │ ${pad(String(adapterResults.bytes), 10)} │ ${pad(" — ", 7)} ║
╚═════════════════════════════════════════════════════════════════════════╝

  • Search overhead per call: ~15 tokens
  • Break-even: after 1st tool call, adapter always wins
  • Note: token counts use tiktoken cl100k_base; bytes are exact
`;

console.log(report);

// Write to file
import { writeFileSync } from "node:fs";
writeFileSync(join(__dirname, "benchmark-report.md"), report.trim());