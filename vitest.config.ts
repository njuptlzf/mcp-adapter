import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["__tests__/**/*.test.ts", "tests/**/*.test.ts"],
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
				"interfaces/agent-api.ts",
			],
			reporter: ["text", "html", "json"],
			thresholds: {
				"interfaces/agent-paths.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
				"adapters/pi-adapter.ts": {
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
				"adapters/pi-sampling-provider.ts": {
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
				"adapters/entry.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
				// Phase 06 — Second Agent Adapter (qoder)
				"adapters/qoder-adapter.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
				"adapters/qoder-sampling-provider.ts": {
					lines: 80,
					functions: 80,
					branches: 80,
					statements: 80,
				},
				// qoder-renderer.ts is a thin pass-through placeholder per D-11.
				// It has effectively no logic to cover (T-06-R-02 disposition).
				"adapters/qoder-renderer.ts": {
					lines: 60,
					functions: 60,
					branches: 60,
					statements: 60,
				},
				// scripts/qoder-smoke.ts is a CLI smoke harness — exercised
				// manually, not via vitest. Track coverage but at a permissive
				// floor since no automated test invokes it.
				"scripts/qoder-smoke.ts": {
					lines: 60,
					functions: 60,
					branches: 60,
					statements: 60,
				},
			},
		},
	},
});