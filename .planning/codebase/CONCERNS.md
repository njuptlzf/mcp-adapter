# Codebase Concerns

**Analysis Date:** 2026-06-26

## Architectural Concerns

### C-01: "Universal" Adapter Is Per-Agent, Not Category-Based

**Issue:** Despite the "Universal MCP Adapter" branding, each new agent type still requires writing a dedicated adapter class, resolver factory, and (optionally) a sampling provider. The `AGENT_ADAPTERS` registry in `interfaces/agent-api.ts` (lines 193–244) exposes the reality: Pi, Qoder, and Kilo each have distinct `AgentAPI` implementations (`adapters/pi-adapter.ts`, `adapters/qoder-adapter.ts`, `adapters/kilo-adapter.ts`), distinct `AgentPathResolver` factories (`createPiResolver`, `createQoderResolver`, `createKiloResolver` in `interfaces/agent-paths.ts` lines 43–90), and distinct context adapters (`adaptPiContext`, `adaptQoderContext`, `adaptKiloContext`).

**Files:**
- `interfaces/agent-api.ts:193-244` — `AGENT_ADAPTERS` registry (3 entries, 52 lines)
- `adapters/pi-adapter.ts:45-181` — `PiAdapter` class (137 lines)
- `adapters/qoder-adapter.ts` (372 lines)
- `adapters/kilo-adapter.ts:50-297` — `KiloAdapter` class (248 lines)
- `interfaces/agent-paths.ts:43-90` — Three resolver factories, each with hardcoded default directories

**Impact:** "For every agent" means "for every agent we manually write code for." An agent that uses standard `.mcp.json` with stdio-based MCP servers should be 95% plug-and-play, but currently requires a full adapter + resolver + registry entry. This blocks the user's vision of treating MCP protocol + hook protocol as an agent category.

**Fix approach:** Extract a `StdioMcpAdapter` class that implements `AgentAPI` generically — driven by a self-reported `.mcp.json` path and an optional `AgentChannel`. Move agent-specific differences (default directory, project config name, UI capabilities, sampling provider) into a lightweight `AgentProfile` descriptor object. This would collapse `PiAdapter`, `QoderAdapter`, and `KiloAdapter` into a single adapter with agent profiles.

### C-02: Hardcoded Default Paths Per Agent

**Issue:** Each resolver factory in `interfaces/agent-paths.ts` hardcodes a default directory: `~/.pi/agent/` (Pi), `~/.qoder/agent/` (Qoder), `~/.kilo/` (Kilo). While `MCP_AGENT_DIR` provides runtime override, the defaults are duplicated across factories. The `resolveQoderGlobalConfigPath()` function (lines 29–41) and the inline Kilo resolver (lines 75–89) both independently reimplement the same tilde-expansion logic.

**Files:**
- `interfaces/agent-paths.ts:32` — Qoder default: `join(homedir(), ".qoder", "agent")`
- `interfaces/agent-paths.ts:78` — Kilo default: `join(homedir(), ".kilo")`
- `agent-dir.ts:10` — Pi default: `join(homedir(), ".pi", "agent")`

**Impact:** Adding a new agent requires copying the tilde-expansion logic yet again. If the `MCP_AGENT_DIR` behavior changes, it must be updated in at least 3 places (agent-dir.ts + two resolver functions).

**Fix approach:** The user's vision of self-reporting `.mcp.json` paths eliminates this entirely. Until then, extract tilde-expansion into a single `resolveAgentDir()` utility that accepts a default suffix. Better yet: have the agent profile declare its `.mcp.json` discovery logic as a simple `globalConfigPath` string or function in the profile object.

### C-03: `DEFAULT_AGENT_RESOLVER` Is Pi

**Issue:** `DEFAULT_AGENT_RESOLVER = createPiResolver()` in `interfaces/agent-paths.ts:92` means every piece of code that doesn't explicitly receive a resolver defaults to Pi paths. This includes `config.ts` functions like `getConfigSources` (line 202), `getPiGlobalConfigPath` (line 92), `getServerProvenance` (implicit via `getPiGlobalConfigPath`), `previewCompatibilityImports` (line 539), and `ensureCompatibilityImports` (line 549).

**Files:**
- `interfaces/agent-paths.ts:92` — `DEFAULT_AGENT_RESOLVER`
- `config.ts:92-94` — `getPiGlobalConfigPath` (backward-compat wrapper)
- `config.ts:96-101` — `getAgentGlobalConfigPath` (generic but defaults to Pi)

**Impact:** Any code path that doesn't thread an `AgentPathResolver` through falls back to Pi's `~/.pi/agent/mcp.json`. This is a correctness issue for non-Pi agents if the adapter initialization doesn't explicitly supply the right resolver.

**Fix approach:** Remove `DEFAULT_AGENT_RESOLVER` or make it an explicit parameter in the agent-agnostic entry point `createMcpAdapter`. The `AGENT_ADAPTERS` registry already knows each agent's resolver — `config.ts` should be resolver-aware from the top-level call site.

---

## Pi-Specific Coupling Remnants

### C-04: `mcp-panel.ts` Imports `@earendil-works/pi-tui`

**Issue:** `mcp-panel.ts:1` imports `{ matchesKey, truncateToWidth, visibleWidth }` from `@earendil-works/pi-tui`. This is an optional dependency (`package.json:112`), but the import is unconditional — it will fail at runtime if `pi-tui` is not installed. The three functions are used extensively for keyboard input matching and text layout throughout the 827-line file.

**Files:**
- `mcp-panel.ts:1` — Unconditional import from `@earendil-works/pi-tui`

**Impact:** The MCP panel cannot render in non-Pi agents without the `pi-tui` package installed. This is the single largest coupling remnant flagged as DECOUPLE-06 follow-up in `skills/upstream-merge/references/special-cases.md:10`.

**Fix approach:** Vendor the three functions (`matchesKey`, `truncateToWidth`, `visibleWidth`) into a local utility module, or make them optional with a pure-JS fallback. The functions are relatively self-contained (key matching, string width measurement, truncation).

### C-05: `mcp-setup-panel.ts` Has Same `pi-tui` Coupling

**Issue:** Identical pattern to C-04. `mcp-setup-panel.ts:1` imports the same three functions from `@earendil-works/pi-tui`.

**Files:**
- `mcp-setup-panel.ts:1` — Unconditional import from `@earendil-works/pi-tui`

**Impact:** Same as C-04. The setup panel is the first screen a new user sees — it must work without Pi dependencies for non-Pi agents.

**Fix approach:** Same as C-04 — vendor the functions.

### C-06: Config Source IDs Use Pi Nomenclature

**Issue:** `config.ts:30` defines `ConfigSourceSpec.id` as `"shared-global" | "pi-global" | "shared-project" | "pi-project"`. The `pi-global` and `pi-project` IDs appear in labels ("Pi global override", "project Pi override" at lines 224, 247), in source `kind` values (`"pi"` at line 145), and in the `hasPiOwnedServers` field of `McpDiscoverySummary` (line 77). The term "Pi" is thus semantically embedded in the config discovery layer.

**Files:**
- `config.ts:30` — ID union type with `pi-global`, `pi-project`
- `config.ts:54` — `kind: "shared" | "pi"`
- `config.ts:77` — `hasPiOwnedServers: boolean`
- `config.ts:92` — `getPiGlobalConfigPath()` (retained for backward compat)
- `config.ts:111-113` — `getProjectPiConfigPath()` 
- `config.ts:223-230` — "Pi global override" / "Pi" source labels

**Impact:** Renaming these to agent-neutral terms ("agent-global", "agent-project") would be the correct move but would require updating the `McpDiscoverySummary` interface, all callers (commands.ts, mcp-setup-panel.ts), and test fixtures.

**Fix approach:** Introduce a migration path: add new IDs in parallel (`agent-global`, `agent-project`), deprecate old IDs, and switch the UI labels to use the agent's display name from the `AGENT_ADAPTERS` registry rather than hardcoded "Pi".

### C-07: Pi-Specific UI Text Strings

**Issue:** `commands.ts` line 232: `"Pi only writes compatibility imports and adapter-specific overrides into Pi-owned files when needed."` and line 366: `"Direct tools updated. Pi will reload after this panel closes."` These are hardcoded Pi-branded strings in otherwise agent-agnostic command handlers.

**Files:**
- `commands.ts:232` — "Pi only writes..."
- `commands.ts:366` — "Pi will reload..."
- `mcp-setup-panel.ts:283, 291, 317` — "Pi will reload after this panel closes."

**Impact:** Non-Pi agents display "Pi will reload" to their users, which is confusing and technically incorrect.

**Fix approach:** Replace static "Pi" with the agent's `displayName` from the `AGENT_ADAPTERS` descriptor. The `AgentContext` or a new parameter should carry `agentDisplayName` so these strings can be properly parameterized.

### C-08: `index.ts` Is Pi-Only Entry Point

**Issue:** While `adapters/entry.ts:58` exports a clean agent-agnostic `createMcpAdapter`, the default export `index.ts:18` only accepts `ExtensionAPI` (Pi-specific type) and constructs a `PiAdapter` internally. This means Pi is the only agent that has a drop-in `import mcpAdapter from "pi-mcp-adapter"` experience.

**Files:**
- `index.ts:1` — `import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"` 
- `index.ts:18-27` — `export default function mcpAdapter(pi: ExtensionAPI)`

**Impact:** Non-Pi agents must use the non-default export `createMcpAdapter` and manually construct their adapter. This asymmetry means the "universal" entry point is not the default export.

**Fix approach:** Either (a) make `createMcpAdapter` the default export from a new `adapters/index.ts` and keep `index.ts` as a backward-compat Pi wrapper, or (b) deprecate `index.ts` entirely in favor of `adapters/entry.ts`.

---

## Scale & Maintenance Burden

### C-09: Each New Agent Requires 5+ Files

**Issue:** Adding a new agent currently requires:
1. An `AgentAPI` adapter class (`adapters/<agent>-adapter.ts`, ~250–370 lines)
2. A resolver factory function (`interfaces/agent-paths.ts`, ~30 lines)
3. An `AGENT_ADAPTERS` registry entry (`interfaces/agent-api.ts`, ~10 lines)
4. A context adapter function (`adaptXxxContext`)
5. Optionally: a sampling provider, a renderer
6. A per-agent reference file in `skills/mcp-adapter-test/references/agent-paths/`

**Files:**
- `adapters/pi-adapter.ts` (237 lines)
- `adapters/qoder-adapter.ts` (372 lines)
- `adapters/kilo-adapter.ts` (298 lines)
- `interfaces/agent-paths.ts` (107 lines, growing with each agent)
- `interfaces/agent-api.ts` (245 lines, AGENT_ADAPTERS array grows)

**Impact:** Linear scaling. 3 agents = ~900 lines of adapter code. 10 agents = ~3000 lines. Each new agent duplicates patterns: tool registration maps, event handler sets, buffered message queues, `attachChannel`/`detachChannel` boilerplate.

**Fix approach:** The `KiloAdapter` and `QoderAdapter` share ~70% structural similarity (both use in-memory Maps, both have `attachChannel`/`detachChannel`, both provide `fireSessionStart`/`fireSessionShutdown`). Extract a `BaseStoreAdapter` that all in-memory/store-based adapters extend, reducing per-agent code to the agent-specific bridging (~50 lines each).

### C-10: Upstream Merge Complexity

**Issue:** The fork maintenance workflow in `skills/upstream-merge/SKILL.md` is 180 lines of decision-tree logic. Every upstream merge requires running `npm run upstream:check`, cross-referencing `skills/upstream-merge/references/special-cases.md` (19 entries), running a 5-command Pi-coupling grep, consulting a 12-category matrix, and completing a 6-item checklist. The `scripts/upstream-divergence.ts` script adds a GnuTLS workaround that is environment-specific.

**Files:**
- `skills/upstream-merge/SKILL.md` (180 lines)
- `skills/upstream-merge/references/special-cases.md` (43 lines, 19 entries)
- `scripts/upstream-divergence.ts` (143 lines)
- `package.json:19` — `"upstream:check": "tsx scripts/upstream-divergence.ts"`

**Impact:** Each upstream sync is a structured but fragile manual process. If the fork accumulates more divergent files, the special-cases registry grows, and the §3.1 grep template may need updates. The GnuTLS workaround (lines 15-16, 56-63) is a single-point-of-failure for environments without GnuTLS issues.

**Fix approach:** For files that are truly fork-only (adapters, skills, bin/), add git-merge drivers or `.gitattributes` to auto-resolve. Reduce the special-cases registry by pushing more decisions into the 12-category matrix (currently ~70% coverage) toward 90%+.

### C-11: `mcp-panel.ts` and `mcp-setup-panel.ts` Are UI Monoliths

**Issue:** These files are 827 and 577 lines respectively, with no separation between UI rendering logic and business logic. `mcp-panel.ts` contains ANSI escape codes, fuzzy search, render logic, and tool-state management in a single class. `mcp-setup-panel.ts` contains action routing, import management, screen state, and diff preview rendering in a single class.

**Files:**
- `mcp-panel.ts` — 827 lines, single `McpPanel` class
- `mcp-setup-panel.ts` — 577 lines, single `McpSetupPanel` class

**Impact:** These files are difficult to test in isolation, resist modification, and are the primary source of the pi-tui coupling. Changes to the panel UX require touching code intertwined with Pi-specific rendering primitives.

**Fix approach:** Split into a rendering-agnostic state machine + a rendering layer. The state machine handles tool toggles, cursor navigation, search filtering. The rendering layer handles layout and ANSI formatting. This also enables the pi-tui decoupling — the rendering layer can be swapped per agent.

---

## Limitations of Current Abstractions

### C-12: `AgentPathResolver` Cannot Express "Self-Reported" Paths

**Issue:** The `AgentPathResolver` interface (`interfaces/agent-paths.ts:7-13`) requires a `globalConfigPath()` function that returns a static path. There is no mechanism for an agent to say "read my config path from `<env var>`" or "my `.mcp.json` location is at `<runtime-determined-path>`". The `MCP_AGENT_DIR` env var is a partial workaround but only works at the directory level.

**Files:**
- `interfaces/agent-paths.ts:7-13` — `AgentPathResolver` interface (2 methods)
- `interfaces/agent-paths.ts:92` — `DEFAULT_AGENT_RESOLVER` is Pi

**Impact:** The user's architectural vision (agent self-reports its `.mcp.json` location) requires a fundamentally different path resolution model — one where the agent provides its config path at runtime rather than the adapter guessing from static defaults.

**Fix approach:** Add an optional `selfReportConfigPath?: () => string | Promise<string>` to `AgentContext` that takes priority over `AgentPathResolver.globalConfigPath()`. The resolvers become fallbacks, not the primary path discovery mechanism.

### C-13: `AGENT_ADAPTERS` Registry Is Test-Oriented, Not Runtime-Oriented

**Issue:** The `AGENT_ADAPTERS` registry was designed for the test runner (`__tests__/adapter-contract.test.ts`), Capability Gate verification, and README matrix generation. It creates adapter instances via `factory()` and provides verification contexts. However, it is not used for runtime adapter selection — the actual runtime flow in `index.ts` hardcodes `new PiAdapter(pi)`.

**Files:**
- `interfaces/agent-api.ts:193-244` — Static `AGENT_ADAPTERS` array
- `index.ts:23` — `const agentapi = new PiAdapter(pi)` (hardcoded)

**Impact:** The registry is a documentation artifact, not a runtime dispatch mechanism. There's no code path that selects an adapter from the registry based on the detected agent environment.

**Fix approach:** Build an `autoDetectAdapter()` function that inspects the environment (presence of Pi's `ExtensionAPI`, Qoder SDK's `query` function, Kilo's process markers) and returns the appropriate agent descriptor. Alternatively, let the host inject the descriptor explicitly.

### C-14: Token Optimization Claims Are Context-Bound

**Issue:** The project claims token reduction of 94% (proxy) and 56% (conversation) but the `MILESTONES.md` performance metrics acknowledge these are "baseline-bound" and "fixture-determined and shared with Pi." The optimization comes from the agent-agnostic serializer — which produces the same results as Pi's serializer because it is the same code path.

**Files:**
- `.planning/MILESTONES.md:27` — "baseline-bound annotations that explain why the observed 94% / 56% are 1-9 pp short of the ≥ 95% / ≥ 65% targets — both numbers are fixture-determined and shared with Pi"
- `.planning/STATE.md:119-120` — Same acknowledgment

**Impact:** The token reduction is real but is fundamentally a property of the core MCP adapter's proxy-mode serialization, not of the "universal" refactoring. There is no independent token optimization benchmark for non-Pi adapters against non-Pi fixture data.

**Fix approach:** Add a per-agent token benchmark in `skills/mcp-adapter-test/` that tests each adapter against an agent-specific fixture, quantifying any regression from Pi's baseline.

---

## Security & Risk

### C-15: Fork Identity Confusion

**Issue:** `package.json:2` names the package `"pi-mcp-adapter"` with description `"MCP (Model Context Protocol) adapter extension for Pi coding agent"`. The repository URL (`package.json:24`) points to `https://github.com/nicobailon/pi-mcp-adapter.git` (upstream). The npm package name suggests Pi-only, not universal.

**Files:**
- `package.json:2` — `"name": "pi-mcp-adapter"`
- `package.json:4` — `"description": "MCP... for Pi coding agent"`
- `package.json:24` — `"url": "git+https://github.com/nicobailon/pi-mcp-adapter.git"`
- `package.json:27-35` — `"keywords"` include `"pi-package"`, `"pi"`

**Impact:** Users discovering this package on npm will see "Pi-specific adapter," not "universal MCP adapter for any coding agent." The README (28.8 KB) may address this, but npm search and CLI listings use the package.json metadata.

**Fix approach:** Rename the npm package to `mcp-adapter` or `universal-mcp-adapter` (requires new npm registration). At minimum, update `description`, `repository.url`, and `keywords` to reflect the fork's true scope.

### C-16: Self-Dependency Loop

**Issue:** `package.json:97` lists `"pi-mcp-adapter": "^2.10.0"` as a dependency. This is a circular self-reference — the package depends on itself. This appears to be an upstream artifact (the upstream project likely references the published npm package for peer resolution).

**Files:**
- `package.json:97` — `"pi-mcp-adapter": "^2.10.0"` in `dependencies`

**Impact:** npm install may produce warnings about circular dependencies. If the published package version differs from the local version, resolution could be unpredictable.

**Fix approach:** Remove or replace with a dev-only self-reference (if needed for testing) or remove entirely if it's an upstream artifact.

---

## Missing Critical Features

### C-17: No Agent Auto-Detection

**Issue:** There is no mechanism for the adapter to detect which agent it's running inside. Pi detection is implicit (the host passes `ExtensionAPI`), Qoder and Kilo detection is manual (the host constructs the adapter explicitly). A user who installs this package in a supported agent has no automatic onboarding experience.

**Files:**
- No file implements agent auto-detection

**Impact:** Each agent host must write integration code to instantiate the right adapter. This blocks the user's vision of a drop-in adapter that "just works" across agents.

**Fix approach:** Add an `autoDetectMcpAdapter()` function in `adapters/entry.ts` that probes for known SDKs (Pi's global `pi` object, Qoder's `@qoder-ai/qoder-agent-sdk`, Kilo's runtime markers) and returns the appropriate adapter. The auto-detection would use optional dynamic imports to avoid hard dependencies.

### C-18: No Self-Reporting Mechanism for `.mcp.json`

**Issue:** The user's architectural vision requires agents to self-report their `.mcp.json` location. Currently, the adapter guesses based on `AgentPathResolver` factories with hardcoded defaults. There is no protocol for an agent to tell the adapter "my config is at X."

**Files:**
- `interfaces/agent-paths.ts` — Static resolver interface
- `config.ts:202-257` — `getConfigSources` uses resolver, not self-reporting

**Impact:** Without self-reporting, every new agent requires a code change to add its resolver factory. An agent that follows standard MCP conventions (`.mcp.json` at project root, `~/.config/mcp/mcp.json` for global) should work zero-code.

**Fix approach:** Add `agentConfigPath?: string` to `AgentContext`. When set, it overrides `AgentPathResolver`. The `createMcpAdapter` entry point should accept it. Agents that follow the standard (`.mcp.json` in project root) need no resolver at all — the generic defaults in `config.ts` (GENERIC_GLOBAL_CONFIG_PATH, PROJECT_CONFIG_NAME) already handle this case.

---

## Test Coverage Gaps

### C-19: Pi-Coupled UI Panels Lack Agent-Agnostic Tests

**Issue:** `mcp-panel.ts` and `mcp-setup-panel.ts` have no dedicated unit test files. They are exercised indirectly through integration tests (`__tests__/commands-onboarding.test.ts` has 157 lines) but there are no isolated tests for the panel state machines. The pi-tui import makes them untestable without the Pi TUI package.

**Files:**
- `__tests__/commands-onboarding.test.ts` — 157 lines, only tests onboarding flow
- No `__tests__/mcp-panel.test.ts` 
- No `__tests__/mcp-setup-panel.test.ts`

**Impact:** Any change to the panel logic (including pi-tui decoupling) has no test safety net. The 827-line `mcp-panel.ts` is a high-risk modification target.

**Priority:** Medium — should be addressed before any DECOUPLE-06 follow-up work.

### C-20: Adapter Contract Test Covers 3/3 Adapters But Limited Depth

**Issue:** `__tests__/adapter-contract.test.ts` (123 lines) tests that each adapter satisfies the `AgentAPI` contract (register + read-back round trips). However, it does not test `exec`, `sendMessage` with attached channels, event handler lifecycle, or context adaptation correctness.

**Files:**
- `__tests__/adapter-contract.test.ts` — 123 lines, covers method existence + basic round-trip

**Impact:** Adapter bugs in `exec`, `sendMessage`, or event handling would not be caught by the parametric contract test. The Qoder adapter integration test (`__tests__/qoder-adapter-integration.test.ts`) covers Qoder more deeply, but Kilo and Pi lack equivalent deep integration tests.

**Priority:** Medium

---

*Concerns audit: 2026-06-26*
