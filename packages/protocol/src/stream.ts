import { type AfmEvent, failure } from "./protocol.ts";

/** Stops a stream that started; its `finish` still arrives. */
export type AfmCancel = () => void | Promise<void>;

/**
 * Turns a callback-based transport into an `AsyncIterable` of events, for any
 * client: `start` begins a stream, sending its events to `onEvent` (`finish`
 * last), and returns how to cancel it.
 *
 * The stream is cancelled when `signal` aborts or the iteration ends early.
 * A `start` that throws ends it with an `error` and a `finish`, so a consumer
 * always sees the protocol's shape.
 */
export async function* createEventStream(
	start: (onEvent: (event: AfmEvent) => void) => AfmCancel | Promise<AfmCancel>,
	signal?: AbortSignal,
): AsyncGenerator<AfmEvent, void, undefined> {
	const queue: AfmEvent[] = [];
	let wake: (() => void) | undefined;
	let finished = false;

	const onEvent = (event: AfmEvent) => {
		queue.push(event);
		wake?.();
	};

	let cancel: AfmCancel | undefined;
	let cancelled = false;
	const stop = () => {
		if (cancelled || finished) return;
		cancelled = true;
		// Only reachable once `start` resolved; before then, it is caught up on
		// below.
		void Promise.resolve(cancel?.()).catch(() => {});
	};

	try {
		cancel = await start(onEvent);
	} catch (error) {
		yield* failure(
			"unknown",
			`failed to start the stream: ${error instanceof Error ? error.message : String(error)}`,
		);
		return;
	}

	if (signal?.aborted) stop();
	signal?.addEventListener("abort", stop, { once: true });

	try {
		while (true) {
			const event = queue.shift();
			if (!event) {
				await new Promise<void>((resolve) => {
					wake = resolve;
				});
				wake = undefined;
				continue;
			}
			if (event.type === "finish") finished = true;
			yield event;
			if (finished) return;
		}
	} finally {
		signal?.removeEventListener("abort", stop);
		// Broken off before `finish`: nothing will read the rest.
		stop();
	}
}
