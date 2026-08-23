export interface PendingQuiz {
	question: string;
	options: string[];
	allowFreeform: boolean;
	conceptId?: string;
	correctOption?: string;
	/** Shown after answering: why the correct option is right (and the misconception behind tempting distractors). */
	explanation?: string;
	/** Optional nudge for freeform quizzes; never reveals the answer. */
	hint?: string;
}

const QUIZ_BLOCK = /```pi-quiz\s*\n([\s\S]*?)\n```/i;

export function stripQuizMarkup(text: string): string {
	return text.replace(QUIZ_BLOCK, "").trim();
}

/** Fisher–Yates display-order shuffle: grading compares option text, not position. */
export function shuffleOptions(options: string[]): string[] {
	const shuffled = [...options];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const a = shuffled[i] as string;
		const b = shuffled[j] as string;
		shuffled[i] = b;
		shuffled[j] = a;
	}
	return shuffled;
}

export function extractQuiz(text: string): PendingQuiz | undefined {
	const match = QUIZ_BLOCK.exec(text);
	if (!match) return undefined;
	const source = match[1];
	if (source === undefined) return undefined;
	try {
		const parsed = JSON.parse(source) as Partial<PendingQuiz>;
		if (typeof parsed.question !== "string" || !parsed.question.trim()) return undefined;
		if (!Array.isArray(parsed.options) || !parsed.options.every((option) => typeof option === "string")) return undefined;
		return {
			question: parsed.question.trim(),
			options: parsed.options.map((option) => option.trim()).filter(Boolean),
			allowFreeform: parsed.allowFreeform !== false,
			...(typeof parsed.conceptId === "string" && parsed.conceptId.trim() ? { conceptId: parsed.conceptId.trim() } : {}),
			...(typeof parsed.correctOption === "string" && parsed.options.includes(parsed.correctOption) ? { correctOption: parsed.correctOption } : {}),
			...(typeof parsed.explanation === "string" && parsed.explanation.trim() ? { explanation: parsed.explanation.trim() } : {}),
			...(typeof parsed.hint === "string" && parsed.hint.trim() ? { hint: parsed.hint.trim() } : {}),
		};
	} catch {
		return undefined;
	}
}
