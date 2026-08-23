import { describe, expect, it } from "vitest";
import { extractAllQuizzes, extractQuiz, matchQuizAnswer, shuffleOptions, splitQuizSegments, stripQuizMarkup } from "./quizProtocol";

describe("extractQuiz", () => {
	it("parses a valid pi-quiz fenced block", () => {
		const text = "Check this.\n```pi-quiz\n{\"question\":\"2 + 2?\",\"options\":[\"3\",\"4\"],\"allowFreeform\":false}\n```";
		expect(extractQuiz(text)).toEqual({ question: "2 + 2?", options: ["3", "4"], allowFreeform: false });
	});

	it("keeps grading metadata only when it names an offered option", () => {
		const text = "```pi-quiz\n{\"question\":\"x\",\"options\":[\"A\",\"B\"],\"conceptId\":\"rounding\",\"correctOption\":\"B\"}\n```";
		expect(extractQuiz(text)).toMatchObject({ conceptId: "rounding", correctOption: "B" });
		const invalid = "```pi-quiz\n{\"question\":\"x\",\"options\":[\"A\",\"B\"],\"conceptId\":\"rounding\",\"correctOption\":\"C\"}\n```";
		expect(extractQuiz(invalid)?.correctOption).toBeUndefined();
	});

	it("parses explanation and hint when present and non-empty", () => {
		const text = "```pi-quiz\n{\"question\":\"x\",\"options\":[\"A\",\"B\"],\"allowFreeform\":true,\"hint\":\"Think units\",\"explanation\":\"Because A is defined that way.\"}\n```";
		expect(extractQuiz(text)).toMatchObject({ hint: "Think units", explanation: "Because A is defined that way." });
	});

	it("drops blank or non-string explanation/hint values", () => {
		const blank = "```pi-quiz\n{\"question\":\"x\",\"options\":[\"A\"],\"allowFreeform\":true,\"hint\":\"  \",\"explanation\":42}\n```";
		const quiz = extractQuiz(blank);
		expect(quiz?.hint).toBeUndefined();
		expect(quiz?.explanation).toBeUndefined();
	});

	it("strips every quiz block and keeps the last valid quiz", () => {
		const two = "Previo.\n```pi-quiz\n{\"question\":\"first\",\"options\":[\"A\"]}\n```\n```pi-quiz\n{\"question\":\"second\",\"options\":[\"B\"]}\n```\nFinal.";
		expect(extractQuiz(two)).toMatchObject({ question: "second" });
		expect(stripQuizMarkup(two)).toBe("Previo.\n\nFinal.");
	});

	it("extracts and splits every quiz segment in order", () => {
		const text = "Intro.\n```pi-quiz\n{\"question\":\"q1\",\"options\":[\"A\",\"B\"],\"correctOption\":\"A\"}\n```\nMedio.\n```pi-quiz\n{\"question\":\"q2\",\"options\":[\"C\"]}\n```\nCierre.";
		expect(extractAllQuizzes(text).map((quiz) => quiz.question)).toEqual(["q1", "q2"]);
		const segments = splitQuizSegments(text);
		expect(segments.map((segment) => segment.type)).toEqual(["text", "quiz", "text", "quiz", "text"]);
		const first = segments[0];
		expect(first?.type).toBe("text");
		if (first?.type === "text") expect(first.text).toContain("Intro.");
		const quizSegment = segments[1];
		expect(quizSegment?.type).toBe("quiz");
		if (quizSegment?.type === "quiz") expect(quizSegment.quiz.question).toBe("q1");
	});

	it("matches a historical reply to a quiz option for transcript rendering", () => {
		const quiz = { question: "q", options: ["La precisión", "El rango"], allowFreeform: false, correctOption: "El rango" };
		expect(matchQuizAnswer(quiz, "  El rango ")).toEqual({ selected: "El rango", correct: true });
		expect(matchQuizAnswer(quiz, "La precisión")).toEqual({ selected: "La precisión", correct: false });
		expect(matchQuizAnswer(quiz, "no sé, explícame")).toBeUndefined();
		expect(matchQuizAnswer(quiz, undefined)).toBeUndefined();
	});
});

describe("shuffleOptions", () => {
	it("returns a permutation of the input without mutating it", () => {
		const options = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"];
		const original = [...options];
		const shuffled = shuffleOptions(options);
		expect(shuffled).toHaveLength(options.length);
		for (const option of options) expect(shuffled).toContain(option);
		expect(options).toEqual(original);
	});

	it("handles single-option lists", () => {
		expect(shuffleOptions(["only"])).toEqual(["only"]);
	});
});

describe("stripQuizMarkup", () => {
	it("removes the technical quiz block from the visible answer", () => {
		expect(stripQuizMarkup("Explain briefly.\n```pi-quiz\n{\"question\":\"x\",\"options\":[],\"allowFreeform\":true}\n```"))
			.toBe("Explain briefly.");
	});
});
