/**
 * ProtocolElicitationForwarder — forwards MCP elicitation requests from
 * downstream servers to the Agent Client via the MCP Server→Client
 * `elicitation/create` reverse call.
 *
 * D-07: implements the `UISystem.form` interface.
 *
 * Threat model:
 *   T-12-02 (Information Disclosure): `form()` must NEVER log
 *   `result.content` — it may contain user PII. Only `result.action`
 *   ("accept"/"decline"/"cancel") may be logged.
 *
 * Note: This causes a double conversion (MCP → FormConfig → MCP → Agent →
 *   MCP → FormResult → ElicitResult) because `elicitation-handler.ts`
 *   already converts MCP schema to FormConfig. This is an accepted
 *   trade-off for architectural consistency. See RESEARCH Pitfall 3.
 */

import type {
	FormConfig,
	FormField,
	FormResult,
} from "../interfaces/host-types.ts";
import type {
	ElicitRequestFormParams,
	ElicitResult,
} from "@modelcontextprotocol/client";

/** Minimal Server→Client reverse-call surface the forwarder needs. */
type ElicitationForwardTarget = {
	elicitInput(params: ElicitRequestFormParams): Promise<ElicitResult>;
};

/**
 * Convert a `FormField` to a JSON Schema property definition.
 *
 * This is the reverse of `elicitation-handler.ts`'s
 * `convertMcpSchemaToPiForm()`. It maps each FormField type to the
 * corresponding JSON Schema property for `elicitInput`'s
 * `requestedSchema`.
 *
 * Supported types:
 *   - text        → { type: "string", minLength?, maxLength? }
 *   - number      → { type: "number", minimum?, maximum? }
 *   - integer     → { type: "integer", minimum?, maximum? }
 *   - boolean     → { type: "boolean" }
 *   - select      → { type: "string", enum: [...] }
 *   - multiSelect → { type: "array", items: { type: "string", enum: [...] } }
 *
 * `title` (from `field.label`) is always included when present.
 * `description` (from `field.description`) is included when present.
 */
export function convertFieldToSchema(field: FormField): Record<string, unknown> {
	const type = field.type;
	const label = field.label;
	const description = (field as { description?: string }).description;

	// Build the base object with optional title/description.
	const buildBase = (): Record<string, unknown> => {
		const base: Record<string, unknown> = {};
		if (label !== undefined) base.title = label;
		if (description !== undefined) base.description = description;
		return base;
	};

	if (type === "select" || type === "multiSelect") {
		const options = (field as { options?: Array<{ value: string; label?: string }> }).options ?? [];
		if (type === "multiSelect") {
			return {
				type: "array",
				items: { type: "string", enum: options.map((o) => o.value) },
				...buildBase(),
			};
		}
		return {
			type: "string",
			enum: options.map((o) => o.value),
			...buildBase(),
		};
	}

	if (type === "number" || type === "integer") {
		const schema: Record<string, unknown> = { type, ...buildBase() };
		const minimum = (field as { minimum?: number }).minimum;
		const maximum = (field as { maximum?: number }).maximum;
		if (minimum !== undefined) schema.minimum = minimum;
		if (maximum !== undefined) schema.maximum = maximum;
		return schema;
	}

	if (type === "boolean") {
		return { type: "boolean", ...buildBase() };
	}

	// Default: text → string with optional minLength/maxLength
	const schema: Record<string, unknown> = { type: "string", ...buildBase() };
	const minLength = (field as { minLength?: number }).minLength;
	const maxLength = (field as { maxLength?: number }).maxLength;
	if (minLength !== undefined) schema.minLength = minLength;
	if (maxLength !== undefined) schema.maxLength = maxLength;
	return schema;
}

/**
 * Forwards MCP elicitation requests to the Agent Client via
 * `server.elicitInput()`.
 *
 * The forwarder is used when the connecting Agent Client declares
 * `elicitation.form` capability. It implements the `UISystem.form`
 * interface, converting `FormConfig` → `elicitInput` params and
 * `ElicitResult` → `FormResult`.
 *
 * Action mapping:
 *   ElicitResult.action "accept"  → FormResult.action "submit"  (with values)
 *   ElicitResult.action "decline" → FormResult.action "secondary"
 *   ElicitResult.action "cancel"  → FormResult.action "cancel"
 */
export class ProtocolElicitationForwarder {
	constructor(private readonly server: ElicitationForwardTarget) {}

	/**
	 * Convert `FormConfig` to `ElicitRequestFormParams` and forward to
	 * the Agent Client via `server.elicitInput()`.
	 *
	 * T-12-02: does NOT log `result.content` (may contain user PII).
	 */
	async form(config: FormConfig): Promise<FormResult> {
		// Convert FormConfig fields back to JSON Schema for requestedSchema
		const properties: Record<string, unknown> = {};
		const required: string[] = [];

		for (const field of config.fields) {
			const schema = convertFieldToSchema(field);
			properties[field.name] = schema;
			if ((field as { required?: boolean }).required) {
				required.push(field.name);
			}
		}

		const result: ElicitResult = await this.server.elicitInput({
			mode: "form",
			message: config.message ?? "",
			requestedSchema: {
				type: "object" as const,
				properties,
				required: required.length > 0 ? required : undefined,
			},
		} as ElicitRequestFormParams);

		// Map ElicitResult → FormResult
		// T-12-02: only result.action is used for control flow — result.content
		// is passed through as values without logging.
		if (result.action === "accept") {
			return {
				action: "submit",
				values: result.content as Record<string, unknown> | undefined,
			};
		}
		if (result.action === "decline") {
			return { action: "secondary" };
		}
		return { action: "cancel" };
	}
}
