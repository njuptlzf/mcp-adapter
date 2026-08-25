/**
 * Type shims for the Pi host API surface that the npm-published
 * `@earendil-works/pi-*` packages (0.84.x) fail to expose at their top-level
 * entry points.
 *
 * Root cause (diagnosed 2026-08): the published `.d.ts` files re-export from
 * `.ts` specifiers (e.g. `export { X } from "./tui.ts"`), but the tarballs ship
 * only `.js` + `.d.ts` (no `.ts` source). Under `moduleResolution: NodeNext`
 * those specifiers do not resolve, and `skipLibCheck` hides the internal error,
 * so the re-exported symbols surface to consumers as "has no exported member".
 *
 * These `declare module` augmentations re-declare only the members the adapter
 * actually references, so `tsc --noEmit` can pass against npm types. This is a
 * fork-owned independent file — it does NOT modify upstream source.
 */

declare module "@earendil-works/pi-tui" {
	// `Component` and `OverlayHandle` are declared in dist/tui.d.ts but dropped
	// by the broken `from "./tui.ts"` re-export in dist/index.d.ts.
	export interface Component {
		render(width: number): string[];
		handleInput?(data: string): void;
	}
	export interface OverlayHandle {
		setHidden(hidden: boolean): void;
		focus(): void;
	}
	// `KeyId` is declared in dist/keys.d.ts but dropped by `from "./keys.ts"`.
	export type KeyId = string;

	// `Text` resolves, but its method surface is lost through the same broken
	// re-export chain; re-declare the instance methods the renderer relies on.
	interface Text {
		render(width: number): string[];
		invalidate(): void;
		setText(text: string): void;
		setCustomBgFn(customBgFn?: (text: string) => string): void;
	}
}

declare module "@earendil-works/pi-ai" {
	// Dropped from the top-level `from "..."` re-export chain.
	export type ProviderHeaders = Record<string, string | null>;
}

declare module "@earendil-works/pi-coding-agent" {
	// dist/utils/clipboard.ts declares `copyToClipboard(text): Promise<void>`,
	// but the top-level `from "./utils/clipboard.ts"` re-export is dropped.
	export function copyToClipboard(text: string): Promise<void>;

	// `ExtensionCommandContext` lives in core/extensions/types.d.ts but is not
	// re-exported at the top level. The command handlers only rely on `reload`
	// beyond the base `ExtensionContext`, so re-surface it as a minimal union
	// against the (correctly exported) `ExtensionContext`.
	export type ExtensionCommandContext = ExtensionContext & {
		reload(): Promise<void>;
	};

	// The top-level re-export chain also drops `ExtensionUIcontext`,
	// `ExtensionAPI`, and `ExtensionContext` to `any`, which — because the
	// .d.ts declares them once but consumers see `any` — leaves every callback
	// (`ctx.ui.custom(...)`, `pi.on(...)`, `pi.registerCommand({handler})`)
	// without contextual parameter types (TS7006). Re-declare the members the
	// adapter actually invokes so tsc can infer the callback parameters.
	interface ExtensionUIContext {
		custom<T = unknown>(
			factory: (...args: any[]) => unknown,
			options?: unknown,
		): Promise<T>;
	}

	interface ExtensionAPI {
		on(event: string, handler: (...args: any[]) => unknown): void;
		registerCommand(
			name: string,
			options: { handler: (...args: any[]) => unknown } & Record<string, unknown>,
		): void;
	}
}

declare module "@earendil-works/pi-ai" {
	// `AssistantMessage.content` is dropped to `any` by the same broken
	// re-export chain; give its elements a minimal shape so `.map()` /
	// `.filter()` callback parameters are inferred (TS7006).
	interface AssistantMessage {
		content: Array<{ type: string; text?: string }>;
	}
}