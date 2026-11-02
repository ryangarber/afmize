import type { KnipConfig } from "knip";

export default {
	ignoreBinaries: ["swift", "install_name_tool"],
	ignoreDependencies: ["@ryangarber/utils"],
	ignore: ["scripts/**/*.ts"],
} satisfies KnipConfig;
