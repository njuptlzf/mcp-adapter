# Deferred Items — Phase 05 Type Decoupling & Entry Point Refactor

## Out-of-Scope Discoveries

### 1. `__tests__/interactive-visualizer-server.test.ts` failures

- **Files:** `__tests__/interactive-visualizer-server.test.ts`
- **Status:** Pre-existing / unrelated to 05-03
- **Description:** Two tests fail because `examples/interactive-visualizer/dist/app.html` and `examples/interactive-visualizer/dist/server.js` do not exist. The test expects built artifacts that are not present in the workspace.
- **Action:** No action taken as part of 05-03. Likely requires a build step for the interactive-visualizer example or updated test fixtures.
- **Verification:** `npx vitest run __tests__/interactive-visualizer-server.test.ts` reproduces the failures.

## Notes

- No other deferred issues discovered during 05-03 execution.
