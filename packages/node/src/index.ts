import { fileURLToPath } from "node:url";
import { bindBun } from "./bindings/bun.ts";
import { bindKoffi } from "./bindings/koffi.ts";
import { type CreateAfmize, createClient } from "./client.ts";

export * from "./exports.ts";

/** The dynamic library this package ships, prebuilt for Apple silicon. */
export const library: string = fileURLToPath(
	new URL("../prebuilds/darwin-arm64/libafmize.dylib", import.meta.url),
);

/** A client for afmize, over Bun's FFI under Bun and koffi under Node. */
export const createAfmize: CreateAfmize = createClient(library, (path) =>
	process.versions.bun ? bindBun(path) : bindKoffi(path),
);
