// Bun's entry: the library is imported as a file, so `Bun.build` carries it
// beside a bundle and `bun build --compile` embeds it in the binary (and
// extracts it for `dlopen`), with nothing for the app to copy.
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import asset from "../prebuilds/darwin-arm64/libafmize.dylib" with {
	type: "file",
};
import { bindBun } from "./bindings/bun.ts";
import { type CreateAfmize, createClient } from "./client.ts";

export * from "./exports.ts";

/**
 * The dynamic library this package ships, prebuilt for Apple silicon. A
 * bundle names its copy relative to itself, rather than to the working
 * directory `dlopen` would resolve it against.
 */
export const library: string = isAbsolute(asset)
	? asset
	: fileURLToPath(new URL(asset, import.meta.url));

/** A client for afmize, over Bun's FFI. */
export const createAfmize: CreateAfmize = createClient(library, bindBun);
