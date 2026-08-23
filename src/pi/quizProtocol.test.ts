import { describe, expect, it } from "vitest";
import { extractQuiz, shuffleOptions, stripQuizMarkup } from "./quizProtocol";

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
