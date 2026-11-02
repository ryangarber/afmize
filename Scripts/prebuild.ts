// Builds afmize's dynamic library into `packages/node/prebuilds`, which
// @afmize/node ships and the release attaches to its GitHub release:
//
//   node scripts/prebuild.ts [release | debug]
//
// FoundationModels needs macOS 26 on Apple silicon, so it is the only build.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { copy, proc } from "@ryangarber/utils";
import { PROJECT_ROOT } from "./paths.ts";

const OUT = join(PROJECT_ROOT, "packages/node/prebuilds/darwin-arm64");
const LIBRARY = "libafmize.dylib";

const configuration = process.argv[2] ?? "release";
if (configuration !== "release" && configuration !== "debug") {
	console.error(`unknown configuration: ${configuration}`);
	process.exit(1);
}
if (process.platform !== "darwin" || process.arch !== "arm64") {
	console.error("afmize builds only on macOS on Apple silicon");
	process.exit(1);
}

const command = [
	"swift",
	"build",
	"--package-path",
	PROJECT_ROOT,
	"--configuration",
	configuration,
	"--product",
	"dynafmize",
];
await proc({ command, title: "Building" });

// SwiftPM's layout differs between toolchains, so it is asked where.
const { stdout } = await proc({
	command: [...command, "--show-bin-path"],
	title: "Finding",
});

const bin = stdout.trim().split("\n").at(-1);
if (!bin) throw new Error("swift build --show-bin-path printed nothing");

const library = join(OUT, LIBRARY);
await copy({
	paths: [{ source: join(bin, "libdynafmize.dylib"), destination: library }],
});
// Named for what it is now, rather than the product it was built as.
await proc({
	command: ["install_name_tool", "-id", `@rpath/${LIBRARY}`, library],
	title: "Naming",
});
// Which voids its ad-hoc signature, without which Apple silicon won't load it.
await proc({
	command: ["codesign", "--force", "--sign", "-", library],
	title: "Signing",
});
