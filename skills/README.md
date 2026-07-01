# mcp-adapter Skills

Project-level Agent Skills. Copy a skill to your agent's skills discovery directory, then trigger it with the prompt.

## Available Skills

### `mcp-adapter` — Universal Agent Integration

Single entry point for all mcp-adapter workflows: config generation (Phase 1), adapter deployment (Phase 2), and verification (Phase 3). Replaces the deleted `deploy-mcp-adapter`, `generate-mcp-config`, and `mcp-adapter-test` skills.

**Prompt**:

execute: 1. Copy `skills/mcp-adapter` to your agent's global skills directory 2. Run Skill `/mcp-adapter`

**Flow**: Identify agent + capability-gate → Generate mcp.json → Deploy adapter → Verify

**References**: `references/resolver.md` (dynamic path resolution), `references/generate.md` (config), `references/deploy.md` (deployment), `references/verify.md` (testing), `references/deploy-examples.md` (code templates)

---

### `upstream-merge` — Fork Sync & Conflict Resolution

Fork-maintainer workflow for syncing upstream `pi-mcp-adapter` into this fork. Reads hand-curated special cases, runs live divergence check, applies per-file resolution matrix, and triggers follow-up issue flow when Pi-coupling is re-introduced.

**Prompt**:

execute: 1. Copy `skills/upstream-merge` to your agent's global skills directory 2. Run Skill `/upstream-merge`

**Flow**: Run divergence check → Read special cases → Apply resolution matrix → Execute merge → Follow-up issues

**References**: `references/special-cases.md` (hand-curated file resolutions), `references/pi-coupling-markers.md` (Pi coupling detection patterns)

## Skill Usage Order

```
/mcp-adapter
  Phase 0: Identify agent + capability-gate
  Phase 1: Generate mcp.json config
  Phase 2: Deploy adapter into target agent
  Phase 3: Verify deployment
```

## Adding a New Skill

1. Create a directory under `skills/` with a `SKILL.md` file
2. Add a row to this README

See [Qoder Skill docs](https://docs.qoder.dev/skills) for authoring conventions.
