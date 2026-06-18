# Smoke Calls Reference (E2E-04)

Expected results for each demo MCP server's smoke call. Used by Path A (mcp proxy) and E2E-04 validation.

| Server | Tool | Args | Expected |
|--------|------|------|----------|
| calculator | add | `{"a":3,"b":4}` | "7" |
| string-utils | upper | `{"text":"hello"}` | "HELLO" |
| datetime | now | `{}` | ISO date |
| unit-converter | length | `{"value":1,"from":"m","to":"cm"}` | "100" |
| json-tools | parse | `{"json":"{\"x\":1}"}` | "x" |
| markdown | word_count | `{"text":"hello world"}` | "2" |
| file-stats | line_count | `{"text":"a\nb\nc"}` | "3" |
| http-mock | get | `{"url":"https://example.com"}` | no "error" |
| kv-store | set | `{"key":"k","value":"v"}` | no "error" |
| text-analyzer | sentiment | `{"text":"I love this"}` | "positive" |
