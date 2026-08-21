import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				// Desktop-only plugin: the Obsidian renderer (Electron) exposes Node globals
				// used by the runtime bridge (Buffer, NodeJS, process).
				...globals.node,
				NodeJS: "readonly",
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		// Build artifacts copied to the plugin folder on production builds.
		"pi-runtime.cjs",
		"pdf.worker.mjs",
		"runtime-assets",
		".tmp-*",
		"load-error.txt",
	]),
	{
		files: ["src/pi/piSessionService.ts"],
		rules: {
			// window.confirm gates destructive actions (chat deletion, note writes)
			// deliberately: a synchronous yes/no is the safest prompt for mutations.
			"no-alert": "off",
		},
	},
);
