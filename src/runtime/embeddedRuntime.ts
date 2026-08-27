import Module from "node:module";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";

declare const __PI_RUNTIME_GZIP_BASE64__: string;

const RUNTIME_FLAG = "--pi-teacher-runtime";

type CompilableModule = Module & {
	_compile(source: string, filename: string): void;
	paths: string[];
};

type ModuleConstructor = typeof Module & {
	_nodeModulePaths(path: string): string[];
};

/**
 * Runs the bundled Pi RPC entrypoint when this file is started by Node.
 *
 * The Community directory installs only main.js, manifest.json, and styles.css.
 * Keeping the child runtime as compressed, static source inside main.js lets the
 * plugin remain self-contained without downloading or writing executable files.
 */
export function startEmbeddedRuntimeIfRequested(): boolean {
	if (!process.argv.includes(RUNTIME_FLAG)) return false;

	process.argv = process.argv.filter((argument) => argument !== RUNTIME_FLAG);
	const source = gunzipSync(Buffer.from(__PI_RUNTIME_GZIP_BASE64__, "base64")).toString("utf8");
	const runtimeModule = new Module("pi-teacher-runtime") as CompilableModule;
	runtimeModule.filename = __filename;
	runtimeModule.paths = (Module as ModuleConstructor)._nodeModulePaths(dirname(__filename));
	runtimeModule._compile(source, __filename);
	return true;
}

export { RUNTIME_FLAG };
