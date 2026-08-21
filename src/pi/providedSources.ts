const URL_RE = /https?:\/\/[^\s<>()[\]{}"']+/gi;

/** URLs count as sources only when the learner explicitly pasted them. */
export function providedSourceUrls(prompt: string): string[] {
	const unique = new Set<string>();
	for (const candidate of prompt.match(URL_RE) ?? []) {
		const value = candidate.replace(/[.,;:!?]+$/, "");
		try {
			const url = new URL(value);
			if ((url.protocol !== "http:" && url.protocol !== "https:") || isPrivateHost(url.hostname)) continue;
			unique.add(url.toString());
		} catch { /* ignore malformed learner text */ }
	}
	return [...unique];
}

function isPrivateHost(host: string): boolean {
	const value = host.toLowerCase();
	return value === "localhost" || value.endsWith(".local") || /^127\./.test(value) || /^10\./.test(value) || /^192\.168\./.test(value) || /^172\.(1[6-9]|2\d|3[01])\./.test(value) || value === "::1";
}
