# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0-universal] - 2026-07-01

> Fork release of upstream `v3.0.0` + governance improvements. See `.planning/milestones/v3.1-MILESTONE-AUDIT.md` for full audit.

### Added

- **`skills/upstream-merge/SKILL.md` §3.5 "Conflict hunk independence check"** — classifies each conflict hunk into 4 categories (different function / same function different section / same function same section / import region) with awk-based function-extraction script. Replaces the "merge by reading 11 conflict files manually" workflow.
- **`skills/upstream-merge/SKILL.md` §4.4 "Same-function conflict resolution protocol"** — mandatory 5-step protocol for same-function conflicts: extract ours/theirs → view function context → classify merge mode (append/replace/wrap) → document decision in commit body. Empirical reference: commands.ts 3 hunks (append mode) + index.ts mcpAdapter 343-line hunk (replace mode).
- **`skills/upstream-merge/SKILL.md` §6 "Fork architecture principles"** — 5 future-proofing rules for new fork-only code (new adapter → new file, new test → new file, new abstract type → extend interfaces/agent-api.ts, new universal helper → new file, new fork-only doc → new file). Replaces the previous "modify upstream files" anti-pattern.
- **`.github/workflows/check-pi-coupling.yml`** (CI-01) — GitHub Actions workflow that runs on every PR to main/v1.0. Detects `import .*@earendil-works/pi-` in `src/` core (excluding `adapters/`, `types/`, `__tests__/`). Advisory only (does not fail build) per §4.2b soft follow-up.
- **`.github/workflows/check-fork-only-ratio.yml`** (CI-03) — counts new files vs modified files in PR vs `origin/main`, computes modify-to-new ratio. Target ≤ 2.0 (WARN at >2.0, FAIL at >5.0). Implements SKILL.md §6.4 pre-commit guardrail.
- **`scripts/upstream-divergence.ts --json` mode** (CI-02) — emits JSON Schema v1.0 with fields `upstream_ref`, `diverged_count`, `registered`, `diverged_but_not_registered`, `stale`, `default_resolved_by_category`, `exit_code`, `hunk_independence_note`, `schema_version`, `schema_documented_in`. Full schema in `docs/upstream-merge-retrospective.md` §13.
- **`docs/upstream-merge-retrospective.md`** (938 lines) — multi-perspective reflection (架构师/资深开发者/QA/PM) on the first real `git merge upstream/main` attempt (2026-07-01) that produced 11 conflict files. Includes:
  - §1.3 4-category conflict analysis (33% import-region + 27% same-function + 9% same-function-body-large + 37% same-file different-section)
  - §2 4-question Q&A (合并原则 / 同文件不同函数 / 同函数冲突 / 冲突根因)
  - §3.2.1 L1/L2/L3 decision matrix (9 REPLACEMENTS + 8 ADDITIONS + ~10 TESTS)
  - §3.3 P0/P1/P2 roadmap
  - §12 L2 ADDITIONS per-file analysis (8 files, 0 refactor needed)
  - §13 CI-02 JSON Schema v1.0 documentation

### Changed

- **`skills/upstream-merge/SKILL.md` §4.1** — `assess` row now reads "**Default `--theirs`** (prefer upstream improvements). §4.1 Pi-coupling marker grep is now **advisory** (was: 0 hits → `--theirs`; ≥1 hit → §4.2b follow-up flow). For same-function conflicts, follow §4.4 5-step protocol. **Strategy shift**: fork is downstream, not adversarial; accept upstream by default.
- **`skills/upstream-merge/SKILL.md` §4.2b** — reduced from 5-step mandatory follow-up flow to **2-step soft follow-up**. Step 1 (mandatory): `git checkout --theirs <path> && git add <path>`. Step 2 (best-effort, only if `gh` CLI authenticated): optionally open follow-up issue. "Removed from v1" rationale blockquote explains why steps 2-5 from the original 5-step flow were removed (Phase 13 §4.2b "soft follow-up" principle).
- **`skills/upstream-merge/SKILL.md` §5(b) Checklist** — Pi-coupling markers changed from "must be 0" (blocking) to "**advisory log** (no longer blocking; record hit count in commit body)". The only acceptable hits are inside `adapters/`, `types/`, or `__tests__/` (legal coupling zones).
- **`skills/upstream-merge/references/pi-coupling-markers.md`** "Blast radius if missed" callout — updated to reflect v3.1 advisory policy with cross-reference to retrospective §2.1.3.

### Removed

- **§4.2b 5-step follow-up flow** (replaced by 2-step soft) — steps "Stage a follow-up commit that refactors the Pi-coupling out", "Open a follow-up issue" (now optional), and "Reference the issue number in the merge commit body" removed from the mandatory path. Rationale: fork is downstream, not adversarial. The adapter layer (`adapters/pi-adapter.ts`) provides runtime isolation; Pi-coupling hits in core are now log-only.

### Migration

**For end users (agents using mcp-adapter)**: No migration required. v3.1.0-universal is a governance/refactor release; all public APIs (`mcpAdapter`, `piMcpAdapter`, `createMcpAdapter`, `createPiAdapter`, `createQoderAdapter`, `resolveAgentGlobalConfigPath`, `getAgentDir`) are unchanged.

**For maintainers merging upstream**:
1. Run `npm run upstream:check` (with new `--json` flag for CI) to see live divergence before merge
2. On conflict, run `awk`-based hunk independence check from SKILL.md §3.5 to classify hunks
3. For same-function conflicts, follow the 5-step protocol in §4.4
4. For Pi-coupling, accept `--theirs` by default (§4.1 change); log hit count in commit body

**For PR contributors**:
- GitHub Actions will run `check-pi-coupling.yml` (advisory) and `check-fork-only-ratio.yml` (WARN at >2.0, FAIL at >5.0)
- New fork-only code MUST follow SKILL.md §6.3 future-proofing rules (use new files, don't modify upstream files)

### Technical Debt Closed

- **ARCH-01 retired** — `index.ts` 343-line `mcpAdapter()` function body was the retrospective's stated target, but Phase 5 entry-point refactor had already made `index.ts` a 27-line thin wrapper. Real target was `adapters/entry.ts` `createMcpAdapter` (324 lines), now tracked as **ARCH-06**.
- **ARCH-02..04 mechanical decomposition deferred** — L2 per-file analysis (retrospective §12) showed 6/8 L2 files have NEGATIVE fork delta (Phase 12 already removed per-agent code); remaining +4 lines in `agent-dir.ts` not worth extracting. Closed via policy + docs + CI instead of code refactor.

### Cross-references

- `.planning/milestones/v3.1-MILESTONE-AUDIT.md` (108 lines) — full audit of v3.1
- `.planning/milestones/v3.1-ROADMAP.md` (101 lines) — v3.1 phases snapshot
- `.planning/milestones/v3.1-REQUIREMENTS.md` (188 lines) — v3.1 requirements archive
- `docs/upstream-merge-retrospective.md` (938 lines) — multi-perspective reflection
- `skills/upstream-merge/SKILL.md` (363 lines) — full protocol documentation
- Git tag: `v3.1.0-universal` (annotated, SHA `98ca50b`)

## [3.0.0-universal] - 2026-06-30 - Universal MCP Stdio Server

### Breaking Changes

- **`kilo-mcp-server` renamed to `mcp-server`** — no backward compatibility alias kept (D-10). Update any agent MCP config that references `kilo-mcp-server` to use `mcp-server` instead.
- **`qoder-mcp-bridge` deleted entirely** (D-04). The Qoder SDK bridge approach is removed. Use the universal `mcp-server` bin entry instead.
- **Per-agent adapters deleted** (D-04): `KiloAdapter`, `QoderAdapter`, `StoreAgentAdapter`, `QoderSamplingProvider`, `QoderRenderer` — all removed. The universal MCP stdio server replaces them.
- **`createKiloResolver` and `createQoderResolver` removed** from `interfaces/agent-paths.ts` (D-02). Use `createUniversalResolver()` instead, which returns `~/.config/mcp/mcp.json` as the global config path.

### Added

- **Universal MCP stdio server** (`bin/mcp-server.ts`) — agent-agnostic stdio server that speaks MCP protocol (D-05). Replaces the per-agent `kilo-mcp-server` and `qoder-mcp-bridge` entry points.
- **`ProtocolSamplingForwarder`** — implements `SamplingProvider` via MCP Server→Client `sampling/createMessage` reverse call (D-06). Injected when the connecting agent declares `sampling` capability.
- **`ProtocolElicitationForwarder`** — implements `UISystem.form` via MCP Server→Client `elicitation/create` reverse call (D-07). Injected when the connecting agent declares `elicitation.form` capability.
- **Runtime capability discovery** via `server.getClientCapabilities()` (D-11) — the server checks client-declared capabilities at connection time and injects forwarders accordingly. No config-based gating; pure forwarding (D-11).

### Changed

- **`AGENT_ADAPTERS` registry simplified** to 2 entries: `pi` (Branch A) and `universal-mcp` (Branch C). Kilo and Qoder entries removed (D-01).
- **Config path discovery universalized** (D-02): `--config` flag > `MCP_CONFIG_PATH` env > `.mcp.json` in cwd > `~/.config/mcp/mcp.json`. No agent-specific global paths (`~/.kilo/mcp.json`, `~/.qoder/agent/mcp.json` removed).
- **`package.json` bin** reduced from 3 entries to 2: `pi-mcp-adapter` + `mcp-server` (D-10).
- **`vitest.config.ts`** cleaned of coverage thresholds for deleted adapter files.

### Migration

1. **Replace `kilo-mcp-server` with `mcp-server`** in your agent's MCP config:
   ```json
   {
     "mcpServers": {
       "mcp-adapter": {
         "command": "mcp-server"
       }
     }
   }
   ```
2. **Remove any Qoder-specific bridge setup** — delete `qoder-mcp-bridge` references and SessionStart hooks. Use `mcp-server` instead.
3. **Config path is now universal**: `--config` > `MCP_CONFIG_PATH` > `.mcp.json` > `~/.config/mcp/mcp.json`. No agent-specific paths needed.

## [2.9.0] - 2026-06-04

### Added
- Added MCP elicitation support with Pi form prompts and browser-opening URL requests.

### Fixed
- Rejected non-http/https MCP URL elicitations before prompting or opening a browser.
- Preserved empty string form values for MCP string elicitations unless schema constraints reject them.

## [2.8.0] - 2026-05-25

### Added
- Added per-server OAuth `redirectUri`, `clientName`, and `clientUri` overrides for pre-registered callbacks and dynamic client metadata.

### Fixed
- Avoided OAuth callback port exhaustion by starting the callback server lazily and using OS-assigned ports for dynamic OAuth flows.
- Re-register dynamic OAuth clients before browser auth when cached redirect URI metadata is missing or no longer matches the active callback URI.

## [2.7.0] - 2026-05-22

### Added
- Added TUI call rendering for MCP proxy and direct tool inputs. Thanks @dmmulroy for PR #102.

### Fixed
- Hardened OAuth credential storage paths against server-name path traversal without rejecting valid configured server names.
- Rejected unsafe regex-mode MCP search patterns before executing them.

## [2.6.1] - 2026-05-13

### Added
- Added `/mcp logout <server>` to clear stored OAuth credentials and disconnect the server. Thanks @mattzcarey for PR #96.

### Fixed
- Cancel pending OAuth callbacks when logging out of an MCP server.

## [2.6.0] - 2026-05-10

### Added
- Added a no-argument `/mcp-auth` OAuth picker and in-panel auth shortcut for OAuth-capable MCP servers.
- Added compact collapsed rendering for MCP proxy and direct-tool result rows while keeping full tool results available when expanded.

### Changed
- Migrated Pi runtime dependencies and imports from deprecated `@mariozechner/*` packages to `@earendil-works/*` packages.

### Fixed
- Re-register dynamic OAuth clients during fresh auth when cached DCR client info exists without tokens, avoiding dead authorization URLs after server-side client invalidation.
- Kept OAuth tokens, dynamic client info, PKCE verifiers, and OAuth state bound to the server URL so stale credentials cannot be reused after a server URL changes.
- Kept the `/mcp-auth` OAuth picker search focused on OAuth server rows and prevented hidden panel shortcuts from unexpectedly launching auth.
- Kept long MCP error results expanded in compact tool result rendering.

## [2.5.4] - 2026-05-04

### Changed
- Ignored npm lockfiles and removed checked-in `package-lock.json` files.

### Fixed
- Resolved `${VAR}` and `$env:VAR` placeholders in HTTP bearer tokens.
- Honored MCP sampling `modelPreferences.hints` before falling back to the current/default model.

## [2.5.3] - 2026-05-01

### Added
- Added environment variable and `~` expansion for stdio server `cwd` values.

## [2.5.2] - 2026-04-29

### Fixed
- Respected `PI_CODING_AGENT_DIR` for Pi-owned MCP config and state files, including metadata cache, npx cache, onboarding state, OAuth credentials, and `pi-mcp-adapter init` writes.

## [2.5.1] - 2026-04-24

### Fixed
- Changed OAuth browser callbacks to `http://localhost:<port>/callback` for pre-registered clients such as Slack MCP. Thanks @shenal for PR #53.

## [2.5.0] - 2026-04-24

### Added
- Added MCP `sampling/createMessage` support with conservative human approval by default and opt-in `settings.samplingAutoApprove` for non-interactive flows.
- Added configured Vitest coverage for OAuth provider authorization fallback behavior.
- Added `test:oauth-provider` for running the root OAuth provider node test with the required TypeScript loader.

### Fixed
- Applied `settings.authRequiredMessage` to proxy and direct-tool auth-required paths, including non-UI `autoAuth` failures.
- Fixed `/mcp-auth <server>` reporting success for expired stored OAuth tokens without forcing the SDK refresh/re-auth flow.
- Kept `mcp` search focused on MCP tools and added a direct-call hint when native Pi tools are accidentally routed through the proxy.

## [2.4.2] - 2026-04-22

### Fixed
- Migrated extension tool schemas from `@sinclair/typebox` to `typebox` 1.x so packaged installs follow Pi's current extension runtime contract.

### Changed
- Replaced the legacy `@sinclair/typebox` runtime dependency with `typebox`.

## [2.4.1] - 2026-04-22

### Added
- Added standard-MCP-first config discovery: `~/.config/mcp/mcp.json` and project `.mcp.json` now load automatically, with Pi-owned files preserved as override layers.
- Added `pi-mcp-adapter init` as a native post-install helper that detects host-specific MCP configs and scaffolds Pi compatibility imports without using the old raw GitHub downloader flow.
- Added first-run onboarding inside the extension: `/mcp` now shows shared-config hints or actionable empty states, and `/mcp setup` opens a guided setup flow for compatibility imports, minimal `.mcp.json` scaffolding, detected config paths, RepoPrompt quick-add, and exact before/after write previews.
- Added automatic Pi-core reload after setup or direct-tool config changes, using the same flow as `/reload` so freshly configured direct tools can appear without a manual restart.
- Added a dedicated Pi-owned onboarding state file so shared-config hints behave as one-time guidance instead of repeating every session.

### Changed
- Updated config precedence to prefer shared MCP files first, then Pi overrides, with `.pi/mcp.json` acting as the final Pi-specific project override.
- Updated Claude Code compatibility probing to prefer modern Claude MCP config locations before legacy paths.
- Updated project scaffolding so generated `.mcp.json` files are safe minimal shells instead of fake placeholder servers that fail on first reload.
- Updated the setup panel and README for clearer first-run guidance, improved spacing, and a more digestible shared-MCP-first setup story.

## [2.4.0] - 2026-04-13

### Added
- `settings.disableProxyTool` to hide the `mcp` proxy tool once configured direct tools are fully available from cache. Thanks @tanavamsikrishna for PR #41.
- Per-server `excludeTools` to hide specific MCP tools/resources by original or prefixed name across direct tools, proxy discovery, and the `/mcp` panel. Thanks @ahmadaccino for issue #36.
- `settings.autoAuth` to optionally trigger OAuth automatically from proxy/direct tool usage, then rerun the original blocked connect/tool operation once after authentication succeeds. Thanks @unimonkiez for issue #34.

### Fixed
- Regenerated `package-lock.json` so the root lockfile metadata matches `package.json` again, including the declared `open`, `@types/bun`, `@types/open`, and `tsx` entries.
- Kept the `mcp` proxy tool available as a first-session fallback when configured direct tools are still missing cache metadata, avoiding no-tool startup gaps.

## [2.3.5] - 2026-04-13

### Fixed
- Session lifecycle now always tears down OAuth callback state on restart and shutdown, preventing callback-server leaks across session transitions.
- OAuth callback server now calls `unref()` after successful bind so it no longer keeps sub-agent processes alive by itself.
- Strict OAuth port mode now rebinds to the configured callback port when safe, while refusing to switch ports when authorizations are still pending.
- Added focused lifecycle/callback-server regression coverage for teardown, `unref()`, strict rebinding, and pending-auth guardrails.
- Thanks @blai for the investigation and PR #43 that surfaced the sub-agent hang/root lifecycle issues.

## [2.3.4] - 2026-04-12

### Fixed
- OAuth callback handling now allows dynamic-registration flows to fall back to a free local port when the preferred callback port is busy, while keeping pre-registered clients on their exact configured redirect port.
- Documented the new callback-port behavior and added focused auth-flow regression coverage.

## [2.3.3] - 2026-04-12

### Fixed
- Remove the blank footer status line when no MCP servers are configured by clearing the MCP status entry instead of setting it to an empty string. Thanks @HazAT for PR #27.

## [2.3.2] - 2026-04-11

### Added
- Optional `oauth.grantType: "client_credentials"` for non-interactive machine-to-machine OAuth on HTTP MCP servers.

### Fixed
- `/mcp-auth <server>` now handles `client_credentials` without browser/callback flow.
- MCP panel status no longer marks `client_credentials` servers as auth-blocked solely because no stored user tokens exist yet.
- OAuth auth flow now closes temporary transports consistently on success, refresh, and auth removal paths.
- Init paths now preserve debug-level context for previously silent direct-tool bootstrap and lazy-connect failures.

## [2.3.1] - 2026-04-11

### Fixed
- Removed `/mcp-auth-callback`. OAuth auth now hard-cuts to `/mcp-auth <server>` only.

## [2.3.0] - 2026-04-11

### Added
- OAuth callback server initialization on session start and a deprecated `/mcp-auth-callback` command that now points users to `/mcp-auth <server>`.

### Fixed
- OAuth `needs-auth` handling across `/mcp` status/panel, `mcp({ connect })`, `mcp({ tool })`, reconnect flow, lazy/direct tool execution, and startup bootstrap.
- OAuth callback cleanup now cancels by stored OAuth state and closes pending transports on failure/cancel paths.
- Callback server now fails fast when the OAuth callback port is occupied by another process.
- Package manifest test now ignores root `*.test.ts` files.

## [2.2.2] - 2026-04-03

### Fixed
- Session lifecycle teardown now handles repeated `session_start` transitions safely and prevents stale async init results from replacing newer state.
- Shutdown now still runs `gracefulShutdown()` even if metadata cache flushing throws, avoiding leaked MCP processes.
- Proxy/direct tool init error paths now preserve and surface underlying error messages instead of returning generic failures.
- Invalid `mcp` tool `args` now fail by throwing with parse/type context instead of returning non-failing tool payloads.
- Added focused lifecycle regressions tests for stale init cleanup and init-error visibility.

## [2.2.1] - 2026-03-23

### Fixed
- Added `promptSnippet` to MCP proxy tool and direct MCP tools so they appear in the system prompt's Available tools section (required since pi 0.59.0)

## [2.2.0] - 2026-03-16

### Added
- **MCP UI Integration** - Support for the [MCP UI](https://github.com/MCP-UI-Org/mcp-ui) standard. Tools with `_meta.ui.resourceUri` open interactive UIs:
  - Bidirectional AppBridge communication (tool calls, messages, context updates)
  - Works with both stdio and HTTP MCP servers
  - User consent management for tool calls from UI (configurable: never/once-per-server/always)
  - Keyboard shortcuts: Cmd/Ctrl+Enter to complete, Escape to cancel
  - UI prompts/intents trigger agent turns via `pi.sendMessage({ triggerTurn: true })`
  - `mcp({ action: "ui-messages" })` retrieves accumulated messages from UI sessions

- **Session reuse** - When the agent calls the same tool while its UI is already open, results push to the existing window instead of replacing it. Per-call stream IDs with independent sequences. Error results scoped to the individual call.

- **Glimpse integration** - MCP UI opens in a native macOS WKWebView window instead of a browser tab when [Glimpse](https://github.com/hazat/glimpse) is installed (`pi install npm:glimpseui`). Falls back to browser on non-macOS or when unavailable. Override with `MCP_UI_VIEWER=browser` or `MCP_UI_VIEWER=glimpse`.

- **Logger module** (`logger.ts`) - Centralized logging with levels (debug/info/warn/error), contextual child loggers, and `MCP_UI_DEBUG=1` env var.

- **Error types** (`errors.ts`) - Structured errors with recovery hints: `ResourceFetchError`, `ResourceParseError`, `BridgeConnectionError`, `ConsentError`, `SessionError`, `ServerError`, and `wrapError()` helper.

- **Test suite** - 178 tests covering consent manager, UI resource handler, host HTML template, logger, and error types.

- **Interactive visualizer example** (`examples/interactive-visualizer`) - Minimal MCP server demonstrating charts (bar/line/pie/doughnut via Chart.js), bidirectional messaging, and streaming.

### Fixed
- Host-iframe timing: bridge now connects before loading iframe, fixing `ui/initialize` timeout on first load
- All internal `log.info` calls demoted to `log.debug` to eliminate stdout noise during normal use

### Technical Notes
- Uses local minified AppBridge bundle (408KB) to avoid CDN Zod bundling issues
- Serves app HTML from `/ui-app` endpoint instead of blob URLs to avoid iframe issues
- SSE for real-time tool result streaming to browser

## [2.1.2] - 2026-02-03

### Changed
- Added demo video and `pi.video` field to package.json for pi package browser.

## [2.1.0] - 2026-02-02

### Added
- **Direct tool registration** - Promote specific MCP tools to first-class Pi tools via `directTools` config (per-server or global). Direct tools appear in the agent's tool list alongside builtins, so the LLM uses them without needing to search through the proxy first. Registers from cached metadata at startup — no server connections needed.
- **`/mcp` interactive panel** - New TUI overlay replacing the text-based status dump. Shows server connection status, tool lists with direct/proxy toggles, token cost estimates, inline reconnect, and auth notices. Changes written to config on save.
- **Auto-enriched proxy description** - The `mcp` proxy tool description now includes server names and tool counts from the metadata cache, so the LLM knows what's available without a search call (~30 extra tokens).
- **`MCP_DIRECT_TOOLS` env var** - Subagent processes receive their direct tool configuration via environment variable, keeping subagents lean by default.
- **First-run bootstrap** - Servers with `directTools` configured but no cache entry are connected during `session_start` to populate the cache. Direct tools become available after restart.
- Config provenance tracking for correct write-back to user/project/import sources
- Builtin name collision guard (skips direct tools that would shadow `read`, `write`, etc.)
- Cross-server name deduplication for `prefix: "none"` and `prefix: "short"` modes

## [2.0.1] - 2026-02-01

### Fixed
- Adapt execute signature to pi v0.51.0: add signal, onUpdate, ctx parameters

## [2.0.0] - 2026-01-29

### Changed
- **BREAKING: Lazy startup by default** - All servers now default to `lifecycle: "lazy"` and only connect when a tool call needs them. Previously all servers connected eagerly on session start. Set `lifecycle: "keep-alive"` or `lifecycle: "eager"` to restore the old behavior per-server.
- **Idle timeout** - Connected servers are automatically disconnected after 10 minutes of inactivity (configurable via `settings.idleTimeout` or per-server `idleTimeout`). Cached metadata keeps search/list working after disconnect. Set `idleTimeout: 0` to disable.
- `/mcp reconnect` accepts an optional server name to connect or reconnect a single server

### Added
- **Metadata cache** - Tool and resource metadata persisted to `~/.pi/agent/mcp-cache.json`. Enables search/list/describe without live connections. Per-server config hashing with 7-day staleness. Multi-session safe via read-merge-write with per-process tmp files.
- **npx binary resolution** - Resolves npx package binaries to direct paths, eliminating the ~143 MB npm parent process per server. Persistent cache at `~/.pi/agent/mcp-npx-cache.json` with 24h TTL.
- **`mcp({ connect: "server-name" })` mode** - Explicitly trigger connection and metadata refresh for a named server
- **Failure backoff** - Servers that fail to connect are skipped for 60 seconds to avoid repeated connection storms
- **In-flight tracking** - Active tool calls prevent idle timeout from shutting down a server mid-request
- **Prefix-match fallback** - Tool calls with unrecognized names try to match a server prefix and lazy-connect the matching server
- Lifecycle options: `lazy` (default), `eager` (connect at startup, no auto-reconnect), `keep-alive` (unchanged)
- Per-server `idleTimeout` override and global `settings.idleTimeout`
- First-run bootstrap: connects all servers on first session to populate the cache

### Fixed
- Connection close race condition: concurrent close + connect no longer orphans server processes
- **Fuzzy tool name matching** - Hyphens and underscores are treated as equivalent during tool lookup. MCP tools like `resolve-library-id` are now found when called as `resolve_library_id`, which LLMs naturally guess since the prefix separator is `_`.
- **Better "tool not found" errors** - When a server is identified (via prefix match or override) but the tool isn't found, the error now lists that server's available tools so the LLM can self-correct immediately instead of needing a separate list call

## [1.6.0] - 2026-01-29

### Added
- **Unified pi tool search** - `mcp({ search: "..." })` now searches both MCP tools and Pi tools (from installed extensions)
- Pi tools appear first in results with `[pi tool]` prefix
- Details object includes `server: "pi"` for pi tools
- Banner image for README

## [1.5.1] - 2026-01-26

### Changed
- Added `pi-package` keyword for npm discoverability (pi v0.50.0 package system)

## [1.5.0] - 2026-01-22

### Changed
- **BREAKING: `args` parameter is now a JSON string** - The `args` parameter which previously accepted an object now accepts a JSON string. This change was required for compatibility with Claude's Vertex AI API (`google-antigravity` provider) which rejects `patternProperties` in JSON schemas (generated by `Type.Record()`).

### Added
- **Type validation for args** - Parsed args are now validated to ensure they're a JSON object (not null, array, or primitive). Clear error messages for invalid input.
- **`isError: true` on error responses** - JSON parse errors and type validation errors now properly set `isError: true` to indicate failure to the LLM.

### Migration
```typescript
// Before (1.4.x)
mcp({ tool: "my_tool", args: { key: "value" } })

// After (1.5.0)
mcp({ tool: "my_tool", args: '{"key": "value"}' })
```

## [1.4.1] - 2026-01-19

### Changed

- Status bar shows server count instead of tool count ("MCP: 5 servers")

## [1.4.0] - 2026-01-19

### Changed

- **Non-blocking startup** - Pi starts immediately, MCP servers connect in background. First MCP call waits only if init isn't done yet.

### Fixed

- Tool metadata now includes `inputSchema` after `/mcp reconnect` (was missing, breaking describe and error hints)

## [1.3.0] - 2026-01-19

### Changed

- **Parallel server connections** - All MCP servers now connect in parallel on startup instead of sequentially, significantly faster with many servers

## [1.2.2] - 2026-01-19

### Fixed

- Installer now downloads from `main` branch (renamed from `master`)

## [1.2.1] - 2026-01-19

### Added

- **npx installer** - Run `npx pi-mcp-adapter` to install (downloads files, installs deps, configures settings.json)

## [1.1.0] - 2026-01-19

### Changed

- **Search includes schemas by default** - Search results now include parameter schemas, reducing tool calls needed (search + call instead of search + describe + call)
- **Space-separated search terms match as OR** - `"navigate screenshot"` finds tools matching either word (like most search engines)
- **Suppress server stderr by default** - MCP server logs no longer clutter terminal on startup
- Use `includeSchemas: false` for compact output without schemas
- Use `debug: true` per-server to show stderr when troubleshooting

## [1.0.0] - 2026-01-19

### Added

- **Single unified `mcp` tool** with token-efficient architecture (~200 tokens vs ~15,000 for individual tools)
- **Five operation modes:**
  - `mcp({})` - Show server status
  - `mcp({ server: "name" })` - List tools from a server
  - `mcp({ search: "query" })` - Search tools by name/description
  - `mcp({ describe: "tool_name" })` - Show tool details and parameter schema
  - `mcp({ tool: "name", args: {...} })` - Call a tool
- **Stdio transport** for local MCP servers (command + args)
- **HTTP transport** with automatic fallback (StreamableHTTP → SSE)
- **Config imports** from Cursor, Claude Code, Claude Desktop, VS Code, Windsurf, Codex
- **Resource tools** - MCP resources exposed as callable tools
- **OAuth support** - Token file-based authentication
- **Bearer token auth** - Static or environment variable tokens
- **Keep-alive connections** with automatic health checks and reconnection
- **Schema on-demand** - Parameter schemas shown in `describe` mode and error responses
- **Commands:**
  - `/mcp` or `/mcp status` - Show server status
  - `/mcp tools` - List all tools
  - `/mcp reconnect` - Force reconnect all servers
  - `/mcp-auth <server>` - Show OAuth setup instructions

### Architecture

- Tools stored in metadata map, not registered individually with Pi
- MCP server validates arguments (no client-side schema conversion)
- Reconnect callback updates metadata after auto-reconnect
- Human-readable schema formatting for LLM consumption
