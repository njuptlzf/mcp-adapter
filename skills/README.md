# mcp-adapter Skills

Project-level Agent Skills. Copy a skill to your agent's skills discovery directory, then trigger it with the prompt.

## Available Skills

### `mcp-adapter` — Universal Agent Integration

Single entry point for deploying mcp-adapter into any MCP-compatible coding agent: agent discovery (Phase 0), config generation (Phase 1), adapter deployment (Phase 2), and verification (Phase 3). Replaces the deleted `deploy-mcp-adapter`, `generate-mcp-config`, and `mcp-adapter-test` skills.

**Prompt**:

execute: 1. Copy `skills/mcp-adapter` to your agent's global skills directory 2. Run Skill `/mcp-adapter`

**Flow**: Discover target agent + verify MCP compatibility → Generate mcp.json (global or project) → Deploy adapter → Verify

**References**: `references/resolver.md` (agent discovery + config path resolution), `references/generate.md` (config), `references/deploy.md` (deployment), `references/verify.md` (testing), `references/deploy-examples.md` (code templates)

---

### `upstream-merge` — Fork Sync & Conflict Resolution

Fork-maintainer workflow for syncing upstream `pi-mcp-adapter` into this fork. Reads hand-curated special cases, runs live divergence check, applies per-file resolution matrix, and delegates conflict resolution to the `resolve-conflicts` skill.

**Prompt**:

execute: 1. Copy `skills/upstream-merge` AND `skills/resolve-conflicts` to your agent's global skills directory 2. Run Skill `/upstream-merge`

**Flow**: Run divergence check → Read special cases → Apply resolution matrix → Execute merge → Delegate conflicts to `/resolve-conflicts` → Validate with §5 Checklist

**Dependencies**: Requires `skills/resolve-conflicts` (professional conflict resolution framework). Both skills must be copied together.

**References**: `references/special-cases.md` (hand-curated file resolutions), `references/pi-coupling-markers.md` (Pi coupling detection patterns)

---

### `resolve-conflicts` — Professional Git Conflict Resolution

Plan-first conflict resolution framework with 7 conflict type patterns (imports, tests, generated files, config, code logic, structs, deleted-modified), decision tracking, validation scripts, and user approval flow.

**Prompt**:

execute: 1. Copy `skills/resolve-conflicts` to your agent's global skills directory 2. Run Skill `/resolve-conflicts` when merge conflicts occur

**Flow**: Assess conflicts → Create resolution plan → Get user approval → Execute resolution → Validate → Compile & test

**References**: `references/patterns.md` (comprehensive conflict examples), `references/sample-plan.md` (example resolution plan), `scripts/handle-deleted-modified.sh`, `scripts/validate-conflicts.sh`

## Skill Usage Order

```
/mcp-adapter
  Phase 0: Discover target agent + verify MCP compatibility
  Phase 1: Generate mcp.json config (global or project scope)
  Phase 2: Deploy adapter into target agent
  Phase 3: Verify deployment
```

## Adding a New Skill

1. Create a directory under `skills/` with a `SKILL.md` file
2. Add a row to this README

See [Qoder Skill docs](https://docs.qoder.dev/skills) for authoring conventions.
