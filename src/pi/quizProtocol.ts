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

const QUIZ_BLOCK = /```pi-quiz\s*\n([\s\S]*?)\n```/gi;

export function stripQuizMarkup(text: string): string {
	return text.replace(QUIZ_BLOCK, "").replace(/\n{3,}/g, "\n\n").trim();
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

/** The model may emit several blocks in one reply; the last valid one wins. */
export function extractQuiz(text: string): PendingQuiz | undefined {
	let result: PendingQuiz | undefined;
	for (const match of text.matchAll(QUIZ_BLOCK)) {
		const quiz = parseQuizSource(match[1]);
		if (quiz) result = quiz;
	}
	return result;
}

/** Every valid quiz in the text, in order (a reply may carry several). */
export function extractAllQuizzes(text: string): PendingQuiz[] {
	const quizzes: PendingQuiz[] = [];
	for (const match of text.matchAll(QUIZ_BLOCK)) {
		const quiz = parseQuizSource(match[1]);
		if (quiz) quizzes.push(quiz);
	}
	return quizzes;
}

export type QuizSegment = { type: "text"; text: string } | { type: "quiz"; quiz: PendingQuiz };

/** Splits message text into prose and quiz segments so quizzes can render in place. */
export function splitQuizSegments(text: string): QuizSegment[] {
	const segments: QuizSegment[] = [];
	let cursor = 0;
	for (const match of text.matchAll(QUIZ_BLOCK)) {
		if (match.index === undefined) continue;
		const quiz = parseQuizSource(match[1]);
		if (!quiz) continue;
		const before = text.slice(cursor, match.index);
		if (before.trim()) segments.push({ type: "text", text: before });
		segments.push({ type: "quiz", quiz });
		cursor = match.index + match[0].length;
	}
	const tail = text.slice(cursor);
	if (tail.trim()) segments.push({ type: "text", text: tail });
	return segments;
}

/** Matches a learner reply to a quiz option, for rendering historical answers. */
export function matchQuizAnswer(quiz: PendingQuiz, answer: string | undefined): { selected: string; correct: boolean | null } | undefined {
	if (!answer?.trim()) return undefined;
	const normalized = answer.trim();
	if (!quiz.options.some((option) => option.trim() === normalized)) return undefined;
	return { selected: normalized, correct: typeof quiz.correctOption === "string" ? quiz.correctOption.trim() === normalized : null };
}

function parseQuizSource(source: string | undefined): PendingQuiz | undefined {
	if (source === undefined) return undefined;
	try {
		const parsed = JSON.parse(source) as Partial<PendingQuiz>;
		if (typeof parsed.question !== "string" || !parsed.question.trim()) return undefined;
		if (!Array.isArray(parsed.options) || !parsed.options.every((option) => typeof option === "string")) return undefined;
		const options = parsed.options.map((option) => option.trim()).filter(Boolean);
		const normalizedCorrectOption = typeof parsed.correctOption === "string" ? parsed.correctOption.trim() : "";
		const correctOption = options.find((option) => option === normalizedCorrectOption);
		return {
			question: parsed.question.trim(),
			options,
			allowFreeform: parsed.allowFreeform !== false,
			...(typeof parsed.conceptId === "string" && parsed.conceptId.trim() ? { conceptId: parsed.conceptId.trim() } : {}),
			...(correctOption ? { correctOption } : {}),
			...(typeof parsed.explanation === "string" && parsed.explanation.trim() ? { explanation: parsed.explanation.trim() } : {}),
			...(typeof parsed.hint === "string" && parsed.hint.trim() ? { hint: parsed.hint.trim() } : {}),
		};
	} catch {
		return undefined;
	}
}
