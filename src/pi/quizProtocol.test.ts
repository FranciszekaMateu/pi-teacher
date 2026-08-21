import { describe, expect, it } from "vitest";
import { extractQuiz, stripQuizMarkup } from "./quizProtocol";

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
});

describe("stripQuizMarkup", () => {
	it("removes the technical quiz block from the visible answer", () => {
		expect(stripQuizMarkup("Explain briefly.\n```pi-quiz\n{\"question\":\"x\",\"options\":[],\"allowFreeform\":true}\n```"))
			.toBe("Explain briefly.");
	});
});
