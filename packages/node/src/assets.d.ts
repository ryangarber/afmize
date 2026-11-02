declare module "*.dylib" {
	/** Where the file is, as Bun's `with { type: "file" }` resolves it. */
	const path: string;
	export default path;
}
