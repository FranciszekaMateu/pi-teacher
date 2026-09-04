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
		const parsed = parseQuizJson(source) as Partial<PendingQuiz>;
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

/**
 * Models occasionally emit TeX commands directly inside a JSON string. Apart
 * from invalid escapes such as `\in`, TeX commands like `\text` are a trap:
 * JSON accepts `\t` but turns it into a tab before the remaining `ext`.
 *
 * Inspect the source before accepting it: raw control words such as `\text`
 * are valid JSON and would otherwise be silently decoded as control characters.
 * The syntax-based repair only operates inside strings, uses explicit math
 * delimiters to disambiguate TeX control words from real JSON escapes, and
 * preserves already escaped TeX.
 */
function parseQuizJson(source: string): unknown {
	const repaired = repairQuizJson(source);
	if (repaired !== source) {
		try {
			return JSON.parse(repaired);
		} catch {
			// Preserve the normal parser error when repair cannot recover the source.
		}
	}
	return JSON.parse(source);
}

function repairQuizJson(source: string): string {
	let repaired = "";
	let cursor = 0;
	while (cursor < source.length) {
		if (source[cursor] !== '"') {
			repaired += source[cursor];
			cursor += 1;
			continue;
		}
		const end = findStringEnd(source, cursor);
		if (end === -1) return source;
		repaired += `"${repairQuizString(source.slice(cursor + 1, end))}"`;
		cursor = end + 1;
	}
	return repaired;
}

function findStringEnd(source: string, start: number): number {
	for (let index = start + 1; index < source.length; index += 1) {
		if (source[index] !== '"') continue;
		let backslashes = 0;
		for (let before = index - 1; before >= start && source[before] === "\\"; before -= 1) backslashes += 1;
		if (backslashes % 2 === 0) return index;
	}
	return -1;
}

function repairQuizString(value: string): string {
	let repaired = "";
	let mathDelimiter: "$" | "$$" | "\\(" | "\\[" | undefined;
	for (let index = 0; index < value.length;) {
		if (value[index] === "$" && value[index - 1] !== "\\" && (mathDelimiter === undefined || mathDelimiter.startsWith("$"))) {
			const delimiter = value.startsWith("$$", index) ? "$$" : "$";
			if (mathDelimiter === undefined) mathDelimiter = delimiter;
			else if (mathDelimiter === delimiter) mathDelimiter = undefined;
			repaired += delimiter;
			index += delimiter.length;
			continue;
		}
		if (value[index] !== "\\") {
			repaired += value[index];
			index += 1;
			continue;
		}
		let end = index;
		while (value[end] === "\\") end += 1;
		const count = end - index;
		const next = value[end] ?? "";
		const validEscape = isJsonEscape(value, end);
		const isTexWordMisreadAsEscape = mathDelimiter !== undefined
			&& validEscape
			&& isLikelyRawTexControlWord(value, end);
		repaired += "\\".repeat(count - (count % 2));
		if (count % 2 === 1) repaired += validEscape && !isTexWordMisreadAsEscape ? "\\" : "\\\\";
		if (count <= 2 && mathDelimiter === undefined && next === "(") mathDelimiter = "\\(";
		else if (count <= 2 && mathDelimiter === undefined && next === "[") mathDelimiter = "\\[";
		else if (count <= 2 && mathDelimiter === "\\(" && next === ")") mathDelimiter = undefined;
		else if (count <= 2 && mathDelimiter === "\\[" && next === "]") mathDelimiter = undefined;
		index = end;
	}
	return repaired;
}

const AMBIGUOUS_TEX_CONTROL_WORDS = new Set([
	"bar", "beta", "bmod", "boxed", "breve",
	"flat", "forall", "frac",
	"nabla", "natural", "ne", "neg", "neq", "nexists", "ni", "not", "notin", "nu",
	"rangle", "rbrace", "rbrack", "rceil", "rfloor", "rho", "right", "rm", "root",
	"tag", "tan", "tanh", "tau", "text", "tfrac", "theta", "tilde", "times", "to", "top",
]);

/**
 * Only b/f/n/r/t need disambiguation: they can start both a JSON control
 * escape and a TeX control word. A maximal control word followed by an
 * argument is strong TeX syntax; common argument-less math commands are
 * recognized explicitly. Valid Unicode escapes always remain JSON escapes.
 */
function isLikelyRawTexControlWord(value: string, index: number): boolean {
	if (!"bfnrt".includes(value[index] ?? "")) return false;
	const word = /^[A-Za-z]+/.exec(value.slice(index))?.[0];
	if (!word || word.length < 2) return false;
	const afterWord = value[index + word.length] ?? "";
	return afterWord === "{" || afterWord === "[" || AMBIGUOUS_TEX_CONTROL_WORDS.has(word);
}

function isJsonEscape(value: string, index: number): boolean {
	const next = value[index] ?? "";
	if ('"\\/'.includes(next) || "bfnrt".includes(next)) return true;
	return next === "u" && /^[0-9a-fA-F]{4}$/.test(value.slice(index + 1, index + 5));
}
