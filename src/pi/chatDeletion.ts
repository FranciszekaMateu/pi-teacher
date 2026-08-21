import { basename, dirname, extname, resolve } from "node:path";

/** Validates that deletion cannot leave Pi's own session directory. */
export function sessionFileToDelete(sessionsDir: string, candidate: string): string {
	const root = resolve(sessionsDir);
	const target = resolve(candidate);
	if (dirname(target) !== root || extname(target) !== ".jsonl" || !basename(target)) {
		throw new Error("refusing to delete a path outside Pi session history");
	}
	return target;
}
