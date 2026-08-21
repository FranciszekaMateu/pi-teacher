import { describe, expect, it } from "vitest";
import { buildMasteryFile, learnerProfilePrompt, mergeMastery, parseMasteryFile } from "./masteryStore";
import type { MasteryByConcept, MasteryStatus } from "./learningProgress";

const evidence = (correct: number, incorrect: number): MasteryByConcept[string] => {
	const status: MasteryStatus = correct >= 2 && correct >= incorrect * 2 ? "mastered" : correct + incorrect > 0 ? "learning" : "unknown";
	return { attempted: correct + incorrect, correct, incorrect, status };
};

describe("masteryStore", () => {
	it("round-trips mastery through the file format", () => {
		const mastery: MasteryByConcept = { stokes: evidence(3, 0), flux: evidence(1, 1) };
		const file = buildMasteryFile(mastery, { stokes: "Stokes' theorem" });
		const restored = parseMasteryFile(JSON.stringify(file));
		expect(restored.mastery.stokes).toEqual(mastery.stokes);
		expect(restored.mastery.flux).toEqual(mastery.flux);
		expect(restored.titles.stokes).toBe("Stokes' theorem");
	});

	it("tolerates malformed files", () => {
		expect(parseMasteryFile("not json")).toEqual({ mastery: {}, titles: {} });
		expect(parseMasteryFile('{"version":2}')).toEqual({ mastery: {}, titles: {} });
		expect(parseMasteryFile('{"version":1,"concepts":{"x":{"attempted":"many"}}}')).toEqual({ mastery: {}, titles: {} });
	});

	it("merges by summing evidence, with recomputed status", () => {
		const stored: MasteryByConcept = { flux: evidence(1, 1) };
		const live: MasteryByConcept = { flux: evidence(1, 0) };
		const merged = mergeMastery(stored, live);
		expect(merged.flux).toEqual({ attempted: 3, correct: 2, incorrect: 1, status: "mastered" });
	});

	it("builds a learner profile only when there is something to say", () => {
		expect(learnerProfilePrompt({}, {})).toBeNull();
		const mastery: MasteryByConcept = { stokes: evidence(3, 0), flux: evidence(1, 0) };
		const prompt = learnerProfilePrompt(mastery, { stokes: "Stokes' theorem" });
		expect(prompt).toContain("Mastered");
		expect(prompt).toContain("Stokes' theorem");
		expect(prompt).toContain("Still learning");
		expect(prompt).toContain("flux");
	});
});
