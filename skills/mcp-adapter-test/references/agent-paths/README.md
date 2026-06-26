# ⚠️ DEPRECATED — replaced by skills/mcp-adapter/references/resolver.md

This directory (`skills/mcp-adapter-test/references/agent-paths/`) is **deprecated**
as of Phase 11 (2026-06-26). Per-agent path resolution is now unified in
[`skills/mcp-adapter/references/resolver.md`](../../mcp-adapter/references/resolver.md),
which dynamically discovers paths from `AGENT_ADAPTERS` in `interfaces/agent-api.ts`.

**Why this exists**: backward compatibility for the deprecated skills
(`deploy-mcp-adapter`, `generate-mcp-config`, `mcp-adapter-test`).

**What to use instead**: `/mcp-adapter` skill → references/resolver.md.

**When this will be removed**: 2 version cycles after Phase 11 (v2.11+).
