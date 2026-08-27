import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		env: {
			PI_MCP_ADAPTER_TEST_AUTH_STORE: "memory",
			// Cache tests opt in explicitly to keep existing tests platform-neutral.
			PI_MCP_ADAPTER_DISABLE_AUTH_CACHE: "1",
		},
		include: ["__tests__/**/*.test.ts", "tests/**/*.test.ts"],
		// Plan 07-04: matrix reporter added (D-17) — writes agent × section
		// matrix to tests/reports/mcp-adapter-test-report.{md,json} on test run end.
		// 07-02 deviation note: globalSetup was REMOVED due to a vitest 3.2.6
		// SSR race; the matrix reporter does its work in onTestRunEnd to avoid
		// that same race. See tests/reporters/matrix-reporter.ts.
		reporters: ["default", "./tests/reporters/matrix-reporter.ts"],
		coverage: {
			provider: "v8",
			include: ["*.ts", "interfaces/**/*.ts", "adapters/**/*.ts"],
			exclude: [
				"__tests__/**",
				"vitest.config.ts",
				"cli.js",
				"app-bridge.bundle.js",
				"host-html-template.ts",
				"glimpse-ui.ts",
			],
			reporter: ["text", "html", "json"],
			thresholds: {
				"interfaces/agent-paths.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
				"interfaces/sampling.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
				"adapters/pi-renderer.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
			},
		},
	},
});