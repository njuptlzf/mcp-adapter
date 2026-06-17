/**
 * MatrixReporter — vitest custom Reporter that writes an agent × section
 * matrix report at the end of every test run.
 *
 * Per D-16 / D-17 (Phase 7):
 *   - Writes tests/reports/mcp-adapter-test-report.md (human-readable)
 *   - Writes tests/reports/mcp-adapter-test-report.json (CI / dashboard sidecar)
 *
 * Hook selection (vitest 3.2.6):
 *   - onTestModuleEnd(testModule) — fires once per test file. We walk
 *     testModule.children.allTests() to bucket pass/fail/skipped counts
 *     per (agent, section) cell. Section is derived from the file path;
 *     agent is derived from the test's fullName (e.g. "adapter: pi").
 *   - onTestRunEnd(testModules, unhandledErrors, reason) — fires once at
 *     the end. We write both report files. (Avoids work in onInit which
 *     would hit the same vitest 3.2.6 SSR race that Plan 07-02 hit with
 *     globalSetup.)
 *
 * Threat-model notes (T-07-12): output paths are HARDCODED (no user
 * input, no path traversal); mkdirSync with recursive: true is idempotent.
 */
import type { Reporter, TestModule, TestRunEndReason } from "vitest/reporters";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface MatrixRow {
	agent: string;
	section: string;
	pass: number;
	fail: number;
	skipped: number;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPORT_DIR = resolve(PROJECT_ROOT, "tests", "reports");
const REPORT_MD = resolve(REPORT_DIR, "mcp-adapter-test-report.md");
const REPORT_JSON = resolve(REPORT_DIR, "mcp-adapter-test-report.json");

/**
 * Classify a test file into a SKILL.md section id by matching its
 * moduleId (file path). Order matters: more specific patterns first.
 */
function classifySectionFromPath(modulePath: string | undefined): string {
	const p = modulePath ?? "";
	if (/capability-gate/i.test(p)) return "Gate";
	if (/adapter-contract/i.test(p)) return "Section4-contract";
	if (/compatibility/i.test(p)) return "Section4";
	if (/interactive-visualizer/i.test(p)) return "Prebuild";
	if (/proxy-modes/i.test(p)) return "Section6-proxy";
	if (/direct-tools/i.test(p)) return "Section6-directTools";
	if (/e2e-all-servers|smoke/i.test(p)) return "Section6-E2E";
	if (/qoder-adapter-integration/i.test(p)) return "Section6-QoderIntegration";
	if (/token-benchmark/i.test(p)) return "Section5";
	return "Other";
}

/**
 * Classify an agent from a test's fullName. Looks for the describe.each
 * interpolation pattern ("adapter: <id>") set by Plan 07-01's parametric
 * framework. Falls back to the file path for tests that don't have a
 * per-adapter describe (e.g. smoke tests run once, agent-agnostic).
 */
function classifyAgentFromTest(
	fullName: string,
	modulePath: string | undefined,
): string {
	const m = fullName.match(/adapter:\s*([a-z][a-z0-9-]*)/i);
	if (m) return m[1];
	const p = modulePath ?? "";
	if (/qoder-adapter-integration|qoder-adapter/i.test(p)) return "qoder";
	if (/capability-gate|adapter-contract|compatibility/i.test(p)) return "env";
	return "env";
}

export default class MatrixReporter implements Reporter {
	private rows = new Map<string, MatrixRow>();

	private bucketKey(agent: string, section: string): string {
		return `${agent}::${section}`;
	}

	private bump(
		agent: string,
		section: string,
		kind: "pass" | "fail" | "skipped",
	): void {
		const key = this.bucketKey(agent, section);
		let row = this.rows.get(key);
		if (!row) {
			row = { agent, section, pass: 0, fail: 0, skipped: 0 };
			this.rows.set(key, row);
		}
		row[kind] += 1;
	}

	private classifyTest(
		fullName: string,
		modulePath: string | undefined,
		state: "passed" | "failed" | "skipped" | "pending",
	): void {
		const section = classifySectionFromPath(modulePath);
		const agent = classifyAgentFromTest(fullName, modulePath);
		if (state === "failed") this.bump(agent, section, "fail");
		else if (state === "skipped" || state === "pending") this.bump(agent, section, "skipped");
		else this.bump(agent, section, "pass");
	}

	onTestModuleEnd(testModule: TestModule): void {
		const modulePath = testModule.moduleId;
		// Walk every test case in this module, including those inside nested
		// describe blocks. allTests() recurses into suites; tests() does not.
		const allTests = testModule.children.allTests();
		for (const test of allTests) {
			const result = test.result();
			this.classifyTest(test.fullName, modulePath, result.state);
		}
	}

	onTestRunEnd(
		_testModules: ReadonlyArray<TestModule>,
		_unhandledErrors: ReadonlyArray<unknown>,
		reason: TestRunEndReason,
	): void {
		mkdirSync(REPORT_DIR, { recursive: true });

		const rows = [...this.rows.values()].sort((a, b) => {
			if (a.agent !== b.agent) return a.agent.localeCompare(b.agent);
			return a.section.localeCompare(b.section);
		});

		// ---- JSON sidecar ----
		const generatedAt = new Date().toISOString();
		const jsonPayload = {
			generatedAt,
			endReason: reason,
			rows,
		};
		writeFileSync(REPORT_JSON, JSON.stringify(jsonPayload, null, 2), "utf-8");

		// ---- Markdown matrix ----
		const md: string[] = [];
		md.push("# mcp-adapter Test Report — agent × section matrix");
		md.push("");
		md.push(`Generated: ${generatedAt}`);
		md.push(`End reason: ${reason}`);
		md.push("");
		md.push("## Summary matrix");
		md.push("");
		md.push("| Agent | Section | Pass | Fail | Skipped |");
		md.push("|-------|---------|------|------|---------|");
		for (const r of rows) {
			md.push(`| ${r.agent} | ${r.section} | ${r.pass} | ${r.fail} | ${r.skipped} |`);
		}
		md.push("");
		md.push("## Per-agent detail");
		md.push("");
		const byAgent = new Map<string, MatrixRow[]>();
		for (const r of rows) {
			const list = byAgent.get(r.agent) ?? [];
			list.push(r);
			byAgent.set(r.agent, list);
		}
		for (const [agent, agentRows] of byAgent) {
			md.push(`### ${agent}`);
			md.push("");
			for (const r of agentRows) {
				const total = r.pass + r.fail + r.skipped;
				md.push(
					`- **${r.section}**: ${r.pass}/${total} pass (${r.fail} fail, ${r.skipped} skipped)`,
				);
			}
			md.push("");
		}
		writeFileSync(REPORT_MD, md.join("\n"), "utf-8");
	}
}
