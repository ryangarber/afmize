import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

export const SWIFT_SOURCES = [
	"Package.swift",
	"Sources",
	"Tests",
	"packages/capacitor/Package.swift",
	"packages/capacitor/ios",
].map((path) => join(PROJECT_ROOT, path));
