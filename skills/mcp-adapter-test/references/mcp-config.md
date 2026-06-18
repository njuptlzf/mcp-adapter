# .mcp.json — 10 Demo MCP Servers

Create this file at project root if it does not exist. It IS in `.gitignore` (agent-generated, not project source).

```json
{
  "mcpServers": {
    "calculator":     { "command": "npx", "args": ["tsx", "tests/demo-servers/01-calculator/server.ts"] },
    "string-utils":   { "command": "npx", "args": ["tsx", "tests/demo-servers/02-string-utils/server.ts"] },
    "datetime":       { "command": "npx", "args": ["tsx", "tests/demo-servers/03-datetime/server.ts"] },
    "unit-converter": { "command": "npx", "args": ["tsx", "tests/demo-servers/04-unit-converter/server.ts"] },
    "json-tools":     { "command": "npx", "args": ["tsx", "tests/demo-servers/05-json-tools/server.ts"] },
    "markdown":       { "command": "npx", "args": ["tsx", "tests/demo-servers/06-markdown/server.ts"] },
    "file-stats":     { "command": "npx", "args": ["tsx", "tests/demo-servers/07-file-stats/server.ts"] },
    "http-mock":      { "command": "npx", "args": ["tsx", "tests/demo-servers/08-http-mock/server.ts"] },
    "kv-store":       { "command": "npx", "args": ["tsx", "tests/demo-servers/09-kv-store/server.ts"] },
    "text-analyzer":  { "command": "npx", "args": ["tsx", "tests/demo-servers/10-text-analyzer/server.ts"] }
  }
}
```
