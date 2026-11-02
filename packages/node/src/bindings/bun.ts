import { type Binding, keepAlive } from "../binding.ts";

/** afmize through Bun's FFI. */
export async function bindBun(path: string): Promise<Binding> {
	// Out of sight of bundlers that don't target Bun (and of constant folding).
	const specifier = ["bun", "ffi"].join(":");
	const { CString, dlopen, FFIType, JSCallback } = (await import(
		specifier
	)) as typeof import("bun:ffi");

	const { symbols } = dlopen(path, {
		afmize_availability: { args: [], returns: FFIType.pointer },
		afmize_string_free: { args: [FFIType.pointer], returns: FFIType.void },
		afmize_stream_start: {
			args: [FFIType.cstring, FFIType.pointer, FFIType.function],
			returns: FFIType.i64,
		},
		afmize_stream_cancel: { args: [FFIType.i64], returns: FFIType.void },
	});

	const read = (pointer: unknown) => {
		const json = new CString(pointer as never).toString();
		symbols.afmize_string_free(pointer as never);
		return json;
	};

	// Each stream's context is a key to its listener, not a pointer to
	// anything; one callback serves them all.
	const listeners = new Map<number, (json: string | null) => void>();
	let next = 1;

	const callback = new JSCallback(
		(context: number, pointer: number | null) => {
			const listener = listeners.get(Number(context));
			if (!pointer) {
				listeners.delete(Number(context));
				listener?.(null);
				return;
			}
			const json = read(pointer);
			listener?.(json);
		},
		{
			args: [FFIType.pointer, FFIType.pointer],
			returns: FFIType.void,
			threadsafe: true,
		},
	);

	return {
		availability: () => {
			const pointer = symbols.afmize_availability();
			return pointer ? read(pointer) : "{}";
		},
		start: (request, onEvent) => {
			const context = next++;
			const release = keepAlive();
			listeners.set(context, (json) => {
				if (json === null) release();
				onEvent(json);
			});
			const id = Number(
				symbols.afmize_stream_start(
					Buffer.from(`${request}\0`),
					context as never,
					callback.ptr,
				),
			);
			if (id < 0) {
				listeners.delete(context);
				release();
			}
			return id;
		},
		cancel: (id) => {
			symbols.afmize_stream_cancel(id);
		},
	};
}
