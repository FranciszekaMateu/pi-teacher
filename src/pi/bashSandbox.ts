/**
 * Bash sandbox for the pi coding-agent's bash tool.
 *
 * The default `createLocalBashOperations` runs arbitrary commands – too
 * dangerous inside an Obsidian plugin. We wrap it with an allowlist and a
 * per-command timeout.
 *
 * - `allowlist` is a list of executables (first token of the command).
 * - `timeoutMs` caps each invocation.
 * - `env` is the environment passed to the child process; we filter by
 *   prefix to keep secrets on the Obsidian side out of the agent's bash.
 */

import { spawn } from "child_process";
import type { BashOperations } from "@earendil-works/pi-coding-agent";

export interface BashSandboxOptions {
	allowlist: string[];
	timeoutMs: number;
	envAllowlistPrefixes?: string[];
	cwd: string;
	confirmCommand?: (command: string) => Promise<boolean>;
}

export function createBashSandboxOperations(options: BashSandboxOptions): BashOperations {
	const allowed = new Set(options.allowlist.map((cmd) => cmd.toLowerCase()));
	const cwd = options.cwd;
	const env = filterEnv(options.envAllowlistPrefixes ?? ["PATH", "LANG", "LC_ALL", "TEMP", "TMP", "HOME", "USERPROFILE"]);

	const exec: BashOperations["exec"] = (command, _execCwd, execOptions) => {
		const tokens = tokenizeCommand(command);
		if (!tokens) {
			execOptions.onData(Buffer.from("bash: shell operators and control characters are not allowed\n"));
			return Promise.resolve({ exitCode: 1 });
		}
		const executable = tokens[0];
		if (!executable) return Promise.resolve({ exitCode: 1 });
		const firstToken = executable.toLowerCase();
		if (firstToken && !allowed.has(firstToken)) {
			execOptions.onData(Buffer.from(`bash: ${firstToken}: command not allowed (allowlist)\n`));
			return Promise.resolve({ exitCode: 1 });
		}

		const approval = options.confirmCommand ? options.confirmCommand(command) : Promise.resolve(true);
		return approval.then((approved) => {
			if (!approved) {
				execOptions.onData(Buffer.from("bash: command cancelled by user\n"));
				return { exitCode: 130 };
			}
			return new Promise<{ exitCode: number | null }>((resolve) => {
			const child = spawn(executable, tokens.slice(1), {
				shell: false,
				cwd,
				env,
				windowsHide: true,
			});

			let timedOut = false;
			const timeoutHandle = setTimeout(() => {
				timedOut = true;
				try {
					child.kill();
				} catch {
					// ignore
				}
			}, options.timeoutMs);

			child.stdout.on("data", (chunk: Buffer) => execOptions.onData(chunk));
			child.stderr.on("data", (chunk: Buffer) => execOptions.onData(chunk));

			child.on("error", (err) => {
				clearTimeout(timeoutHandle);
				execOptions.onData(Buffer.from(`bash: ${err.message}\n`));
				resolve({ exitCode: 1 });
			});

			child.on("exit", (code) => {
				clearTimeout(timeoutHandle);
				if (timedOut) {
					execOptions.onData(Buffer.from(`\n[killed: exceeded ${options.timeoutMs}ms timeout]\n`));
					resolve({ exitCode: 124 });
				} else {
					resolve({ exitCode: code });
				}
			});
			});
		});
	};

	return { exec };
}

/**
 * Parse the small, argument-only command language supported by the sandbox.
 * Shell operators are rejected instead of being delegated to a shell, which
 * prevents an allowlisted executable from turning into arbitrary command
 * execution (for example `rg pattern .; del ...`).
 */
function tokenizeCommand(command: string): string[] | undefined {
	if (/[;&|<>`$\n\r]/.test(command)) return undefined;
	const tokens: string[] = [];
	let token = "";
	let quote: "'" | '"' | undefined;
	let escaped = false;
	for (const character of command.trim()) {
		if (escaped) {
			token += character;
			escaped = false;
			continue;
		}
		if (character === "\\" && quote !== "'") {
			escaped = true;
			continue;
		}
		if (quote) {
			if (character === quote) quote = undefined;
			else token += character;
			continue;
		}
		if (character === "'" || character === '"') {
			quote = character;
		} else if (/\s/.test(character)) {
			if (token) {
				tokens.push(token);
				token = "";
			}
		} else {
			token += character;
		}
	}
	if (escaped || quote) return undefined;
	if (token) tokens.push(token);
	return tokens.length ? tokens : undefined;
}

function filterEnv(allowedPrefixes: string[]): NodeJS.ProcessEnv {
	const source = process.env ?? {};
	const out: NodeJS.ProcessEnv = {};
	for (const key of Object.keys(source)) {
		if (allowedPrefixes.some((prefix) => key === prefix || key.startsWith(prefix + "_"))) {
			out[key] = source[key];
		}
	}
	return out;
}

export const DEFAULT_BASH_ALLOWLIST = [
	"rg",
	"grep",
	"fd",
	"find",
	"ls",
	"cat",
	"head",
	"tail",
	"wc",
	"node",
	"git",
	"npm",
	"pnpm",
	"yarn",
	"python",
	"python3",
	"echo",
	"pwd",
	"tree",
	"date",
	"which",
	"uname",
];
