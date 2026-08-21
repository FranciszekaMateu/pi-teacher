import { describe, expect, it } from "vitest";
import { sessionFileToDelete } from "./chatDeletion";

describe("sessionFileToDelete", () => {
	const root = "C:/vault/.pi/agent/sessions";
	it("accepts only a JSONL session directly inside the Pi sessions folder", () => {
		const result = sessionFileToDelete(root, "C:/vault/.pi/agent/sessions/lesson.jsonl");
		expect(result.endsWith("lesson.jsonl")).toBe(true);
	});
	it("rejects paths outside the Pi session folder or non-session files", () => {
		expect(() => sessionFileToDelete(root, "C:/vault/05 - Resources/Pi Teacher/topic.md")).toThrow("refusing");
		expect(() => sessionFileToDelete(root, "C:/vault/.pi/agent/sessions/../auth.json")).toThrow("refusing");
	});
});
