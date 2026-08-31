/**
 * Obsidian vault adapters for the pi coding-agent tools.
 *
 * The pi coding-agent is built around pluggable `*Operations` interfaces (e.g.
 * `ReadOperations`, `WriteOperations`, `EditOperations`, `LsOperations`,
 * `FindOperations`, `GrepOperations`). We implement each one on top of the
 * Obsidian `App` so that the agent reads, writes and edits vault notes
 * instead of arbitrary filesystem paths.
 *
 * Path semantics:
 *   - The agent supplies paths relative to `cwd` (the vault root by default).
 *   - We resolve them via `app.vault.getAbstractFileByPath` and adapt to the
 *     TFile/TFolder API.
 *   - For tools that take absolute paths internally we still normalize via
 *     Obsidian's adapter before returning.
 */

import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { ReadOperations, WriteOperations, EditOperations, LsOperations, FindOperations, GrepOperations } from "@earendil-works/pi-coding-agent";

export interface VaultOperationsOptions {
	app: App;
	/** Vault-relative path treated as the working directory for the agent. */
	cwd: string;
	/** Optional approval gate invoked immediately before a mutation. */
	confirmMutation?: (path: string, operation: "write" | "edit") => Promise<boolean>;
}

export interface VaultOperations {
	read: ReadOperations;
	write: WriteOperations;
	edit: EditOperations;
	ls: LsOperations;
	find: FindOperations;
	grep: GrepOperations;
}

export function createVaultOperations(options: VaultOperationsOptions): VaultOperations {
	const { app } = options;
	const cwd = normalizePath(options.cwd || "/");
	const confirmMutation = options.confirmMutation;

	// Resolve a vault-relative agent path to an abstract file or throw a
	// NotFound-style error if the path escapes the vault.
	const resolve = (absolutePath: string): TFile | TFolder => {
		const relative = toVaultRelative(absolutePath, cwd);
		const abstract = app.vault.getAbstractFileByPath(relative);
		if (!abstract) {
			throw new Error(`ENOENT: ${relative}`);
		}
		if (!(abstract instanceof TFile) && !(abstract instanceof TFolder)) {
			throw new Error(`Unsupported vault entry: ${abstract.path}`);
		}
		return abstract;
	};

	// -----------------------------------------------------------------------
	// Read
	// -----------------------------------------------------------------------
	const read: ReadOperations = {
		async readFile(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFile)) {
				throw new Error(`EISDIR: ${file.path}`);
			}
			return Buffer.from(await app.vault.read(file));
		},
		async access(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFile)) {
				throw new Error(`EISDIR: ${file.path}`);
			}
		},
		async detectImageMimeType(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFile)) return null;
			const ext = file.extension.toLowerCase();
			if (ext === "png") return "image/png";
			if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
			if (ext === "gif") return "image/gif";
			if (ext === "webp") return "image/webp";
			if (ext === "svg") return "image/svg+xml";
			if (ext === "bmp") return "image/bmp";
			return null;
		},
	};

	// -----------------------------------------------------------------------
	// Write
	// -----------------------------------------------------------------------
	const write: WriteOperations = {
		async writeFile(absolutePath, content) {
			const relative = toVaultRelative(absolutePath, cwd);
			const normalized = normalizePath(relative);
			if (confirmMutation && !(await confirmMutation(normalized, "write"))) {
				throw new Error("Write cancelled by user");
			}
			const existing = app.vault.getAbstractFileByPath(normalized);
			if (existing instanceof TFile) {
				await app.vault.modify(existing, content);
				return;
			}
			// Ensure parent dir exists.
			const parentPath = normalized.split("/").slice(0, -1).join("/");
			if (parentPath) {
				await mkdir(parentPath);
			}
			await app.vault.create(normalized, content);
		},
		async mkdir(dir) {
			await mkdir(normalizePath(toVaultRelative(dir, cwd)));
		},
	};

	// -----------------------------------------------------------------------
	// Edit
	// -----------------------------------------------------------------------
	const edit: EditOperations = {
		async readFile(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFile)) {
				throw new Error(`EISDIR: ${file.path}`);
			}
			return Buffer.from(await app.vault.read(file));
		},
		async writeFile(absolutePath, content) {
			if (confirmMutation && !(await confirmMutation(toVaultRelative(absolutePath, cwd), "edit"))) {
				throw new Error("Edit cancelled by user");
			}
			await write.writeFile(absolutePath, content);
		},
		async access(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFile)) {
				throw new Error(`EISDIR: ${file.path}`);
			}
		},
	};

	// -----------------------------------------------------------------------
	// Ls
	// -----------------------------------------------------------------------
	const ls: LsOperations = {
		exists(absolutePath) {
			const relative = toVaultRelative(absolutePath, cwd);
			return app.vault.getAbstractFileByPath(relative) !== null;
		},
		stat(absolutePath) {
			const file = resolve(absolutePath);
			return {
				isDirectory: () => file instanceof TFolder,
			};
		},
		readdir(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFolder)) {
				throw new Error(`ENOTDIR: ${file.path}`);
			}
			return file.children.map((child) => child.name);
		},
	};

	// -----------------------------------------------------------------------
	// Find (glob). We delegate to Obsidian's `getMarkdownFiles` for the simple
	// `**/*.md` case, otherwise parse the pattern and walk the vault.
	// -----------------------------------------------------------------------
	const find: FindOperations = {
		exists(absolutePath) {
			return ls.exists(absolutePath);
		},
		async glob(pattern, _cwd, options) {
			const ignore = options?.ignore ?? [];
			const limit = options?.limit ?? 1000;
			const matcher = compilePattern(pattern);
			const results: string[] = [];
			const walk = async (folder: TFolder, prefix: string): Promise<void> => {
				for (const child of folder.children) {
					if (results.length >= limit) return;
					if (ignore.includes(child.name)) continue;
					const relPath = prefix ? `${prefix}/${child.name}` : child.name;
					if (child instanceof TFolder) {
						await walk(child, relPath);
					} else if (child instanceof TFile) {
						if (matcher(relPath)) results.push(relPath);
					}
				}
			};
			await walk(app.vault.getRoot(), "");
			return results;
		},
	};

	// -----------------------------------------------------------------------
	// Grep (read content for context lines)
	// -----------------------------------------------------------------------
	const grep: GrepOperations = {
		isDirectory(absolutePath) {
			const file = resolve(absolutePath);
			return file instanceof TFolder;
		},
		async readFile(absolutePath) {
			const file = resolve(absolutePath);
			if (!(file instanceof TFile)) {
				throw new Error(`EISDIR: ${file.path}`);
			}
			return await app.vault.read(file);
		},
	};

	// -----------------------------------------------------------------------
	// Internal helpers
	// -----------------------------------------------------------------------
	async function mkdir(normalized: string): Promise<void> {
		if (!normalized || normalized === "/") return;
		const existing = app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFolder) return;
		const parent = normalized.split("/").slice(0, -1).join("/");
		if (parent) await mkdir(parent);
		try {
			await app.vault.createFolder(normalized);
		} catch {
			// ignore: folder already exists
		}
	}

	return { read, write, edit, ls, find, grep };
}

/**
 * Translate an absolute or agent-cwd-relative path into a vault-relative
 * path. Rejects directory traversal.
 */
function toVaultRelative(absolutePath: string, cwd: string): string {
	const cleaned = absolutePath.replace(/\\/g, "/").replace(/\/+$/, "");
	const base = cwd.replace(/\\/g, "/").replace(/\/+$/, "");
	if (!cleaned || cleaned === ".") return "";
	if (cleaned.split("/").includes("..")) {
		throw new Error(`EACCES: path traversal is not allowed: ${absolutePath}`);
	}
	if (base && base !== "/" && (cleaned === base || cleaned.startsWith(`${base}/`))) {
		return normalizePath(cleaned.slice(base.length).replace(/^\/+/, ""));
	}
	// Relative paths are already vault-relative. Absolute paths outside the
	// vault are rejected instead of being silently prefixed.
	if (/^[A-Za-z]:\//.test(cleaned) || cleaned.startsWith("//")) {
		throw new Error(`EACCES: path is outside the Obsidian vault: ${absolutePath}`);
	}
	return normalizePath(cleaned.replace(/^\/+/, ""));
}

/** Convert a glob pattern into a predicate over vault-relative paths. */
function compilePattern(pattern: string): (path: string) => boolean {
	// Replace `**/`, `*`, `?` with regex equivalents.
	const regexBody = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "::DOUBLESTAR::")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, "[^/]")
		.replace(/::DOUBLESTAR::/g, ".*");
	const re = new RegExp(`^${regexBody}$`);
	return (path: string) => re.test(path);
}
