import { type Binding, keepAlive } from "../binding.ts";

/** afmize through koffi, Node's FFI; koffi is an optional peer dependency. */
export async function bindKoffi(path: string): Promise<Binding> {
	let koffi: typeof import("koffi");
	try {
		// Optional, so out of sight of bundlers (and of constant folding).
		const specifier = ["koffi"].join("");
		koffi = (await import(specifier)) as typeof import("koffi");
	} catch (error) {
		throw new Error(
			"@afmize/node needs `koffi` under Node; install it alongside @afmize/node",
			{ cause: error },
		);
	}

	const library = koffi.load(path);
	const Callback = koffi.proto(
		"void afmize_event_callback(void *context, void *event_json)",
	);
	const afmize_availability = library.func("void *afmize_availability(void)");
	const afmize_string_free = library.func("void afmize_string_free(void *ptr)");
	const afmize_stream_start = library.func(
		"int64_t afmize_stream_start(const char *request_json, void *context, afmize_event_callback *callback)",
	);
	const afmize_stream_cancel = library.func(
		"void afmize_stream_cancel(int64_t stream_id)",
	);

	const read = (pointer: unknown) => {
		const json = koffi.decode(pointer, "char", -1) as string;
		afmize_string_free(pointer);
		return json;
	};

	return {
		availability: () => {
			const pointer = afmize_availability();
			return pointer ? read(pointer) : "{}";
		},
		start: (request, onEvent) => {
			const release = keepAlive();
			// Koffi runs it on the main thread, queued from afmize's.
			const callback = koffi.register((_context: unknown, pointer: unknown) => {
				if (pointer === null) {
					// Not from inside its own call.
					setImmediate(() => koffi.unregister(callback));
					release();
					onEvent(null);
					return;
				}
				onEvent(read(pointer));
			}, koffi.pointer(Callback));

			const id = Number(afmize_stream_start(request, null, callback));
			if (id < 0) {
				koffi.unregister(callback);
				release();
			}
			return id;
		},
		cancel: (id) => {
			afmize_stream_cancel(id);
		},
	};
}
