import { describe, expect, it } from "vitest";
import { teacherSystemPrompt } from "./teacherPrompt";

describe("teacherSystemPrompt", () => {
	it("requires explanatory Socratic teaching rather than giving away solutions", () => {
		const prompt = teacherSystemPrompt();
		expect(prompt).toContain("Ask a thinking question before giving a solution");
		expect(prompt).toContain("progressive hints");
		expect(prompt).toContain("unless the learner explicitly asks for the full solution");
		expect(prompt).toContain("why each step follows");
	});

	it("requires quiz options to answer the exact question", () => {
		const prompt = teacherSystemPrompt();
		expect(prompt).toContain("If the question asks for a number, formula, calculated result, or next representable value");
		expect(prompt).toContain("exact text of that option");
		expect(prompt).toContain("There must never be more than one active quiz");
		expect(prompt).toContain("pi-visual, then pi-quiz");
	});
});
