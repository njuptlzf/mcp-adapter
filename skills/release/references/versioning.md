# Versioning reference

## Version format

```
<upstream-version>-0.0.<N>
```

- `<upstream-version>`: the upstream release this fork release is based on, read from `git show upstream/main:package.json`.
- `<N>`: fork release counter, monotonic **per upstream version**. Resets to `1` when `<upstream-version>` changes.
- Tag: `v` + full version, e.g. `v7.0.0-0.0.1`. Annotated (not lightweight) with a message describing the sync.

Why `-0.0.N`: the fork publishes to a different npm scope (`@njuptlzf/mcp-adapter`) and must never collide with upstream's `pi-mcp-adapter` versions. The suffix keeps fork releases sortable and visually tied to their upstream base.

## Determining the next version

1. Read upstream version: `git show upstream/main:package.json | node -e "...version"`.
2. Read current fork version: `node -p "require('./package.json').version"`.
3. If current version starts with `<upstream-version>-`, take trailing `N` and add 1.
4. Else (upstream version changed, or no fork suffix), use `<upstream-version>-0.0.1`.

Example transitions:
- `5.2.0-0.0.6` + sync to upstream `7.0.0` → `7.0.0-0.0.1` (upstream changed → reset).
- `7.0.0-0.0.1` + another fork fix on upstream `7.0.0` → `7.0.0-0.0.2`.

## Historical fork releases

| Fork tag | Based on upstream | Notes |
|---|---|---|
| `v2.29.0-0.0.1` … `v2.29.0-0.0.5` | 2.29.0 | early fork releases |
| `v5.2.0-0.0.6` | 5.2.0 | last release before v7 cutover |
| `v7.0.0-0.0.1` | 7.0.0 | codemode cutover #870, semantic search #909 |

Annotated tag example (from `v7.0.0-0.0.1`):
```
v7.0.0-0.0.1: fork sync with upstream v7.0.0 (69 commits, codemode cutover #870, semantic search #909)
```

## Tag / release mechanics

- The release workflow (`.github/workflows/release.yml`) triggers on **any** `v*` tag push (including annotated tags).
- It runs on `ubuntu-latest`, Node 20, and requires repo secret `NPM_TOKEN` (publish rights to `@njuptlzf` scope).
- Steps: `npm ci` → `build:public` (tsc) → `build:mcp-server` (esbuild) → `npm publish --access public --tag latest` → GitHub Release with `mcp-server.mjs` asset + generated notes.
- Upstream tags (`v7.0.0`, `v7.0.1`) live in the same repo because `git fetch upstream --tags` fetches them. Do not mistake them for fork releases — fork tags always carry the `-0.0.N` suffix.

## Version consistency (why it matters)

`bin/mcp-server.ts` previously hardcoded `SERVER_VERSION` while `package.json` was bumped, so `node mcp-server.mjs --version` reported a stale version. The fix injects the version from `package.json` at build time via esbuild `define` (`__SERVER_VERSION__`), with a dev fallback that reads `package.json`. Never reintroduce a second hardcoded literal. Always run the §5 consistency gate before tagging.
