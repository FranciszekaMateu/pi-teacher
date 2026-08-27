/**
 * Recognizes the built-in "last note" quiz requests. The resulting note is
 * attached by the UI, so the agent receives an explicit source rather than
 * being allowed to browse the vault.
 */
export function isLastNoteQuizRequest(prompt: string): boolean {
	const normalized = prompt
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/\s+/g, " ")
		.trim();
	const asksForQuiz = /\bquiz(?:zes)?\b/.test(normalized) || /\bcuestionario\b/.test(normalized);
	const mentionsLastNote = /\b(?:mi |my )?(?:ultima|last|latest) (?:nota|note)\b/.test(normalized);
	return asksForQuiz && mentionsLastNote;
}
