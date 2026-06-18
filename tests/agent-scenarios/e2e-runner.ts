import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCENARIOS = [
  { id: "E2E-01", trigger: "run compat tests",         agent: "mcp-compat-tester",     required: true,  timeout: 120_000 },
  { id: "E2E-02", trigger: "benchmark tokens",          agent: "token-benchmark-runner", required: true,  timeout: 120_000 },
  { id: "E2E-03", trigger: "smoke test calculator",     agent: "e2e-smoke-tester",     required: true,  timeout: 120_000 },
  { id: "E2E-04", trigger: "smoke test all",            agent: "e2e-smoke-tester",     required: true, timeout: 300_000 },
  { id: "E2E-05", trigger: "test direct tools mode",    agent: "direct-tools-tester",  required: true, timeout: 120_000 },
  { id: "E2E-06", trigger: "multi-turn test",           agent: "multi-turn-tester",    required: false, timeout: 180_000 },
];

const REPORTS_DIR = join(__dirname, "../reports");
if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

const QODER_FLAGS = "-p --dangerously-skip-permissions";
const results: { id: string; pass: boolean; required: boolean; output: string }[] = [];

for (const s of SCENARIOS) {
  const cmd = `qodercli ${QODER_FLAGS} "${s.trigger}" 2>&1`;
  console.log(`\n▶ ${s.id}: ${cmd}`);
  try {
    const output = execSync(cmd, {
      cwd: __dirname,
      timeout: s.timeout,
      encoding: "utf8",
    });
    const pass = output.length > 30;
    results.push({ id: s.id, pass, required: s.required, output: output.slice(-300) });
    console.log(`${pass ? "✅" : "❌"} ${s.id}`);
    if (!pass && s.required) process.exitCode = 1;
  } catch (err: unknown) {
    const e = err as any;
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    const msg = out.slice(-300) || (err instanceof Error ? err.message : String(err));
    results.push({ id: s.id, pass: false, required: s.required, output: msg });
    console.error(`❌ ${s.id} (${s.required ? "REQUIRED" : "optional"})`);
    if (s.required) process.exitCode = 1;
  }
}

const summaryRows = results
  .map(r => `| ${r.id} | ${r.pass ? "✅ PASS" : "❌ FAIL"} | ${r.required ? "required" : "optional"} |`)
  .join("\n");

const summary = `# E2E Summary\n\n| Scenario | Result | Type |\n|----------|--------|------|\n${summaryRows}\n\n> Run with: qodercli -p --dangerously-skip-permissions "<trigger>"\n`;
writeFileSync(join(REPORTS_DIR, "e2e-summary.md"), summary);
console.log("\nReport → tests/reports/e2e-summary.md");