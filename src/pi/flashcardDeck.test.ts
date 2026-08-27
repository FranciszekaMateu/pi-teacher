import { describe, expect, it } from "vitest";
import { flashcardDeck } from "./flashcardDeck";

describe("flashcardDeck", () => {
	it("creates one central deck per subject, ignoring generic resource folders", () => {
		expect(flashcardDeck([{ kind: "vault", label: "Fuente", path: "02 - University/Aprendizaje Automático/Recursos/Capítulo 1.pdf" }]))
			.toEqual({ subject: "Aprendizaje Automático", tag: "aprendizaje-automatico", path: "05 - Resources/Flashcards/Aprendizaje Automático flashcards.md" });
	});

	it("keeps the established Métodos Numéricos deck name", () => {
		expect(flashcardDeck([{ kind: "vault", label: "Fuente", path: "02 - University/Métodos Numéricos/Apuntes/Error.md" }]).path)
			.toBe("05 - Resources/Flashcards/Métodos Numéricos flashcards.md");
	});

	it("falls back to the generic deck when no vault source exists", () => {
		expect(flashcardDeck([{ kind: "external", label: "URL" }])).toMatchObject({ subject: "Pi Teacher", path: "05 - Resources/Flashcards/Pi Teacher flashcards.md" });
	});
});
