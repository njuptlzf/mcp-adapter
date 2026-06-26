# Server Templates

Common MCP server configuration templates for quick reference.

## Stdio Servers

### Basic npx server (lazy)

```json
{
  "my-server": {
    "command": "npx",
    "args": ["-y", "some-mcp-server"],
    "lifecycle": "lazy"
  }
}
```

### npx server with environment variables

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "${GITHUB_TOKEN}"
    },
    "lifecycle": "lazy"
  }
}
```

### Local Node.js server

```json
{
  "local-tool": {
    "command": "node",
    "args": ["/absolute/path/to/server.js"],
    "cwd": "/path/to/working/dir"
  }
}
```

### Python server (uv)

```json
{
  "python-server": {
    "command": "uv",
    "args": ["run", "mcp-server.py"],
    "cwd": "~/projects/my-mcp-server"
  }
}
```

### TypeScript server (tsx)

```json
{
  "ts-server": {
    "command": "npx",
    "args": ["tsx", "src/server.ts"]
  }
}
```

### Docker-based server

```json
{
  "docker-server": {
    "command": "docker",
    "args": ["run", "--rm", "-i", "-e", "API_KEY", "my-mcp-image:latest"],
    "env": {
      "API_KEY": "${MY_API_KEY}"
    }
  }
}
```

## HTTP Servers

### Basic HTTP (no auth)

```json
{
  "remote-server": {
    "url": "https://example.com/mcp",
    "lifecycle": "lazy"
  }
}
```

### HTTP with Bearer token

```json
{
  "api-server": {
    "url": "https://api.example.com/mcp",
    "auth": "bearer",
    "bearerToken": "${API_TOKEN}"
  }
}
```

### HTTP with Bearer token from env

```json
{
  "api-server": {
    "url": "https://api.example.com/mcp",
    "auth": "bearer",
    "bearerTokenEnv": "API_TOKEN"
  }
}
```

### HTTP with OAuth (authorization code)

```json
{
  "oauth-server": {
    "url": "https://api.example.com/mcp",
    "auth": "oauth",
    "oauth": {
      "grantType": "authorization_code",
      "clientId": "my-client-id",
      "clientSecret": "${CLIENT_SECRET}",
      "scope": "read write",
      "redirectUri": "http://localhost:3118/callback",
      "clientName": "My MCP App",
      "clientUri": "https://myapp.com"
    },
    "lifecycle": "keep-alive"
  }
}
```

### HTTP with OAuth (client credentials — machine-to-machine)

```json
{
  "m2m-server": {
    "url": "https://api.example.com/mcp",
    "auth": "oauth",
    "oauth": {
      "grantType": "client_credentials",
      "clientId": "machine-client-id",
      "clientSecret": "${CLIENT_SECRET}",
      "scope": "api.read"
    }
  }
}
```

### HTTP with OAuth (dynamic registration — no clientId)

```json
{
  "dynamic-oauth-server": {
    "url": "https://api.example.com/mcp",
    "auth": "oauth",
    "oauth": {
      "scope": "read"
    }
  }
}
```

### HTTP with custom headers

```json
{
  "custom-auth-server": {
    "url": "https://api.example.com/mcp",
    "headers": {
      "X-API-Key": "${API_KEY}",
      "X-Client-Version": "1.0.0"
    }
  }
}
```

## Lifecycle Modes

| Mode | When to connect | When to disconnect | Use case |
|------|-----------------|-------------------|----------|
| `lazy` (default) | First tool call | After idle timeout (default 10 min) | Most servers — saves resources |
| `eager` | At session start | Never auto-reconnect | Servers needed immediately, but ok if they drop |
| `keep-alive` | At session start | Never (auto-reconnect on drop) | Critical servers always needed |

```json
{
  "critical-server": {
    "command": "npx",
    "args": ["-y", "critical-mcp"],
    "lifecycle": "keep-alive"
  },
  "on-demand-server": {
    "command": "npx",
    "args": ["-y", "on-demand-mcp"],
    "lifecycle": "lazy",
    "idleTimeout": 5
  },
  "startup-server": {
    "command": "npx",
    "args": ["-y", "startup-mcp"],
    "lifecycle": "eager"
  }
}
```

## Direct Tools Patterns

### All tools as direct

```json
{
  "figma": {
    "url": "http://localhost:3845/mcp",
    "directTools": true
  }
}
```

### Specific tools as direct

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "directTools": ["search_repositories", "get_file_contents"]
  }
}
```

### Direct tools with exclusions

```json
{
  "figma": {
    "url": "http://localhost:3845/mcp",
    "directTools": true,
    "excludeTools": ["get_figjam", "figma_get_code_connect_map"]
  }
}
```

### Global direct tools with per-server override

```json
{
  "settings": {
    "directTools": true
  },
  "mcpServers": {
    "all-direct": {
      "command": "npx",
      "args": ["-y", "small-server"]
    },
    "proxy-only": {
      "command": "npx",
      "args": ["-y", "huge-server"],
      "directTools": false
    }
  }
}
```

## Debug Mode

```json
{
  "debug-server": {
    "command": "npx",
    "args": ["-y", "some-mcp-server"],
    "debug": true
  }
}
```

`debug: true` shows server stderr output — useful for troubleshooting connection issues.

## Resource Handling

```json
{
  "server-with-resources": {
    "command": "npx",
    "args": ["-y", "resource-server"],
    "exposeResources": true
  },
  "server-no-resources": {
    "command": "npx",
    "args": ["-y", "tool-only-server"],
    "exposeResources": false
  }
}
```

`exposeResources: true` (default) exposes MCP resources as tools. Set to `false` to hide resources.
