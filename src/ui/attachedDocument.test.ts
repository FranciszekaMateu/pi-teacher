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
});
