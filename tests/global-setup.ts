/**
 * vitest globalSetup — runs ONCE before any test worker starts.
 *
 * Per D-14 / FIX-01: if examples/interactive-visualizer/dist/{app.html,server.js}
 * is missing, run `npm run build` in that subdir so the
 * `__tests__/interactive-visualizer-server.test.ts` cases (which readFileSync
 * those paths) don't fail on a fresh clone.
 *
 * Trust boundary (T-07-05): `npm run build` is the same script a developer
 * would run manually. The visualizer's package.json + scripts/build.mjs are
 * the trust anchor; if those are compromised, the build is compromised.
 * Lockfile pins them at install time.
 *
 * NOTE (deviation, see SUMMARY §Deviations): vitest 3.2.6 has a known SSR
 * race condition when `globalSetup` runs any non-trivial work (a child
 * process or async build). The symptom is `Unhandled Error: ENOENT: mkdir
 * '/tmp/<random>/ssr'` from `coverage.DfSpMS-b.js:2471:5` after globalSetup
 * completes. To work around this, the `test:prebuild` npm script (D-14,
 * chained into the `test` script) is the primary build mechanism. Running
 * `npm test` (which CI does) always succeeds. Running `npx vitest run`
 * directly against the visualizer test requires either: (a) prebuild via
 * `npm run test:prebuild` first, or (b) accepting the vitest SSR race in
 * this specific environment. The race will likely be fixed in a future
 * vitest version; this globalSetup is registered per the plan so that the
 * safety net works as soon as the upstream bug is resolved.
 */
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VISUALIZER_DIR = resolve(PROJECT_ROOT, "examples/interactive-visualizer");
const DIST_DIR = resolve(VISUALIZER_DIR, "dist");
const APP_HTML = resolve(DIST_DIR, "app.html");
const SERVER_JS = resolve(DIST_DIR, "server.js");

export default function setup(): void {
	if (existsSync(APP_HTML) && existsSync(SERVER_JS)) {
		return; // Already built; nothing to do
	}
	console.log("[globalSetup] dist/ missing — running prebuild…");
	const r = spawnSync("npm", ["run", "build"], {
		cwd: VISUALIZER_DIR,
		stdio: "inherit",
	});
	if (r.status !== 0) {
		throw new Error(`prebuild failed (exit ${r.status}); see output above`);
	}
}
