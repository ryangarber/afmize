import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts"],
	format: "esm",
	platform: "browser",
	// Per file, so the bundled protocol sources are declared too.
	dts: { oxc: {} },
	sourcemap: true,
	deps: { alwaysBundle: ["@afmize/protocol"] },
});
