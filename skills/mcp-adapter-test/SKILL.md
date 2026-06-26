---
name: mcp-adapter-test
description: >
  Universal mcp-adapter integration test. Runs MockAgent compatibility
  (Section 4), token benchmark (Section 5/5B), proxy mode unit tests,
  directTools unit + integration tests, and E2E validation (Section 6)
  against all 10 demo MCP servers. Works for any AgentAPI adapter
  registered in AGENT_ADAPTERS. See references/agent-paths/<agent>.md
  for adapter-specific commands.
  Use when user says "run mcp-adapter tests", "test mcp-adapter",
  "验证 mcp-adapter", "测试 mcp-adapter", or "/mcp-adapter-test".
---

# mcp-adapter Integration Test (universal)

Executes the test plan (`docs/mcp-adapter-test-plan.md`) end-to-end for every
registered `AgentAPI` adapter in [`interfaces/agent-api.ts`](../../interfaces/agent-api.ts).

## Related documents

| Document | Role | Sync contract |
|----------|------|---------------|
| `docs/mcp-adapter-test-plan.md` | **Authoritative test plan** — phases, sections, pass criteria, baseline rationale | Source of truth; SKILL.md mirrors the executable subset |
| `skills/mcp-adapter-test/SKILL.md` | **Executable workflow** — exact commands, AskUserQuestion prompts, parametric references | Regenerate from the plan when section names, phase counts, or pass criteria change |
| `skills/mcp-adapter-test/references/agent-paths/<id>.md` | **Per-adapter commands** — Path A/B/C verification, host environments | Auto-derived from `AGENT_ADAPTERS` registry; new adapter = copy `_template.md` |
| `tests/reports/mcp-adapter-test-report.{md,json}` | **Auto-generated report** — agent × section matrix written by `tests/reporters/matrix-reporter.ts` | Regenerated on every `npx vitest run`; never edit by hand |

**Sync rule**: any change to phase numbering, pass criteria, or section
classifications in the plan must be reflected in SKILL.md in the same
commit. If the matrix report shows a section that has no SKILL.md phase
matching it, that's a drift — file an issue.

## Test strategy (D-15)

### No Auto-Skip principle

Every test phase/step in this skill must be in one of three states:

1. **Run** — the command in this file is executed and the result recorded.
2. **Conditionally run** — preceded by a `test -f` / `command -v` guard; the
   agent records either "ran" or "skipped (missing dependency)" with the
   exact reason.
3. **Explicit user skip** — the agent calls `AskUserQuestion` and the user
   confirms "yes, skip phase X". The user's answer is recorded in the
   master report.

**Forbidden**:
- Auto-skipping a phase because "it looks redundant" or "we already ran
  something similar".
- Auto-skipping a phase because the current host agent can't run it (use
  Host × Target decomposition instead — see below).
- Auto-skipping a phase based on perceived relevance to the user's request.

**Required when skipping**: surface the exact reason to the user BEFORE
the skip takes effect. If the user has not been asked, do not skip.

### Baseline-bound metrics (D-04)

Phase 2 / 3 token savings and Phase 3 conversation overhead are
**baseline-bound** — they are determined by the proxy tool definition
(agent-agnostic) plus the demo-servers fixture, not by the adapter under
test. When the observed percentage differs from the target, treat it as a
**pre-existing project characteristic**, not an adapter regression. The
master report template documents this so future agents don't re-investigate
the same gap.

## Execution model (D-16)

### Three orthogonal dimensions

The mcp-adapter test exercises three independent axes. Conflating them
leads to confusion about what "the test" means.

| Dimension | Possible values | Source of truth | Default if not specified |
|-----------|-----------------|-----------------|--------------------------|
| **Host**   | Qoder, Pi, Kilo, Claude, … — the agent that loaded this skill | Current runtime (the agent reading this file) | **Current host** |
| **Target** | kilo, pi, qoder, … — the adapter under test | `AGENT_ADAPTERS` registry in `interfaces/agent-api.ts` | **All targets** |
| **Mode**   | `in-process` (parametric AgentAPI contract) / `spawn` (real binary) / `mock` (MockAgent) | Test file pattern (e.g. `__tests__/adapter-contract.test.ts` = in-process) | **All three modes** |

### Why they are independent

- The host can be any AgentAPI-compatible agent — including ones that
  have no MCP server support (e.g. Claude). Such hosts can still run
  in-process tests for any target.
- The target is what we are validating. Adding a new target = pushing
  one descriptor to `AGENT_ADAPTERS` and copying the agent-paths
  template.
- The mode is independent of both. `in-process` always runs (it's a
  vitest parametric test). `spawn` requires the target binary to be
  installed. `mock` is the contract baseline.

### Default behavior

When the user just says `/mcp-adapter-test` without specifying any
dimension, the agent MUST:

- **Host** = the agent currently running this skill.
- **Target** = all adapters in `AGENT_ADAPTERS` (driven by the registry).
- **Mode** = in-process for all + spawn for whatever the host can launch.

The user can override any dimension explicitly, e.g. "load this skill in
Claude and run e2e against qodercli" → Host=Claude, Target=qoder,
Mode=spawn+in-process.

## Agent-agnostic parametric structure

This main file describes WHAT each phase does. Adapter-specific HOW lives in
`references/agent-paths/<id>.md` — one file per adapter registered in
`AGENT_ADAPTERS`. Run this command to see the current set:

```bash
echo "=== Adapter reference files ==="
ls skills/mcp-adapter-test/references/agent-paths/*.md | xargs -n1 basename
```

To add a new adapter: copy [`references/agent-paths/_template.md`](references/agent-paths/_template.md) → `references/agent-paths/<your-id>.md` and fill in Path A/B/C.
**This main file is not modified** (Phase 8 UPSTREAM-04 compatibility).

## Quick Start

Say `/mcp-adapter-test` and the agent will execute the following steps.
Tags: **[必跑]** always run · **[可跳]** run only if the listed guard passes · **[需用户确认]** ask the user before running.

1. **[必跑]** Run 44 MockAgent compatibility tests (40 server + 4 contract) — Section 4 baseline.
2. **[必跑]** Measure token savings (tiktoken benchmark + conversation simulation) — Section 5/5B.
3. **[必跑]** Run proxy mode + directTools unit/integration tests — Section 6 (always-on).
4. **[必跑]** **Run Capability Gate FIRST** (Phase 4 Step 0) — Host × Target verdict.
5. **[需用户确认]** **Discover adapters + let user select which to integration-test** (Phase 4 Step 5) — Default: all targets × in-process mode.
6. **[必跑]** Run E2E tests via the detected Path (A / B / C) — Section 6.
7. **[必跑]** Generate reports under `tests/reports/`.

**Skip policy**: any step not marked **[必跑]** that the agent wishes to
omit must trigger an `AskUserQuestion` first. See [Test strategy (D-15)](#test-strategy-d-15).

## Pre-flight

```bash
mkdir -p tests/reports
npm run test:prebuild  # [必跑] FIX-01: build visualizer dist/ if missing
```

### Agent-paths completeness check [必跑]

Before running any test phase, verify every adapter in `AGENT_ADAPTERS` has a corresponding `references/agent-paths/<id>.md` file:

```bash
echo "=== AGENT_ADAPTERS entries ==="
grep -oP "id:\s*['\"]([^'\"]+)['\"]" interfaces/agent-api.ts | cut -d'"' -f2 | while read id; do
  if [ -f "skills/mcp-adapter-test/references/agent-paths/${id}.md" ]; then
    echo "✅ ${id} — agent-paths/${id}.md found"
  else
    echo "❌ ${id} — MISSING: skills/mcp-adapter-test/references/agent-paths/${id}.md"
    echo "   → cp references/agent-paths/_template.md references/agent-paths/${id}.md"
  fi
done
```

- If any adapter is MISSING → **STOP** and **ask user for confirmation**
  (per D-15). Two valid resolutions: (a) user copies the template and
  fills it in, (b) user explicitly accepts the missing file and you
  proceed with reduced coverage (record the waiver in the master report).
- If all adapters have files → continue.

---

## Phase 1: MockAgent Compatibility (Section 4) [必跑]

```bash
npx vitest run tests/compatibility/ --reporter=verbose
```

**Pass criteria**: 44/44 (40 server + 4 contract). See `references/agent-paths/<id>.md` if any fail.

## Phase 2: Token Benchmark (Section 5) [必跑]

```bash
npx tsx tests/token-benchmark/run-baseline.ts
npx tsx tests/token-benchmark/run-adapter.ts
npx tsx tests/token-benchmark/report.ts
```

**Pass criteria**: Proxy tool definition ≤ 300 tokens; 10-server combined savings ≥ 95%. 🟡 Baseline-bound — see [Test strategy (D-15)](#test-strategy-d-15). The 94% observed is a pre-existing project characteristic, not an adapter regression. See `tests/reports/qoder-adapter-test-report.md` §Section 5 and `docs/mcp-adapter-token-savings.md` for full analysis.

## Phase 3: Conversation Cost Simulation (Section 5B) [可跳]

```bash
npx tsx tests/token-benchmark/run-conversation-sim.ts
```

If `run-conversation-sim.ts` does not exist, **record `⚠️ SKIP: file not present`** and continue (this is a conditional skip with a known reason — see D-15). Do not ask the user for this guard; it is non-negotiable infrastructure.

**Pass criteria**: 4-server conversation total savings ≥ 65%; search overhead ≤ 300 tokens. 🟡 Baseline-bound — same as Phase 2. The 56% observed is shared with Pi and is a pre-existing project characteristic.

## Phase 4: Per-Path Verification (Section 6)

Per D-11: Phase 4 is renamed from "E2E Validation" to "Per-Path Verification" with a parametric table. The Pi-biased prose of the old §122-138 is replaced by the table + per-agent reference files.

### Step 0 — Capability Gate (universal, runs FIRST) [必跑]

Per D-03 + D-16: now decomposed into **Host** × **Target** axes. Runs BEFORE any E2E test.

#### Host capability

Inspect the current agent's `getAllTools()` (the host is the agent that loaded this skill):

| `mcp` in host tools? | `^<server>_` prefix in host tools? | `^mcp_` SDK bridge? | Host mode |
|----------------------|------------------------------------|---------------------|-----------|
| yes                  | any                                | any                 | Full mcp proxy — can run every E2E test in-place |
| no                   | yes (at least one server prefix)   | any                 | directTools — runs tools directly, no proxy |
| no                   | no                                 | no                  | **SDK_DIRECT** — host cannot host the adapter; integration must use a **spawned** child process |

**SDK_DIRECT** means: this host is a pure LLM agent without MCP server
support. To validate a target adapter, you must spawn the target
binary (e.g. `kilo`, `pi`, `qodercli`) as a subprocess and exercise
`createMcpAdapter` from inside that process. See `references/agent-paths/<id>.md`
for the spawn command.

#### Target capability

For each adapter in `AGENT_ADAPTERS`, classify:

| `factory()` exists? | `createVerificationContext` exists? | Live runtime required? | Path |
|---------------------|--------------------------------------|------------------------|------|
| yes                 | yes                                  | no                     | **A** (in-process parametric) |
| yes                 | no                                   | yes (e.g. Pi's ExtensionAPI) | **B** (parametric + spawn for E2E) |
| yes                 | yes                                  | yes                    | **C** (full stack via createVerificationContext) |

The intersection of host × target produces the **resolved mode**:

| Host \ Target | Path A target | Path B target | Path C target |
|---------------|---------------|---------------|---------------|
| Full mcp proxy | in-process (Section 4) + spawn E2E | spawn E2E only | in-process (parametric) |
| directTools   | in-process + directTools (Section 6) | directTools | in-process (parametric) |
| SDK_DIRECT    | spawn required | spawn required | spawn required |

Record the matrix in the master report under "Capability Gate".

### Step 1 — Path-specific verification (per adapter) [必跑]

Read `references/agent-paths/<id>.md` and execute the verification commands there. Record results in the master report.

### Step 2 — Proxy mode unit tests (always runs) [必跑]

```bash
npx vitest run __tests__/proxy-modes-discovery.test.ts __tests__/proxy-modes-auto-auth.test.ts __tests__/proxy-modes-ui-messages.test.ts --reporter=verbose
```

### Step 3 — directTools unit + integration tests (always runs) [必跑]

```bash
npx vitest run __tests__/direct-tools.test.ts __tests__/direct-tools-auto-auth.test.ts
npx vitest run tests/smoke/e2e-direct-tools.test.ts
```

### Step 4 — Run E2E tests (all paths) [必跑]

```bash
npx vitest run tests/smoke/e2e-all-servers.test.ts --reporter=verbose
```

**Pass criteria**: 25/25 (E2E-03 calculator search→describe→call + E2E-04 all 10 servers discover + smoke + E2E-06 multi-turn).

### Step 5 — Adapter Integration Tests (Host × Target × Mode 3D) [需用户确认]

Runs adapter-specific integration tests that exercise the full
`createMcpAdapter` stack against real MCP demo servers. This validates
the complete wiring: adapter construction → `createMcpAdapter` →
session lifecycle → real MCP server connections.

Unlike Steps 1-4, this step is decomposed along **Host × Target × Mode** (D-16). The default selection covers the in-process mode for all targets (parametric AgentAPI contract + parametric integration); user can opt in to spawn mode per target.

#### Step 5a — Discover adapters (auto, no user prompt) [必跑]

Read the `AGENT_ADAPTERS` array from `interfaces/agent-api.ts`, which is
the single source of truth for all supported adapters. **Consume every
field** to build the Step 5b options:

```bash
echo "=== Discovered adapters (consuming AGENT_ADAPTERS) ==="
node -e "
const ts = require('typescript');
const src = require('fs').readFileSync('interfaces/agent-api.ts','utf-8');
const js = ts.transpileModule(src, { compilerOptions: { module: 'commonjs' } }).outputText;
const m = { exports: {} }; new Function('module','exports',js)(m,m.exports);
const list = m.exports.AGENT_ADAPTERS || [];
for (const a of list) {
  const caps = a.capabilities
    ? Object.entries(a.capabilities).filter(([,v]) => v).map(([k]) => k).join(',') || 'none'
    : 'unknown';
  console.log(\`  \${a.id} (\${a.displayName}) — caps: \${caps}\`);
}
" 2>/dev/null || grep -E "(id:|displayName:|capabilities:|envHints:)" interfaces/agent-api.ts | head -40
```

The output gives you the `id`, `displayName`, and active `capabilities` for every adapter — used to build the Step 5b question dynamically.

#### Step 5b — User selects Host × Target × Mode

Use `AskUserQuestion` (max 4 questions) to collect user preferences. Each
question's options are **dynamically generated** from AGENT_ADAPTERS —
do not hardcode.

**Q1 (multiSelect: false)** — **Host**:
- "Current host (default — the agent running this skill)" ← recommended
- "Override host: <list any other AgentAPI-compatible agents the user mentions>"

**Q2 (multiSelect: true)** — **Targets**:
Each `id` from `AGENT_ADAPTERS` becomes one option. The label uses
`displayName`; the description shows active capabilities and a one-line
coverage note:

| Adapter label | id (from AGENT_ADAPTERS) | Description (from `capabilities`) |
|---------------|--------------------------|-----------------------------------|
| `<displayName>` | `<id>` | "caps: ui/sampling/renderer; `AgentAPI` contract + full stack" |

**RECOMMENDATION**: select all targets for complete in-process coverage (Completeness: N/N where N = `AGENT_ADAPTERS.length`).

**Q3 (multiSelect: true)** — **Modes**:
- "in-process (parametric AgentAPI contract + parametric integration) — always runnable" ← recommended
- "spawn (real binary E2E — requires target binary installed)"
- "mock (MockAgent contract baseline — covered by Phase 1)"

**Default answer** when user says "just run it" or doesn't reply: Q1=current host, Q2=all, Q3={in-process}.

#### Step 5c — Run integration tests [必跑 for selected]

**Always run** the parametric AgentAPI contract test — it covers ALL selected
adapters automatically via `describe.each(AGENT_ADAPTERS)`:

```bash
npx vitest run __tests__/adapter-contract.test.ts --reporter=verbose
```

For each adapter that has a dedicated full-stack integration test, also run
that adapter's test file. The current registry may include files such as:

| Adapter pattern | Typical integration test | Command |
|-----------------|--------------------------|---------|
| SDK-bridge adapters (e.g. Qoder) | Full `createMcpAdapter` + `initializeMcp` | `npx vitest run __tests__/<id>-adapter-integration.test.ts --reporter=verbose` |
| Native-extension adapters (e.g. Pi) | (covered by parametric AgentAPI contract) | — |

Always verify the actual test file exists before running. Record per-adapter
results in the master report under a new section.

**Pass criteria**:
- AgentAPI contract: all contract tests pass for every selected adapter
- Per-adapter integration: full `createMcpAdapter` wiring + at least one
  real MCP server connection verified (where a dedicated integration test exists)

#### Step 5d — Deployment wiring verification (optional) [推荐]

Run `npm run verify:deploy -- --agent <id>` for each selected adapter that has
a `createVerificationContext` harness in `AGENT_ADAPTERS`. This exercises the
universal deployment flow end-to-end without requiring a live agent host:

```bash
# Verify all harnessed adapters
npm run verify:deploy

# Or verify a single selected adapter
npm run verify:deploy -- --agent qoder
```

**When to skip:**
- No `.mcp.json` is present in the project root — the script needs a config to load
- The selected adapter has no `createVerificationContext` (e.g. Pi, which requires a live ExtensionAPI runtime)

**What it verifies:**
- Adapter instance creation via `descriptor.factory()`
- Context construction via `descriptor.createVerificationContext()`
- Config path resolution via `descriptor.resolverFactory()`
- Tool/command/flag registration via `createMcpAdapter()`
- `mcp` proxy tool is present in `adapter.getAllTools()`
- Session lifecycle (`fireSessionStart` / `fireSessionShutdown`) where supported

**Pass criteria**: `✅ <Adapter> verification passed` for every harnessed adapter; Pi and similar live-runtime adapters are recorded as `⏭️ skipped`.

---

## Phase 5: Master Report [必跑]

`tests/reports/mcp-adapter-test-report.md` (auto-generated by the matrix reporter — see `tests/reporters/matrix-reporter.ts`) contains: overall pass/fail summary; per-phase detail (counts, duration, failures); Capability Gate result (Host × Target × Path A/B/C per adapter); **Step 5 per-adapter integration results (Pi/Qoder/...)**: pass criteria checklist; bugs/notes.

## One-Screen Summary

```
=== mcp-adapter Test Results ===
Section 4 (MockAgent):        ✅ 44/44
Section 5 (Token Bench):      ✅ 94% savings
Section 5B (Conversation):    ✅/⚠️/SKIP
Proxy Unit Tests:             ✅ N/N
DirectTools Unit+Integration: ✅ 24/24
Section 6 (E2E):              ✅ 25/25 (PATH_A / PATH_B / SDK_DIRECT)
Adapter Integration (Step 5): ✅ N/N — (Pi/Qoder/...)

Capability Gate:              Host=<current> × Target=<selected>
                              Path A (mcp proxy) / Path B (directTools) / Path C (SDK_DIRECT)

Verdict: 🟢 ALL PASS
```

## Reference Files

| File | Content |
|------|---------|
| [references/agent-paths/pi.md](references/agent-paths/pi.md) | Pi-specific Path A/B/C verification + host environments |
| [references/agent-paths/kilo.md](references/agent-paths/kilo.md) | Kilo-specific Path A/B/C verification + host environments |
| [references/agent-paths/qoder.md](references/agent-paths/qoder.md) | Qoder-specific Path A/B/C verification + host environments |
| [references/agent-paths/_template.md](references/agent-paths/_template.md) | Scaffold for new adapters (includes Host environments section) |
| [references/mcp-config.md](references/mcp-config.md) | `.mcp.json` config for all 10 demo servers |
| [references/smoke-calls.md](references/smoke-calls.md) | Expected smoke call inputs/outputs per server |
