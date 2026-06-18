# mcp-adapter Skills

Project-level Agent Skills. Copy a skill to your agent's skills discovery directory, then trigger it with the prompt.

## Available Skills

### `mcp-adapter-test` — Integration Test Suite

Runs the full mcp-adapter integration test plan: MockAgent compatibility + Token benchmark + E2E validation across all 10 demo MCP servers.

**Prompt**:

execute: 1. Copy `skills/mcp-adapter-test` to your agent's skills directory 2. Run Skill `/mcp-adapter-test`

**Coverage**:

| Phase | Content | Cases |
|-------|---------|-------|
| Phase 1 | MockAgent compatibility | 44 |
| Phase 2 | Token efficiency benchmark | static |
| Phase 3 | Conversation cost simulation (5B) | static |
| Phase 4 | E2E SDK direct validation | 25 |

**Output**: All test reports under `tests/reports/`.

## Adding a New Skill

1. Create a directory under `skills/` with a `SKILL.md` file
2. Add a row to this README

See [Qoder Skill docs](https://docs.qoder.dev/skills) for authoring conventions.
