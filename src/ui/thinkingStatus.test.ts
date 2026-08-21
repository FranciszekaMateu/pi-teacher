import { describe, expect, it } from "vitest";
import { thinkingStatus } from "./thinkingStatus";
import { chatStrings } from "./strings";

describe("thinkingStatus", () => {
	it("keeps background tool work private while giving the learner a useful status", () => {
		const t = chatStrings("en");
		expect(thinkingStatus(false, 0, t)).toBeNull();
		expect(thinkingStatus(true, 0, t)).toBe("Thinking");
		expect(thinkingStatus(true, 1, t)).toBe("Checking your notes");
	});

	it("localizes the status labels", () => {
		const t = chatStrings("es");
		expect(thinkingStatus(true, 0, t)).toBe("Pensando");
		expect(thinkingStatus(true, 2, t)).toBe("Revisando tus notas");
	});
});
