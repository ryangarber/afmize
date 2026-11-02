// The browser's entry: afmize can't be reached from a page, but its types and
// `createEventStream` are what a webview's client over its host's IPC needs.
import { type AfmizeClient, failure, unavailable } from "@afmize/protocol";
import type { AfmizeOptions } from "./client.ts";

export * from "./exports.ts";

/** There is none to load in a browser. */
export const library: string | null = null;

/** A client that reports afmize unavailable, as it always is in a browser. */
export const createAfmize = (_options?: AfmizeOptions): AfmizeClient => ({
	availability: async () => unavailable("platform-not-supported"),
	stream: async function* () {
		yield* failure(
			"model-unavailable",
			"afmize is unavailable in a browser; use @afmize/capacitor in a Capacitor app",
		);
	},
});
