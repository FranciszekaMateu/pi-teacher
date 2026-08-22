import { describe, expect, it } from "vitest";
import { stripIncompleteProtocolFence } from "./streamingText";

describe("stripIncompleteProtocolFence", () => {
	it("removes a trailing unclosed protocol fence mid-stream", () => {
		const partial = "Vamos a ver.\n\n```pi-quiz\n{\"question\": \"¿Qué es";
		expect(stripIncompleteProtocolFence(partial)).toBe("Vamos a ver.");
	});

	it("keeps closed protocol fences untouched", () => {
		const complete = "Texto\n\n```pi-quiz\n{\"a\":1}\n```\n\nMás";
		expect(stripIncompleteProtocolFence(complete)).toBe(complete);
	});

	it("leaves ordinary code fences alone", () => {
		const code = "```js\nconst x = 1;\n";
		expect(stripIncompleteProtocolFence(code)).toBe(code);
	});

	it("handles text without any fence", () => {
		expect(stripIncompleteProtocolFence("Solo texto")).toBe("Solo texto");
	});
});
