import { describe, expect, it } from "vitest";
import { isVisibleChatMessage } from "./chatVisibility";

describe("isVisibleChatMessage", () => {
	it("shows only the learner and final teacher messages", () => {
		expect(isVisibleChatMessage({ role: "user" } as never)).toBe(true);
		expect(isVisibleChatMessage({ role: "assistant" } as never)).toBe(true);
		expect(isVisibleChatMessage({ role: "toolResult" } as never)).toBe(false);
	});
});
