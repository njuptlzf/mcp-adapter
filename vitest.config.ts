import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["__tests__/**/*.test.ts"],
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
			},
		},
	},
});
