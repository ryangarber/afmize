import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/bun.ts", "src/browser.ts"],
	format: "esm",
	platform: "node",
	// Per file, so the bundled protocol sources are declared too.
	dts: { oxc: {} },
	sourcemap: true,
	// The prebuilt library stays where `prebuilds` puts it, beside `dist`.
	deps: {
		alwaysBundle: ["@afmize/protocol"],
		neverBundle: ["bun:ffi", "koffi", /\.dylib$/],
	},
});
