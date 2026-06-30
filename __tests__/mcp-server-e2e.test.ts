/**
 * E2E test for the universal MCP stdio server (bin/mcp-server.ts).
 *
 * D-13: Dual-layer testing — this is the E2E layer (subprocess + real MCP
 * Client). The unit layer (in-process, Mock MCP Client) is covered by:
 *   - __tests__/protocol-sampling-forwarder.test.ts
 *   - __tests__/protocol-elicitation-forwarder.test.ts
 *
 * This test spawns bin/mcp-server.ts as a child process via
 * StdioClientTransport, connects a real MCP Client, and verifies:
 *   1. Tool listing — the "mcp" proxy tool is registered (D-08)
 *   2. Tool calling — the "mcp" proxy tool executes and returns content
 *   3. Sampling capability — server accepts client declaring sampling (D-06)
 *
 * Threat model:
 *   T-12-12 (Denial of Service): 15s per-test timeout; subprocess killed in
 *     afterEach/finally; avoids hanging if the server fails to start.
 *   T-12-13 (Information Disclosure): stderr captured for debugging only;
 *     not logged to CI output beyond test failure messages.
 */

import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Path to the universal MCP stdio server script. */
const SERVER_SCRIPT = "bin/mcp-server.ts";

/** Per-test timeout: subprocess spawn + MCP handshake takes time (T-12-12). */
const E2E_TIMEOUT = 15000;

interface SpawnedServer {
	client: Client;
	transport: StdioClientTransport;
}

/**
 * Spawn bin/mcp-server.ts as a subprocess and connect a real MCP Client.
 *
 * The client declares sampling + elicitation.form capabilities so the server
 * can inject protocol forwarders (D-06/D-07/D-11). All test cases use this
 * helper — test 3 explicitly verifies the capability declaration is accepted.
 *
 * @param configPath Optional --config path override
 * @returns { client, transport } — transport manages the subprocess lifecycle
 */
async function spawnServer(configPath?: string): Promise<SpawnedServer> {
	const args = ["tsx", SERVER_SCRIPT];
	if (configPath) {
		args.push("--config", configPath);
	}

	const serverParams: StdioServerParameters = {
		command: "npx",
		args,
		stderr: "pipe", // T-12-13: capture stderr, don't inherit to parent
		cwd: process.cwd(),
	};

	const transport = new StdioClientTransport(serverParams);

	// Capture stderr for debugging — available immediately per SDK docs.
	// Not asserted on; purely for diagnostics on test failure.
	transport.stderr?.on("data", (chunk: Buffer) => {
		// Intentionally no-op: stderr is piped to prevent parent pollution.
		// If a test fails, the captured data can be inspected via the stream.
		void chunk;
	});

	// Declare sampling + elicitation.form capabilities (D-13).
	// This triggers ProtocolSamplingForwarder + ProtocolElicitationForwarder
	// injection in bin/mcp-server.ts after the MCP handshake completes.
	const client = new Client(
		{ name: "e2e-test-client", version: "1.0.0" },
		{
			capabilities: {
				sampling: {},
				elicitation: { form: {} },
			},
		},
	);

	await client.connect(transport);
	return { client, transport };
}

describe("bin/mcp-server.ts E2E", () => {
	let transport: StdioClientTransport | undefined;

	afterEach(async () => {
		// T-12-12: ensure subprocess is killed even on test failure
		try {
			await transport?.close();
		} catch {
			// transport may already be closed — safe to ignore
		}
		transport = undefined;
	});

	it(
		"lists tools including mcp proxy tool",
		async () => {
			const spawned = await spawnServer();
			transport = spawned.transport;

			const { tools } = await spawned.client.listTools();
			expect(tools).toBeDefined();
			expect(Array.isArray(tools)).toBe(true);
			expect(tools!.length).toBeGreaterThan(0);

			// D-08: the universal server exposes the "mcp" proxy tool
			const mcpTool = tools!.find((t) => t.name === "mcp");
			expect(mcpTool).toBeDefined();
			expect(mcpTool!.description).toBeTruthy();
			expect(mcpTool!.inputSchema).toBeDefined();
			expect(mcpTool!.inputSchema.type).toBe("object");
		},
		E2E_TIMEOUT,
	);

	it(
		"executes mcp proxy tool and returns content",
		async () => {
			const spawned = await spawnServer();
			transport = spawned.transport;

			// Call the "mcp" proxy tool with no arguments — defaults to status action.
			// Returns "MCP not initialized" if init hasn't completed, or a JSON
			// status object if it has. Both are acceptable — the key is that the
			// tool executes and returns content without crashing (D-08).
			const result = await spawned.client.callTool({
				name: "mcp",
				arguments: {},
			});

			expect(result.content).toBeDefined();
			expect(Array.isArray(result.content)).toBe(true);
			expect(result.content!.length).toBeGreaterThan(0);

			const firstBlock = result.content![0] as { type: string; text: string };
			expect(firstBlock.type).toBe("text");
			expect(typeof firstBlock.text).toBe("string");
			expect(firstBlock.text.length).toBeGreaterThan(0);
		},
		E2E_TIMEOUT,
	);

	it(
		"server accepts sampling capability declaration without crashing",
		async () => {
			// The client declares sampling + elicitation.form capabilities in
			// spawnServer(). If the server couldn't handle these capabilities,
			// the connection would fail or the server would crash. This test
			// verifies the server starts and is responsive after accepting the
			// capability declaration (D-06/D-07/D-11).
			//
			// Full sampling forwarding E2E requires a downstream server that
			// requests sampling, which is complex — this test verifies the server
			// starts and accepts the capability declaration without crashing.
			const spawned = await spawnServer();
			transport = spawned.transport;

			// Connection succeeded (no error thrown) — verify server is responsive.
			const { tools } = await spawned.client.listTools();
			expect(tools).toBeDefined();
			expect(tools!.some((t) => t.name === "mcp")).toBe(true);
		},
		E2E_TIMEOUT,
	);
});
