import { vi } from "vitest";

// Cross-platform test shim: tests redirect `process.env.HOME` to a temp dir to
// isolate config paths, but Node's `os.homedir()` on Windows reads USERPROFILE
// and ignores `$HOME`, so every HOME-redirected fixture is silently missed and
// dozens of config/cli tests fail on Windows only. Patch `homedir()` to honor
// `$HOME`, falling back to the real homedir when unset. No-op on POSIX (where
// os.homedir already honors HOME).
vi.mock("node:os", async (importOriginal) => {
	const os = await importOriginal<typeof import("node:os")>();
	return {
		...os,
		homedir: () => process.env.HOME || os.homedir(),
	};
});