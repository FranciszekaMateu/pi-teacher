import { describe, expect, it } from "vitest";
import { validatePdfRequest } from "./pdfPolicy";

describe("validatePdfRequest", () => {
	it("accepts a vault-relative inclusive page range", () => {
		expect(
			validatePdfRequest("02 - University/Aprendizaje Automático/Recursos/Capítulo 1 - Introducción.pdf", 2, 4, 19),
		).toEqual({ path: "02 - University/Aprendizaje Automático/Recursos/Capítulo 1 - Introducción.pdf", pageStart: 2, pageEnd: 4 });
	});

	it("defaults to the full document when no range is provided", () => {
		expect(validatePdfRequest("Recursos/lecture.pdf", undefined, undefined, 3)).toEqual({
			path: "Recursos/lecture.pdf",
			pageStart: 1,
			pageEnd: 3,
		});
	});

	it("rejects paths outside the vault", () => {
		expect(() => validatePdfRequest("../secrets.pdf", 1, 1, 1)).toThrow("vault-relative");
		expect(() => validatePdfRequest("C:/outside.pdf", 1, 1, 1)).toThrow("vault-relative");
	});

	it("rejects non-PDF paths and ranges over 25 pages", () => {
		expect(() => validatePdfRequest("Recursos/lecture.md", 1, 1, 1)).toThrow(".pdf");
		expect(() => validatePdfRequest("Recursos/book.pdf", 1, 26, 30)).toThrow("25 pages");
	});
});
