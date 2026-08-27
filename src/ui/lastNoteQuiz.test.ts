import { describe, expect, it } from "vitest";
import { isLastNoteQuizRequest } from "./lastNoteQuiz";

describe("isLastNoteQuizRequest", () => {
	it.each([
		"Hazme un quiz de mi última nota",
		"Haceme un cuestionario sobre mi ultima nota",
		"Quiz me on my last note",
		"Please make a quiz about my latest note",
	])("recognizes %s", (prompt) => {
		expect(isLastNoteQuizRequest(prompt)).toBe(true);
	});

	it("does not attach a note for an unrelated quiz request", () => {
		expect(isLastNoteQuizRequest("Hazme un quiz de derivadas")).toBe(false);
	});
});
