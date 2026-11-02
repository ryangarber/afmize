import {
	type AfmAvailability,
	type AfmEvent,
	type AfmizeClient,
	createEventStream,
	unavailable,
} from "@afmize/protocol";
import {
	Capacitor,
	type PluginListenerHandle,
	registerPlugin,
} from "@capacitor/core";

export * from "./exports.ts";

/** The native plugin, as `AfmizePlugin.swift` defines it. */
export interface AfmizePlugin {
	/** afmize's availability report, as JSON. */
	availability(): Promise<{ json: string }>;
	/** Events arrive as `event` notifications under `key`; `finish` is last. */
	start(options: { key: number; request: string }): Promise<void>;
	/** The stream's `finish` still arrives. */
	cancel(options: { key: number }): Promise<void>;
	addListener(
		eventName: "event",
		listener: (data: { key: number; event: string }) => void,
	): Promise<PluginListenerHandle>;
}

/** The native plugin itself; most apps want {@link createAfmize} instead. */
export const Afmize: AfmizePlugin = registerPlugin<AfmizePlugin>("Afmize");

/** Whether the app was built with the plugin (only on iOS). */
export const isAfmizeAvailable = (): boolean =>
	Capacitor.isPluginAvailable("Afmize");

/**
 * A client for afmize through the plugin. Where it is missing (the web, or
 * Android), it reports both models unavailable and fails each stream with an
 * `error` event; it never throws.
 */
export function createAfmize(): AfmizeClient {
	// One listener for every stream, by the key each started under.
	const listeners = new Map<number, (event: AfmEvent) => void>();
	let subscribed: Promise<PluginListenerHandle> | undefined;
	let next = 1;

	const subscribe = () =>
		(subscribed ??= Afmize.addListener("event", ({ key, event }) => {
			const parsed = JSON.parse(event) as AfmEvent;
			listeners.get(key)?.(parsed);
			if (parsed.type === "finish") listeners.delete(key);
		}).catch((error) => {
			subscribed = undefined;
			throw error;
		}));

	return {
		availability: async (): Promise<AfmAvailability> => {
			if (!isAfmizeAvailable()) return unavailable("platform-not-supported");
			try {
				return JSON.parse((await Afmize.availability()).json);
			} catch (error) {
				return unavailable(
					`plugin-unavailable: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},

		stream: (request, { signal } = {}) =>
			createEventStream(async (onEvent) => {
				if (!isAfmizeAvailable())
					throw new Error("the Afmize plugin is not in this app");
				await subscribe();
				const key = next++;
				listeners.set(key, onEvent);
				try {
					await Afmize.start({ key, request: JSON.stringify(request) });
				} catch (error) {
					listeners.delete(key);
					throw error;
				}
				return () => Afmize.cancel({ key });
			}, signal),
	};
}
