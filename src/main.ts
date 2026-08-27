import { startEmbeddedRuntimeIfRequested } from "./runtime/embeddedRuntime";

const isPiRuntimeProcess = startEmbeddedRuntimeIfRequested();

// Keep the Node-only child entrypoint ahead of the Obsidian import. When Node
// starts main.js with the internal runtime flag, esbuild keeps this require
// branch cold and the external `obsidian` module is never resolved.
const pluginModule = isPiRuntimeProcess
	? null
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- must stay conditional so the Node child never resolves Obsidian.
	: require("./plugin") as typeof import("./plugin");

export default pluginModule?.default;
