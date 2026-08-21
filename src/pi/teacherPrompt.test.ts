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
});
