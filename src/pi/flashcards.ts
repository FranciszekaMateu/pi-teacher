type Mastery = Record<string, { status: string }>;
export interface FlashcardProposal { conceptId: string; question: string; answer: string; }
const BLOCK = /```pi-flashcards\s*\n([\s\S]*?)\n```/i;

export function extractFlashcards(text: string, mastery: Mastery): FlashcardProposal[] {
	const source = BLOCK.exec(text)?.[1];
	if (!source) return [];
	try {
		const parsed = JSON.parse(source) as { cards?: unknown };
		if (!Array.isArray(parsed.cards)) return [];
		return parsed.cards.filter((card): card is FlashcardProposal => Boolean(card) && typeof card === "object" && typeof (card as FlashcardProposal).conceptId === "string" && typeof (card as FlashcardProposal).question === "string" && typeof (card as FlashcardProposal).answer === "string")
			.map((card) => ({ conceptId: card.conceptId.trim(), question: clean(card.question), answer: clean(card.answer) }))
			.filter((card) => card.conceptId && card.question && card.answer && mastery[card.conceptId]?.status !== "mastered");
	} catch { return []; }
}

export function buildFlashcardAppend(existing: string, cards: FlashcardProposal[]): string {
	const seen = new Set([...existing.matchAll(/^(.+)\n\?$/gm)].map((match) => normalizeQuestion(match[1] ?? "")));
	const unique = cards.filter((card) => !seen.has(normalizeQuestion(card.question)));
	if (!unique.length) return existing;
	return `${existing.trimEnd()}\n\n${unique.map((card) => `${card.question}\n?\n${card.answer}`).join("\n\n")}\n`;
}
export function stripFlashcardsMarkup(text: string): string { return text.replace(BLOCK, "").trim(); }
function clean(value: string): string { return value.trim().replace(/\n{3,}/g, "\n\n"); }
function normalizeQuestion(value: string): string { return value.replace(/\s+/g, " ").trim().toLocaleLowerCase(); }
