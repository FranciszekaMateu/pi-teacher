type Mastery = Record<string, { status: string }>;
export interface FlashcardProposal { conceptId: string; question: string; answer: string; }
const BLOCK = /```pi-flashcards\s*\n([\s\S]*?)\n```/gi;

/** Cards from every block in the reply, in order; saving dedupes later. */
export function extractFlashcards(text: string, mastery: Mastery): FlashcardProposal[] {
	const cards: FlashcardProposal[] = [];
	for (const match of text.matchAll(BLOCK)) {
		const source = match[1];
		if (!source) continue;
		try {
			const parsed = JSON.parse(source) as { cards?: unknown };
			if (!Array.isArray(parsed.cards)) continue;
			cards.push(...parsed.cards.filter((card): card is FlashcardProposal => Boolean(card) && typeof card === "object" && typeof (card as FlashcardProposal).conceptId === "string" && typeof (card as FlashcardProposal).question === "string" && typeof (card as FlashcardProposal).answer === "string")
				.map((card) => ({ conceptId: card.conceptId.trim(), question: clean(card.question), answer: clean(card.answer) }))
				.filter((card) => card.conceptId && card.question && card.answer && mastery[card.conceptId]?.status !== "mastered"));
		} catch {
			// Skip malformed blocks; other blocks may still carry cards.
		}
	}
	return cards;
}

export function buildFlashcardAppend(existing: string, cards: FlashcardProposal[]): string {
	const seen = new Set([...existing.matchAll(/^(.+)\n\?$/gm)].map((match) => normalizeQuestion(match[1] ?? "")));
	const unique = cards.filter((card) => !seen.has(normalizeQuestion(card.question)));
	if (!unique.length) return existing;
	return `${existing.trimEnd()}\n\n${unique.map((card) => `${card.question}\n?\n${card.answer}`).join("\n\n")}\n`;
}
export function stripFlashcardsMarkup(text: string): string { return text.replace(BLOCK, "").replace(/\n{3,}/g, "\n\n").trim(); }
function clean(value: string): string { return value.trim().replace(/\n{3,}/g, "\n\n"); }
function normalizeQuestion(value: string): string { return value.replace(/\s+/g, " ").trim().toLocaleLowerCase(); }
