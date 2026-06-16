/**
 * Pi-specific adapter that implements the generic `AgentAPI` /
 * `AgentContext` / `UISystem` interfaces on top of Pi's `ExtensionAPI`.
 *
 * Strategy (D-07, D-08): direct pass-through. Each method on the adapter
 * delegates to the corresponding `ExtensionAPI` method, with a thin
 * conversion layer for `ExtensionContext` and `ExtensionUIContext`.
 *
 * Optional UI members (form, custom, theme) are detected at runtime and
 * exposed only when present, so adapters targeting other agents can reuse
 * the same `UISystem` contract.
 */

import type {
	ExtensionAPI,
	ExtensionContext,
	ExtensionUIContext,
	ModelRegistry,
} from "@earendil-works/pi-coding-agent";
import type {
	AgentAPI,
	AgentContext,
	CommandConfig,
	FlagConfig,
	ToolInfo,
	ToolRegistration,
	UISystem,
} from "../interfaces/agent-api.ts";
import { PiSamplingProvider } from "./pi-sampling-provider.ts";

/**
 * Type of Pi's UI context, narrowed for the optional capabilities we use.
 * Kept local so this file is the only place that needs to know the shape.
 */
type PiUI = ExtensionUIContext & {
	form?: (...args: unknown[]) => Promise<unknown>;
	custom?: (...args: unknown[]) => unknown;
	confirm?: (title: string, message: string) => Promise<boolean>;
	theme?: { fg?: (color: string, text: string) => string };
};

/** Adapter wrapping a Pi `ExtensionAPI` so it conforms to `AgentAPI`. */
export class PiAdapter implements AgentAPI {
	constructor(private readonly pi: ExtensionAPI) {}

	registerTool(tool: ToolRegistration): void {
		// Pi's registerTool has a strict generic; cast at the boundary so
		// the universal interface can use its own generic ToolRegistration.
		(this.pi.registerTool as (tool: ToolRegistration) => unknown)(tool);
	}

	registerCommand(name: string, config: CommandConfig): void {
		(this.pi.registerCommand as (name: string, config: CommandConfig) => unknown)(
			name,
			config,
		);
	}

	registerFlag(name: string, config: FlagConfig): void {
		(this.pi.registerFlag as (name: string, config: FlagConfig) => unknown)(
			name,
			config,
		);
	}

	on(
		event: string,
		handler: (...args: unknown[]) => void | Promise<void>,
	): void {
		// Pi's `on` is heavily typed by event name; the universal interface
		// is permissive, so we cast at the boundary.
		(this.pi.on as (event: string, handler: (...args: unknown[]) => unknown) => unknown)(
			event,
			handler,
		);
	}

	getAllTools(): ToolInfo[] {
		const tools = (this.pi.getAllTools as () => unknown)() as ToolInfo[];
		return Array.isArray(tools) ? tools : [];
	}

	getFlag(name: string): string | undefined {
		return (this.pi.getFlag as (name: string) => string | undefined)(name);
	}

	sendMessage(message: unknown, options?: unknown): void {
		// Pi's sendMessage is heavily typed; the universal interface is
		// intentionally permissive (`unknown` per D-01).
		(this.pi.sendMessage as (message: unknown, options?: unknown) => unknown)(
			message,
			options,
		);
	}

	async exec(command: string, args: string[]): Promise<unknown> {
		return (this.pi.exec as (command: string, args: string[]) => Promise<unknown>)(
			command,
			args,
		);
	}
}

/**
 * Convert a Pi `ExtensionContext` into a generic `AgentContext`.
 * Per D-08. When `ctx.hasUI` is false, `ui` is left undefined.
 */
export function adaptPiContext(ctx: ExtensionContext): AgentContext {
	const ui = ctx.hasUI ? adaptPiUI(ctx.ui as PiUI) : undefined;
	const piUi = ctx.hasUI ? (ctx.ui as PiUI) : undefined;
	const modelRegistry = ctx.modelRegistry as ModelRegistry | undefined;
	const currentModel = ctx.model as import("@earendil-works/pi-ai").Model<import("@earendil-works/pi-ai").Api> | undefined;
	const samplingProvider = modelRegistry
		? new PiSamplingProvider(
				modelRegistry,
				() => currentModel,
				piUi?.confirm ? (title, message) => piUi.confirm!(title, message) : undefined,
			)
		: undefined;
	return {
		cwd: ctx.cwd,
		hasUI: ctx.hasUI,
		ui,
		model: ctx.model,
		modelRegistry: ctx.modelRegistry,
		samplingProvider,
		signal: ctx.signal,
	};
}

/**
 * Convert a Pi `ExtensionUIContext` into a generic `UISystem`.
 * Optional Pi capabilities are only attached if present.
 */
function adaptPiUI(piUi: PiUI): UISystem {
	return {
		notify: (message, level) => {
			piUi.notify(message, level);
		},
		setStatus: (key, value) => {
			piUi.setStatus?.(key, value);
		},
		form: piUi.form
			? (config) =>
					(piUi.form as (config: unknown) => Promise<unknown>)(config) as ReturnType<
						NonNullable<UISystem["form"]>
					>
			: undefined,
		custom: piUi.custom
			? (renderer, options) => {
					(piUi.custom as (...args: unknown[]) => unknown)(renderer, options);
				}
			: undefined,
		theme: piUi.theme ? { fg: piUi.theme.fg } : undefined,
	};
}
