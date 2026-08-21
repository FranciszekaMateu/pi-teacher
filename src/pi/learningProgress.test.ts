import { describe, expect, it } from "vitest";
import { applyQuizAttempt, emptyMastery, projectLessonMastery } from "./learningProgress";

describe("local lesson mastery", () => {
	it("promotes a concept after two independently correct quiz answers", () => {
		const once = applyQuizAttempt(emptyMastery(), { conceptId: "rounding", correctOption: "B" }, "B");
		const twice = applyQuizAttempt(once, { conceptId: "rounding", correctOption: "B" }, "B");
		expect(twice.rounding).toMatchObject({ correct: 2, incorrect: 0, status: "mastered" });
	});
	it("does not pretend freeform answers are locally correct", () => {
		expect(applyQuizAttempt(emptyMastery(), { conceptId: "rounding" }, "because precision").rounding).toMatchObject({ attempted: 1, correct: 0, status: "unknown" });
	});
	it("projects verified local mastery onto an agent lesson map", () => {
		const lesson = { phase: "teach" as const, goal: "x", sources: [], nodes: [{ id: "rounding", title: "Redondeo", status: "current" as const }] };
		const mastery = applyQuizAttempt(applyQuizAttempt(emptyMastery(), { conceptId: "rounding", correctOption: "B" }, "B"), { conceptId: "rounding", correctOption: "B" }, "B");
		expect(projectLessonMastery(lesson, mastery).nodes[0]?.status).toBe("mastered");
	});
});
