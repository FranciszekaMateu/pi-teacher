/**
 * While an assistant message streams, fenced protocol blocks (pi-quiz,
 * pi-lesson, …) exist half-written until their closing fence arrives. This
 * strips a trailing unclosed pi-* fence so raw protocol JSON never flashes
 * in the chat. Closed blocks are left for the regular strip* functions.
 */
const FENCE_OPENING = /```pi-[a-z]+[^\n]*\n/gi;

export function stripIncompleteProtocolFence(text: string): string {
	const openings = [...text.matchAll(FENCE_OPENING)];
	const last = openings.at(-1);
	if (!last || last.index === undefined) return text;
	const afterLast = text.slice(last.index + last[0].length);
	if (afterLast.includes("```")) return text; // the last protocol block closes fine
	return text.slice(0, last.index).replace(/\s+$/, "");
}
