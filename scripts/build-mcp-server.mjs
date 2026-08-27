import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

// Re-expose `require` inside the ESM bundle. Several bundled CommonJS deps
// (e.g. cross-spawn) perform a runtime `require("child_process")` that plain
// `--format=esm` output cannot satisfy; `createRequire` makes that legal.
const requireShim =
  "import { createRequire as __bannerRequire } from 'node:module'; const require = __bannerRequire(import.meta.url);";

const result = await build({
  entryPoints: ["bin/mcp-server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: true,
  banner: { js: requireShim },
  outfile: "mcp-server.mjs",
  logLevel: "info",
});

if (result.errors.length > 0) {
  process.exit(1);
}

// esbuild preserves the entry file's `#!/usr/bin/env npx tsx` shebang, which
// is wrong for a self-contained bundle: consumers run it via `node`, not tsx.
let output = readFileSync("mcp-server.mjs", "utf8");
output = output.replace(/^#![^\n]*\n/, "#!/usr/bin/env node\n");
writeFileSync("mcp-server.mjs", output);

console.log("built mcp-server.mjs");