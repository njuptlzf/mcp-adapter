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
import type { AgentChannel } from "../interfaces/agent-channel.ts";
import { PiSamplingProvider } from "./pi-sampling-provider.ts";
import { piRenderWrapper } from "./pi-renderer.ts";

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

	/** Universal channel, set via `attachChannel`. Optional — Pi has native messaging. */
	private channel: AgentChannel | undefined;

	registerTool(tool: ToolRegistration): void {
		// Pi's registerTool has a strict generic; cast at the boundary so
		// the universal interface can use its own generic ToolRegistration.
		(this.pi.registerTool as (tool: ToolRegistration) => unknown)(this.adaptTool(tool));
	}

	registerCommand(name: string, config: CommandConfig): void {
		(this.pi.registerCommand as (name: string, config: CommandConfig) => unknown)(
			name,
			this.adaptCommand(config),
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
			this.adaptEventHandler(event, handler),
		);
	}

	/** Bridge a generic ToolRegistration so Pi receives native Text renderers and AgentContext. */
	private adaptTool(tool: ToolRegistration): ToolRegistration {
		const adapted: ToolRegistration = { ...tool };

		if (typeof tool.execute === "function") {
			const originalExecute = tool.execute;
			adapted.execute = (...args: unknown[]) => {
				if (args.length > 0) {
					const lastIndex = args.length - 1;
					args[lastIndex] = adaptPiContext(args[lastIndex] as ExtensionContext);
				}
				return originalExecute(...args);
			};
		}

		if (typeof tool.renderCall === "function") {
			adapted.renderCall = piRenderWrapper(
				tool.renderCall as (...args: unknown[]) => string,
			);
		}

		if (typeof tool.renderResult === "function") {
			adapted.renderResult = piRenderWrapper(
				tool.renderResult as (...args: unknown[]) => string,
			);
		}

		return adapted;
	}

	/** Bridge a generic command handler so Pi's ExtensionContext is converted to AgentContext. */
	private adaptCommand(config: CommandConfig): CommandConfig {
		return {
			...config,
			handler: (...args: unknown[]) => {
				const adaptedArgs = args.map((arg, index) =>
					index === 1 ? adaptPiContext(arg as ExtensionContext) : arg,
				);
				return config.handler(...adaptedArgs);
			},
		};
	}

	/** Bridge a generic event handler so Pi's ExtensionContext is converted to AgentContext. */
	private adaptEventHandler(
		event: string,
		handler: (...args: unknown[]) => void | Promise<void>,
	): (...args: unknown[]) => void | Promise<void> {
		return (...args: unknown[]) => {
			if (
				(event === "session_start" || event === "session_shutdown") &&
				args.length > 1
			) {
				args[1] = adaptPiContext(args[1] as ExtensionContext);
			}
			return handler(...args);
		};
	}

	getAllTools(): ToolInfo[] {
		const tools = (this.pi.getAllTools as () => unknown)() as ToolInfo[];
		return Array.isArray(tools) ? tools : [];
	}

	getFlag(name: string): string | undefined {
		return (this.pi.getFlag as (name: string) => string | undefined)(name);
	}

	sendMessage(message: unknown, options?: unknown): void {
		if (this.channel) {
			void this.channel.send(message, options);
			return;
		}
		// Pi's sendMessage is heavily typed; the universal interface is
		// intentionally permissive (`unknown` per D-01).
		(this.pi.sendMessage as (message: unknown, options?: unknown) => unknown)(
			message,
			options,
		);
	}

	/** Attach a universal `AgentChannel`. Optional for Pi — native messaging works without it. */
	attachChannel(channel: AgentChannel): void {
		this.channel = channel;
	}

	/** Detach the universal channel. */
	detachChannel(): void {
		this.channel?.close?.();
		this.channel = undefined;
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
		reload: (ctx as unknown as { reload?: () => Promise<void> }).reload,
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
