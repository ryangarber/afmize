import {
	type AfmAvailability,
	type AfmEvent,
	type AfmizeClient,
	createEventStream,
	failure,
	unavailable,
} from "@afmize/protocol";
import type { Binding } from "./binding.ts";

export interface AfmizeOptions {
	/**
	 * The path to afmize's dynamic library. Defaults to the one this package
	 * ships, prebuilt for Apple silicon.
	 */
	library?: string;
}

/** Why afmize is out of reach here, or null where it may load. */
const unsupported = () => {
	if (process.platform !== "darwin" || process.arch !== "arm64")
		return "platform-not-supported";
	return null;
};

/**
 * A client for afmize's library, loaded on first use: under Bun through its
 * FFI, under Node through koffi. Where it cannot load (anywhere but macOS on
 * Apple silicon, a macOS too old for FoundationModels, or Node without
 * koffi), it reports both models unavailable and fails each stream with an
 * `error` event; it never throws.
 */
/** Creates a client; see {@link createClient}. */
export type CreateAfmize = (options?: AfmizeOptions) => AfmizeClient;

export function createClient(
	defaultLibrary: string,
	bindRuntime: (library: string) => Promise<Binding>,
): CreateAfmize {
	return ({ library = defaultLibrary }: AfmizeOptions = {}): AfmizeClient => {
		let binding: Promise<Binding> | undefined;

		const bind = () =>
			(binding ??= (async () => {
				const reason = unsupported();
				if (reason) throw new Error(reason);
				return bindRuntime(library);
			})());

		return {
			availability: async (): Promise<AfmAvailability> => {
				try {
					return JSON.parse((await bind()).availability());
				} catch (error) {
					return unavailable(
						unsupported() ??
							`library-unavailable: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			},

			stream: (request, { signal } = {}) => ({
				async *[Symbol.asyncIterator]() {
					let afmize: Binding;
					try {
						afmize = await bind();
					} catch (error) {
						yield* failure(
							"model-unavailable",
							`afmize is unavailable: ${error instanceof Error ? error.message : String(error)}`,
						);
						return;
					}

					yield* createEventStream((onEvent) => {
						const id = afmize.start(JSON.stringify(request), (json) => {
							if (json !== null) onEvent(JSON.parse(json) as AfmEvent);
						});
						if (id < 0) throw new Error("afmize rejected the request");
						return () => afmize.cancel(id);
					}, signal);
				},
			}),
		};
	};
}
