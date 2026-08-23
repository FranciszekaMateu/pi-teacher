import { describe, expect, it } from "vitest";
import { isVisibleChatMessage, nextUserMessageText } from "./chatVisibility";

describe("isVisibleChatMessage", () => {
	it("shows only the learner and final teacher messages", () => {
		expect(isVisibleChatMessage({ role: "user" } as never)).toBe(true);
		expect(isVisibleChatMessage({ role: "assistant" } as never)).toBe(true);
		expect(isVisibleChatMessage({ role: "toolResult" } as never)).toBe(false);
	});
});

describe("nextUserMessageText", () => {
	const messages = [
		{ role: "assistant", content: "pregunta" },
		{ role: "user", content: "El rango" },
		{ role: "assistant", content: "feedback" },
	] as never[];

	it("returns the next user reply's visible text", () => {
		expect(nextUserMessageText(messages, 0)).toBe("El rango");
		expect(nextUserMessageText(messages, 1)).toBeUndefined();
	});

	it("skips injected context inside the reply", () => {
		const withProfile = [
			{ role: "assistant", content: "q" },
			{ role: "user", content: "<pi-practice>\nquiz me\n</pi-practice>" },
		] as never[];
		expect(nextUserMessageText(withProfile, 0)).toBeUndefined();
	});
});
