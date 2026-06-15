# mcp-adapter test scenarios

## mcp-compat-tester
description: Run the adaptability test suite (MockAgent) to verify that all 10 demo servers can search/call properly
rules:
  - Run `npx vitest run tests/compatibility/`
  - Output compatibility-report.md
triggers: ["run compat tests"]

## token-benchmark-runner
description: Execute token efficiency benchmark (static measurement, no real LLM calls)
rules:
  - Run `npx ts-node tests/token-benchmark/run-baseline.ts`
  - Run `npx ts-node tests/token-benchmark/run-adapter.ts`
  - Run `npx ts-node tests/token-benchmark/report.ts`
  - Output benchmark-report.md
triggers: ["benchmark tokens"]

## e2e-smoke-tester
description: End-to-end smoke test of all 10 demo servers using MockAgent
rules:
  - Start each demo server in turn, invoke search + call via mcp-adapter
  - Verify results are correct, record pass/fail
triggers: ["smoke test"]

## direct-tools-tester
description: |
  Verify directTools mode: mount calculator server with directTools=true,
  confirm tools register individually (not through mcp proxy).
rules:
  - Verify that calculator server tools (add, subtract, multiply, divide, power, sqrt) appear as individual tools
  - Confirm that individual tools can be called directly without going through mcp proxy
  - Write result to tests/reports/direct-tools-report.md
triggers: ["test direct tools mode"]

## multi-turn-tester
description: |
  Validate multi-turn conversation: use mcp-adapter over multiple turns
  to complete a task requiring chaining two different MCP servers.
rules:
  - Turn 1: calculate 2^8 using calculator server → expect 256
  - Turn 2: convert 256 cm to meters using unit-converter → expect 2.56
  - Write transcript to tests/reports/multi-turn-report.md
triggers: ["multi-turn test"]