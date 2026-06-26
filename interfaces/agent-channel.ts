/**
 * Universal bidirectional communication channel between an adapter and its
 * host agent session.
 *
 * Each adapter provides `attachChannel(channel)` / `detachChannel()` as
 * companion methods (NOT part of `AgentAPI`). This normalizes the "live
 * session" attachment across adapters — the host creates a channel that
 * wraps SDK-specific session handles (Qoder's `Query`, Kilo's callback,
 * Pi's `ExtensionAPI`) into a uniform shape.
 *
 * Design notes:
 *  - `send` is the adapter → agent direction (mirrors `AgentAPI.sendMessage`).
 *  - `close` is optional — some channels (Pi) are managed externally.
 *  - When no channel is attached, `sendMessage` falls back to the adapter's
 *    legacy companion method (`attachQuery`, `attachSendMessage`) or buffers.
 *  - Legacy companion methods remain for backward compatibility; new host
 *    code SHOULD use `attachChannel` / `detachChannel` instead.
 */
export interface AgentChannel {
	/**
	 * Send a message from the adapter into the active agent session.
	 * Parameters mirror `AgentAPI.sendMessage` (D-01: `unknown` types).
	 */
	send(message: unknown, options?: unknown): void | Promise<void>;

	/** Close the channel and release any underlying resources. */
	close?(): void | Promise<void>;
}
