/**
 * afmize's C ABI (`include/afmize.h`), as one runtime's FFI reaches it. Each
 * event's string is freed here; `null` follows a stream's last event.
 */
export interface Binding {
	availability(): string;
	/** The stream's id, or -1 when afmize rejected it (and nothing follows). */
	start(request: string, onEvent: (json: string | null) => void): number;
	cancel(id: number): void;
}

/**
 * Keeps the event loop alive while a stream runs: its events arrive from
 * afmize's threads, which nothing else waits on.
 */
export const keepAlive = (): (() => void) => {
	const timer = setInterval(() => {}, 2 ** 30);
	return () => clearInterval(timer);
};
