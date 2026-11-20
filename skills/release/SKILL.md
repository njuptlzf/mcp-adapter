---
name: release
description: >
  Fork-maintainer workflow for publishing a release of njuptlzf/mcp-adapter after an
  upstream merge. Bumps the fork version to `<upstream-version>-0.0.N`, updates the
  release docs it owns (CHANGELOG.md release section + README.md fork-version line
  and prebuilt-bundle download URL), verifies version consistency
  (package.json == CLI == tag), creates an annotated
  `v<version>` tag and pushes it to trigger `.github/workflows/release.yml`
  (npm publish + GitHub Release with the mcp-server.mjs asset). Invoked as the final
  optional step of the `upstream-merge` skill, and directly when the user says
  "release", "publish", "bump version", "tag a release", or "cut a release" for this
  fork. Decides first whether a release is warranted — not every merge ships one.
---

# Release (fork release after upstream merge)

Publishes `njuptlzf/mcp-adapter` to npm and GitHub Releases. The release is triggered
**only by pushing a `v*` tag** (`.github/workflows/release.yml`) — there is no manual
publish step in this flow. This skill is the last, optional step of the
`upstream-merge` workflow; it is also usable on its own.

## When to invoke

- Called by `upstream-merge` §5.6 after the merge PR is on `main` and local `main` is synced.
- Directly when the user asks to release / publish / bump the version / tag this fork.

## Decision: does this merge warrant a release?

Do **not** release on every upstream merge. Release when the fork's published surface
actually changed. Check `git log <last-fork-tag>..main --oneline` and release if any apply:

- a fork-only change shipped (adapter, skill, config, version-dependent fix), or
- an upstream sync that changes published behavior and should be made installable, or
- a bug fix users need (e.g. the `ext-apps` devDependency fix in `f39a7a0`).

Skip the release if the merge is docs/meta-only with no runtime or packaging change.
If unsure, ask the user — publishing is an external, hard-to-undo action.

## Version scheme

Fork version = `<upstream-version>-0.0.<N>`:

- `<upstream-version>` = the version just synced from upstream (from `upstream/main:package.json`).
- `<N>` = fork release counter, increments per fork release against the **same** upstream version; resets to `1` when the upstream version changes.
- Examples: `5.2.0-0.0.6` (6th fork release on upstream 5.2.0), `7.0.0-0.0.1` (1st on 7.0.0).
- Tag = `v` + full version, e.g. `v7.0.0-0.0.1` (annotated tag with a descriptive message).
- Upstream's own tags (`v7.0.0`, `v7.0.1`) and fork tags coexist — do not confuse them.

Full conventions and historical examples: [references/versioning.md](references/versioning.md).

## Release workflow

Copy this checklist and track progress:

```
Release <version>:
- [ ] Step 1: Decide release-worthy (log since last fork tag)
- [ ] Step 2: Determine next version from upstream version + fork counter
- [ ] Step 3: On a release feature branch, bump package.json version (and sync package-lock.json)
- [ ] Step 4: Update docs — CHANGELOG.md fork release section + README version line + prebuilt-bundle download link
- [ ] Step 5: Verify version consistency (package.json == CLI == intended tag)
- [ ] Step 6: Commit + PR (HARD RULE: never commit to main directly), merge with --admin --squash
- [ ] Step 7: Create annotated tag on main's merge commit, push tag to trigger release.yml
- [ ] Step 8: Verify CI release run + GitHub Release + npm package
```

### Step 1–2: Decide and version

```bash
git fetch upstream --tags && git fetch origin --tags   # proxy per upstream-merge §2 if needed
LAST_FORK_TAG=$(git tag --list 'v*-0.0.*' --sort=-v:refname | head -1)
git log "$LAST_FORK_TAG"..main --oneline
UPSTREAM_VER=$(git show upstream/main:package.json | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).version)")
node -p "require('./package.json').version"   # current fork version
```

Derive `<N>`: if the current fork version already starts with `<upstream-version>-`, increment its trailing `N`; otherwise start at `1`.

### Step 3: Bump version

Edit `package.json` `version` to the new full version. Sync `package-lock.json` so its two `version` fields match:

```bash
npm install --package-lock-only --ignore-scripts
node -e "const p=require('./package.json'),l=require('./package-lock.json'); console.log(p.version, l.version, l.packages[''].version)"
```

Create a feature branch first (`chore/release-<version>`) — never bump on `main` directly.

### Step 4: Update docs (CHANGELOG + README)

The release skill owns these two docs — update both before tagging.

**CHANGELOG.md**: add a `## [<version>] - YYYY-MM-DD` section at the top listing the fork changes since `LAST_FORK_TAG`. Follow the Keep a Changelog format already used in the file; link to the upstream version being synced. Group under `Added` / `Changed` / `Fixed`.

**README.md** has **two** fork-owned version spots to update (both stale URLs are user-facing — a missed one installs an old build or 404s):

1. The "What this fork changes" fork-version line:

```markdown
- **Repackaged as `@njuptlzf/mcp-adapter`** — org-scoped npm package, currently `7.0.1-0.0.1` (tracks upstream `v7.0.1`).
```

2. The `### Prebuilt bundle — no npm, run with node` section under Install (added in PR #42) hardcodes the download link and its comment:

```bash
# Current release (7.0.1-0.0.1)
curl -fL -o /home/lib/mcp-server/mcp-server.mjs \
  https://github.com/njuptlzf/mcp-adapter/releases/download/v7.0.1-0.0.1/mcp-server.mjs
```

Refresh all three values in one pass, derived from the files you just bumped — never hardcode the new version by hand:

```bash
NEW="$(node -p "require('./package.json').version")"
UP="$(git show upstream/main:package.json | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).version)")"
node -e '
const fs = require("fs");
const [v, up] = process.argv.slice(1);
let s = fs.readFileSync("README.md", "utf8");
s = s.replace(/(currently `)[^`]+(` \(tracks upstream `v)[^`]+(`\))/, `$1${v}$2${up}$3`);
s = s.replace(/# Current release \([^)]*\)/, `# Current release (${v})`);
s = s.replace(/releases\/download\/v[^/\s)]+\/mcp-server\.mjs/, `releases/download/v${v}/mcp-server.mjs`);
fs.writeFileSync("README.md", s);
' "$NEW" "$UP"
```

Verify every spot now carries the new version:

```bash
grep -nE 'currently `|Current release|releases/download/v' README.md
# all three lines must show <version> (and v<upstream-version> on the fork line)
grep -nE '[0-9]+\.[0-9]+\.[0-9]+(-0\.0\.[0-9]+)?' README.md | head -20
```

The pinned download URL will 404 until Step 7 pushes the tag — that is expected; it is created by `release.yml`, not by this commit. Do not flag it as a broken link during the PR.

Do not blindly touch upstream-owned sections (comparison tables, docs links, the npx/Pi install instructions) — only the two fork-owned spots above. If the merge left duplicate headings (e.g. repeated `## What's new in 7.0`), flag them to the user as a cleanup item rather than silently rewriting upstream framing.

### Step 5: Version consistency gate (mandatory)

The fork had a real bug where `bin/mcp-server.ts` hardcoding drifted from `package.json` (see upstream-merge §5(f)). Verify all three agree:

```bash
npm run build:mcp-server
echo "pkg: $(node -p "require('./package.json').version")"
echo "cli: $(node mcp-server.mjs --version | head -1)"
# pkg and cli MUST be identical and equal the intended <version>
```

If they differ, stop — fix the injection (esbuild `define`), never add a second hardcoded literal.

### Step 6: PR (HARD RULE)

```bash
git add package.json package-lock.json CHANGELOG.md README.md
git commit -m "chore(release): <version>"
git push -u origin chore/release-<version>
gh pr create --repo njuptlzf/mcp-adapter --base main --head chore/release-<version> \
  --title "chore(release): <version>" --body "<changelog excerpt>"
gh pr checks <PR#> --repo njuptlzf/mcp-adapter --watch
gh pr merge <PR#> --repo njuptlzf/mcp-adapter --admin --squash --delete-branch
```

Then sync local `main` (retry the fetch once on a transient 502 — upstream-merge §2):

```bash
git checkout main
git -c http.proxy="$https_proxy" -c https.proxy="$https_proxy" fetch origin
git merge --ff-only origin/main
git branch -d chore/release-<version>
```

### Step 7: Tag and push (triggers release)

Tag the **squash commit on main**, not the feature branch. Always use an annotated tag with a descriptive message:

```bash
git tag -a "v<version>" -m "v<version>: fork release on upstream <upstream-version> (<summary>)"
git tag -n1 -l "v<version>"                 # verify annotated message
git push origin "v<version>"                # pushes tag -> triggers release.yml
```

This push is the publish action — it runs `npm publish --access public --tag latest` and creates a GitHub Release with `mcp-server.mjs` attached. Requires repo secret `NPM_TOKEN`.

### Step 8: Verify publication

```bash
gh run list --repo njuptlzf/mcp-adapter --workflow=Release --limit 3
gh run view <run-id> --repo njuptlzf/mcp-adapter     # wait for success
gh release view "v<version>" --repo njuptlzf/mcp-adapter
npm view @njuptlzf/mcp-adapter@<version> version     # confirm npm published
curl -fsSI "https://github.com/njuptlzf/mcp-adapter/releases/download/v<version>/mcp-server.mjs" | head -1  # link in README now resolves
```

If the release run fails, fix on a new branch + PR — do NOT delete and re-push a tag already published to npm (tags are immutable downstream). Report the failing run URL to the user.

## Cross-references

- `skills/upstream-merge/SKILL.md` §5(f) version consistency, §5.5 PR flow, §2 proxy workaround.
- `.github/workflows/release.yml` — the tag-triggered publish pipeline.
- `references/versioning.md` — version scheme details and historical release table.
- `README.md` — fork-owned version spots: "What this fork changes" line + `### Prebuilt bundle` download comment/URL (both refreshed in Step 4).
