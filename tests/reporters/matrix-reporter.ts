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
 * B1 fix (Phase 8): section classification used to dump 367 tests into
 * "Other" because the pattern list had no fallback granularity. We now
 * break "Other" into a small set of named sub-categories (auth, ui,
 * sampling, adapter, mock, host) and emit a drill-down list of
 * unclassified files in the report footer so future drift is visible.
 *
 * Threat-model notes (T-07-12): output paths are HARDCODED (no user
 * input, no path traversal); mkdirSync with recursive: true is idempotent.
 */
import type { Reporter, TestModule, TestRunEndReason } from "vitest/reporters";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
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
 *
 * B1: the bottom half of this function splits the former "Other"
 * bucket into named sub-sections so a 367-test single bucket becomes
 * reviewable sub-buckets. The very last fallback stays "Other" for
 * genuinely-unmatched files, and we list those in the report footer.
 */
function classifySectionFromPath(modulePath: string | undefined): string {
	const p = modulePath ?? "";
	// ---- Major sections (existing D-17 classification) ----
	if (/capability-gate/i.test(p)) return "Gate";
	if (/adapter-contract/i.test(p)) return "Section4-contract";
	if (/compatibility/i.test(p)) return "Section4";
	if (/interactive-visualizer/i.test(p)) return "Prebuild";
	if (/proxy-modes/i.test(p)) return "Section6-proxy";
	if (/direct-tools|e2e-direct-tools/i.test(p)) return "Section6-directTools";
	if (/e2e-all-servers|smoke/i.test(p)) return "Section6-E2E";
	if (/qoder-adapter-integration/i.test(p)) return "Section6-QoderIntegration";
	if (/token-benchmark/i.test(p)) return "Section5";

	// ---- B1 fine-grained sub-categories (Phase 8) ----
	// Auth, OAuth, consent, panel auth — all `mcp-auth*` / `oauth*` / `consent*` / `mcp-panel*` /
	// `mcp-callback-server*` / `server-manager-http-auth`
	if (
		/mcp-auth|auth-flow|auth-storage|mcp-oauth|oauth-handler|consent-manager|server-manager-http-auth|mcp-panel|mcp-callback-server/i.test(
			p,
		)
	) {
		return "Section6-auth";
	}
	// UI surface — `ui-*` files, host HTML template, glimpse, renderers
	if (
		/(^|\/)ui-|host-html-template|glimpse-ui|tool-result-renderer|pi-renderer|interactive-visualizer-server/i.test(
			p,
		)
	) {
		return "Section6-ui";
	}
	// Sampling
	if (/sampling-provider|sampling-handler|server-manager-sampling/i.test(p)) {
		return "Section6-sampling";
	}
	// Single-adapter unit tests
	if (/pi-adapter|qoder-adapter\.test|kilo-adapter/i.test(p)) return "Section6-adapter";
	// Mock contract baseline
	if (/mock-adapter/i.test(p)) return "Section6-mock";
	// Host & lifecycle — paths, onboarding, init, lifecycle, errors, logger,
	// package-manifest, cli, config, commands, elicitation, integration,
	// agent-dir-paths
	if (
		/agent-paths|npx-resolver|onboarding|init-elicitation|index-lifecycle|(^|\/)entry\.|errors\.|logger\.|package-manifest|cli\.|config\.|commands-|elicitation-handler|(^|\/)integration\.|agent-dir-paths/i.test(
			p,
		)
	) {
		return "Section6-host";
	}

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
	// Single-adapter unit/integration test files (Phase 8: includes
	// `qoder-adapter.test.ts` / `pi-adapter.test.ts` which are NOT
	// `qoder-adapter-integration.test.ts`)
	if (/qoder-adapter|qoder-sampling-provider/i.test(p)) return "qoder";
	if (/pi-adapter|pi-sampling-provider|pi-renderer/i.test(p)) return "pi";
	if (/kilo-adapter|kilo-/i.test(p)) return "kilo";
	// Cross-adapter / contract / compatibility
	if (/capability-gate|adapter-contract|compatibility/i.test(p)) return "env";
	return "env";
}

export default class MatrixReporter implements Reporter {
	private rows = new Map<string, MatrixRow>();
	/**
	 * B1: track the set of test files that fell through to the "Other"
	 * section so the report footer can list them (drift visibility).
	 * Keyed by file basename to keep the list short.
	 */
	private otherFiles = new Set<string>();

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
		// B1: capture unclassified files for the report footer
		if (section === "Other" && modulePath) {
			this.otherFiles.add(basename(modulePath));
		}
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
			// B1: include the unclassified-files list in the JSON sidecar
			// so dashboards can alert when drift grows.
			unclassifiedFiles: [...this.otherFiles].sort(),
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

		// B1: footer — list unclassified files so drift is visible
		if (this.otherFiles.size > 0) {
			md.push("## Unclassified files (B1 drift visibility)");
			md.push("");
			md.push(
				"These test files fell through to the `Other` section because no pattern in",
			);
			md.push(
				"`tests/reporters/matrix-reporter.ts > classifySectionFromPath` matched them.",
			);
			md.push(
				"Add a new pattern when a new test domain is introduced; otherwise this list should stay small.",
			);
			md.push("");
			for (const f of [...this.otherFiles].sort()) {
				md.push(`- \`${f}\``);
			}
			md.push("");
		}

		writeFileSync(REPORT_MD, md.join("\n"), "utf-8");
	}
}

