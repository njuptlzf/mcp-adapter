# Deferred Items — Phase 07

Items discovered during Phase 07 plan execution that are out of scope for the
current plan and should be picked up by a later plan, wave, or human action.

## Pre-existing failures unrelated to Phase 07

### `__tests__/interactive-visualizer-server.test.ts` (pre-existing)

- **Found during:** Plan 07-01 full-suite verification after Task 3.
- **Symptom:** Two test cases fail with `ENOENT: no such file or directory`
  when reading:
  - `examples/interactive-visualizer/dist/app.html`
  - `examples/interactive-visualizer/dist/server.js`
- **Verified pre-existing:** Both failures reproduce on a clean stash of
  the Task 3 working tree (i.e. with `interfaces/agent-api.ts`,
  `__tests__/adapter-contract.test.ts`, and
  `__tests__/compatibility/legacy-pi-mock.test.ts` reverted to their
  Task 2 state) — the failures are not caused by Phase 07 changes.
- **Likely resolution owner:** Plan 07-02 or 07-04 (the visualizer example
  build target), or a manual `pnpm/npm` script that materializes the
  `examples/interactive-visualizer/dist/` artifacts before running tests.
- **Action taken:** None (out of scope per executor SCOPE BOUNDARY).
