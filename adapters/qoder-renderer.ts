/**
 * Qoder-specific render helpers.
 *
 * Qoder's tool renderers are defined inline at the tool definition level
 * (via @qoder-ai/qoder-agent-sdk's tool() builder), so there is no
 * separate wrapper analogous to piRenderWrapper.
 *
 * This file exists per D-11 (file layout) and as a hook point for future
 * Qoder-specific render extensions. The current QoderAdapter does not use
 * a renderer wrapper.
 */

export type RenderOutput = string;

/**
 * Pass-through helper. Returns the raw string from the supplied renderer.
 *
 * Future implementations may wrap this in a Qoder-specific envelope if the
 * SDK adds a typed render output class.
 */
export function qoderRenderWrapper<T extends (...args: unknown[]) => RenderOutput>(
	fn: T,
): (...args: Parameters<T>) => RenderOutput {
	return (...args: Parameters<T>) => fn(...args);
}
