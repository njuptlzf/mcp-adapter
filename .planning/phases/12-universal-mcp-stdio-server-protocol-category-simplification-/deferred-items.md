# Deferred Items — Phase 12

## Stale upstream:check entries (deferred to Plan 12-05)

**Discovered during:** Plan 12-04, Task 2 (full verification suite)

**Issue:** `npm run upstream:check` exits 1 with 5 stale registry entries in
`skills/upstream-merge/references/special-cases.md`. These entries reference
files that were deleted in Plan 12-03 (D-04/D-05/D-09/D-10):

| Stale Entry | Reason | Plan 03 Action |
|-------------|--------|----------------|
| `adapters/kilo-adapter.ts` | File deleted | D-04: per-agent adapter deleted |
| `adapters/qoder-adapter.ts` | File deleted | D-04: per-agent adapter deleted |
| `adapters/store-adapter.ts` | File deleted | D-04: base class deleted |
| `bin/kilo-mcp-server.ts` | File deleted (renamed) | D-05: renamed to bin/mcp-server.ts |
| `bin/qoder-mcp-bridge.ts` | File deleted | D-04/D-10: bridge deleted |

**Fix for Plan 12-05:** Remove these 5 rows from the special-cases registry.
Also add new fork-only entries for files created in Phase 12:
- `bin/mcp-server.ts` (replaces `bin/kilo-mcp-server.ts`)
- `adapters/protocol-sampling-forwarder.ts` (new, D-06)
- `adapters/protocol-elicitation-forwarder.ts` (new, D-07)
- `__tests__/fixtures/mock-mcp-client.ts` (new, D-13)
- `__tests__/mcp-server-e2e.test.ts` (new, D-13)

Also update the `package.json` registry row description — it currently mentions
`kilo-mcp-server`/`qoder-mcp-bridge` bin entries which no longer exist (D-10
reduced bin to `pi-mcp-adapter` + `mcp-server`).

**Plan 12-04 acceptance criteria explicitly allows this deferral:**
"npm run upstream:check exits 0 (or documents stale entries for Plan 05 to fix)"
