// afmize's JSON protocol, as every JavaScript client speaks it. Bundled into
// each published package (`@afmize/node`, `@afmize/capacitor`), so their
// types are the same shapes without a package of their own.

/** A model afmize serves. */
export type AfmModel = "on-device" | "private-cloud-compute";

/** A content part, mirroring AI SDK's prompt parts. */
export type AfmPart =
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| {
			type: "file";
			/** Only `image/*` is supported. */
			mediaType: string;
			/** Base64, a `data:` URL, or a `file:`/`http(s):` URL. */
			data: string;
			filename?: string;
	  }
	| {
			type: "tool-call";
			toolCallId: string;
			toolName: string;
			/** A JSON value, or a JSON-encoded string. */
			input: unknown;
	  }
	| {
			type: "tool-result";
			toolCallId: string;
			toolName: string;
			/** AI SDK's `{ type, value }` tool output, or plain JSON. */
			output: unknown;
	  };

export interface AfmMessage {
	role: "system" | "user" | "assistant" | "tool";
	parts: AfmPart[];
}

/** A function tool; afmize never runs it, only reports the model's calls. */
export interface AfmTool {
	name: string;
	description?: string;
	/** JSON Schema for the tool's input. */
	inputSchema?: unknown;
}

/** What starts a stream. */
export interface AfmRequest {
	model: AfmModel;
	messages: AfmMessage[];
	tools?: AfmTool[];
	toolChoice?: "auto" | "required" | "none";
	temperature?: number;
	maximumResponseTokens?: number;
	/** `light`, `moderate`, `deep`, or a custom level. */
	reasoningLevel?: "light" | "moderate" | "deep" | (string & {});
}

export interface AfmUsage {
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	reasoningTokens: number;
	totalTokens: number;
}

/** One event of a stream: `stream-start` is always first, `finish` last. */
export type AfmEvent =
	| { type: "stream-start" }
	| { type: "text-delta"; id: string; delta: string }
	| { type: "text-replace"; id: string; text: string }
	| { type: "reasoning-delta"; id: string; delta: string }
	| { type: "reasoning-replace"; id: string; text: string }
	| { type: "file"; mediaType: string; data: string }
	| {
			type: "tool-call";
			toolCallId: string;
			toolName: string;
			/** JSON-encoded. */
			input: string;
	  }
	| { type: "error"; code: string; message: string }
	| {
			type: "finish";
			finishReason: "stop" | "tool-calls" | "error" | "other";
			usage?: AfmUsage;
	  };

export interface AfmStatus {
	available: boolean;
	/** Why not, e.g. `apple-intelligence-not-enabled` or `platform-not-supported`. */
	reason?: string;
}

export interface AfmAvailability {
	onDevice: AfmStatus;
	privateCloudCompute: AfmStatus;
}

export interface AfmStreamOptions {
	/** Cancels the stream; its `finish` (reason `other`) still arrives. */
	signal?: AbortSignal;
}

/**
 * What every afmize client is: `@afmize/node`'s over FFI, `@afmize/capacitor`'s
 * over its plugin, or a host's own over whatever reaches one of those.
 */
export interface AfmizeClient {
	availability(): Promise<AfmAvailability>;
	/**
	 * The request's events. Never throws: a failure to reach afmize arrives as
	 * an `error` event, followed by `finish`.
	 */
	stream(
		request: AfmRequest,
		options?: AfmStreamOptions,
	): AsyncIterable<AfmEvent>;
}

/** Availability where afmize cannot be reached at all. */
export const unavailable = (reason: string): AfmAvailability => ({
	onDevice: { available: false, reason },
	privateCloudCompute: { available: false, reason },
});

/** The events of a stream that failed before afmize could start it. */
export function* failure(code: string, message: string): Generator<AfmEvent> {
	yield { type: "stream-start" };
	yield { type: "error", code, message };
	yield { type: "finish", finishReason: "error" };
}
