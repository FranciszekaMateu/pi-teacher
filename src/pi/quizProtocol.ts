export interface PendingQuiz {
	question: string;
	options: string[];
	allowFreeform: boolean;
	conceptId?: string;
	correctOption?: string;
}

const QUIZ_BLOCK = /```pi-quiz\s*\n([\s\S]*?)\n```/i;

export function stripQuizMarkup(text: string): string {
	return text.replace(QUIZ_BLOCK, "").trim();
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
		};
	} catch {
		return undefined;
	}
}
