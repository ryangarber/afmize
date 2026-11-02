import { proc } from "@ryangarber/utils";
import { SWIFT_SOURCES } from "../scripts/paths.ts";

await proc({
	title: `Formatting Swift`,
	command: ["swift", "format", "--recursive", "--in-place", ...SWIFT_SOURCES],
});

await proc({
	title: `Formatting TypeScript`,
	command: ["biome", "format", "--write"],
});
