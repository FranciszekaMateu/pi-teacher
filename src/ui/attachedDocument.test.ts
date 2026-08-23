import { describe, expect, it } from "vitest";
import { buildAttachedDocumentPrompt, parseAttachedDocumentPrompt, stripAttachedDocumentMarkup } from "./attachedDocument";

describe("attached document prompt", () => {
	const document = { path: "02 - University/Methods/Practice 1.pdf", kind: "PDF text extract" as const, content: "Hidden document text" };
	it("wraps document context while preserving the learner request", () => {
		const prompt = buildAttachedDocumentPrompt(document, "Explain it simply");
		expect(prompt).toContain("<pi-attached-document");
		expect(prompt).toContain("Hidden document text");
	});
	it("extracts a safe attachment preview separately from the learner request", () => {
		const parsed = parseAttachedDocumentPrompt(buildAttachedDocumentPrompt(document, "Explain it simply"));
		expect(parsed).toEqual({ document: { path: document.path, kind: document.kind }, request: "Explain it simply" });
	});
	it("keeps a plain request when no document context exists", () => {
		expect(parseAttachedDocumentPrompt("Summarize this")).toEqual({ request: "Summarize this" });
		expect(stripAttachedDocumentMarkup(buildAttachedDocumentPrompt(document, "Summarize"))).toBe("Summarize");
	});
	it("hides the attachment and injected context when the profile precedes it", () => {
		const prompt = `<pi-learner-profile>\n- Mastered: something\n</pi-learner-profile>\n\n${buildAttachedDocumentPrompt(document, "Go ahead")}\n\n<pi-user-provided-sources>\n- https://example.com\n</pi-user-provided-sources>`;
		expect(parseAttachedDocumentPrompt(prompt)).toEqual({ document: { path: document.path, kind: document.kind }, request: "Go ahead" });
	});
	it("strips injected context from plain prompts too", () => {
		const prompt = "<pi-learner-profile>\n- Mastered: x\n</pi-learner-profile>\n\nTeach me integrals";
		expect(parseAttachedDocumentPrompt(prompt)).toEqual({ request: "Teach me integrals" });
	});
});
