import { proc } from "@ryangarber/utils";
import { SWIFT_SOURCES } from "../scripts/paths.ts";

await proc({
	title: `Linting Swift`,
	command: ["swift", "format", "lint", "--recursive", ...SWIFT_SOURCES],
});

await proc({
	title: `Linting TypeScript`,
	command: ["biome", "lint", "--write"],
});
