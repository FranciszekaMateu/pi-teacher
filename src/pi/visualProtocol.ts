export interface VisualProposal { title: string; svg: string; }
const BLOCK = /```pi-visual\s*\n([\s\S]*?)\n```/gi;

/** The model may emit several blocks in one reply; the last valid one wins. */
export function extractVisual(text: string): VisualProposal | undefined {
	let result: VisualProposal | undefined;
	for (const match of text.matchAll(BLOCK)) {
		const visual = parseVisualSource(match[1]);
		if (visual) result = visual;
	}
	return result;
}

function parseVisualSource(source: string | undefined): VisualProposal | undefined {
	if (!source) return undefined;
	try {
		const parsed = JSON.parse(source) as { title?: unknown; svg?: unknown };
		const svg = typeof parsed.svg === "string" ? sanitizeSvg(parsed.svg) : undefined;
		if (!svg || typeof parsed.title !== "string" || !parsed.title.trim()) return undefined;
		return { title: parsed.title.trim().slice(0, 100), svg };
	} catch { return undefined; }
}
export function stripVisualMarkup(text: string): string { return text.replace(BLOCK, "").replace(/\n{3,}/g, "\n\n").trim(); }

/** Accept a small, inert SVG subset; previews never load code or remote assets. */
export function sanitizeSvg(svg: string): string | undefined {
	const value = svg.trim();
	if (value.length > 100_000 || !/^<svg\b/i.test(value) || !/<\/svg>\s*$/i.test(value)) return undefined;
	if (/<\/?(?:script|iframe|object|embed|foreignObject)\b/i.test(value)) return undefined;
	if (/\son\w+\s*=/i.test(value) || /(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/i.test(value)) return undefined;
	return value;
}
