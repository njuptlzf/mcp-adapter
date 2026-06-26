# mcp-adapter Skills

Project-level Agent Skills. Copy a skill to your agent's skills discovery directory, then trigger it with the prompt.

## Available Skills

### `deploy-mcp-adapter` — Deploy mcp-adapter into Any Agent

Universal deployment guide for installing mcp-adapter into any coding agent. Checks `AGENT_ADAPTERS` registry for built-in support (currently Pi, Qoder), guides `AgentAPI` implementation for unsupported agents.

**Prompt**:

execute: 1. Copy `skills/deploy-mcp-adapter` to your agent's global skills directory 2. Run Skill `/deploy-mcp-adapter`

**Flow**: Install package → Identify agent → Check AGENT_ADAPTERS → Deploy with built-in or custom adapter → Verify

**References**: `references/adapter-implementation.md` (AgentAPI 8-method implementation guide)

---

### `generate-mcp-config` — Generate mcp.json Config Files

Generates `mcp.json` configuration files for any mcp-adapter compatible agent. Creates global or project-level configs with correct paths, server entries, settings, and imports.

**Prompt**:

execute: 1. Copy `skills/generate-mcp-config` to your agent's global skills directory 2. Run Skill `/generate-mcp-config`

**Flow**: Identify agent → Determine scope (global/project) → Generate JSON → Validate

**References**: `references/server-templates.md` (stdio/HTTP/OAuth templates), `references/config-schema.md` (full field reference)

---

### `mcp-adapter-test` — Integration Test Suite

Runs the full mcp-adapter integration test plan: MockAgent compatibility + Token benchmark + E2E validation across all 10 demo MCP servers.

**Prompt**:

execute: 1. Copy `skills/mcp-adapter-test` to your agent's global skills directory 2. Run Skill `/mcp-adapter-test` 3. Delete Skill `/mcp-adapter-test`

**Coverage**:

| Phase | Content | Cases |
|-------|---------|-------|
| Phase 1 | MockAgent compatibility | 44 |
| Phase 2 | Token efficiency benchmark | static |
| Phase 3 | Conversation cost simulation (5B) | static |
| Phase 4 | E2E SDK direct validation | 25 |

**Output**: All test reports under `tests/reports/`.

---

### `upstream-merge` — Fork Sync & Conflict Resolution

Fork-maintainer workflow for syncing upstream `pi-mcp-adapter` into this fork. Reads hand-curated special cases, runs live divergence check, applies per-file resolution matrix, and triggers follow-up issue flow when Pi-coupling is re-introduced.

**Prompt**:

execute: 1. Copy `skills/upstream-merge` to your agent's global skills directory 2. Run Skill `/upstream-merge`

**Flow**: Run divergence check → Read special cases → Apply resolution matrix → Execute merge → Follow-up issues

**References**: `references/special-cases.md` (hand-curated file resolutions), `references/upstream-divergence-matrix.md` (12-category default rules)

## Skill Usage Order

```
deploy-mcp-adapter  →  generate-mcp-config  →  mcp-adapter-test
   Install adapter        Create mcp.json         Run integration tests
```

## Adding a New Skill

1. Create a directory under `skills/` with a `SKILL.md` file
2. Add a row to this README

See [Qoder Skill docs](https://docs.qoder.dev/skills) for authoring conventions.
