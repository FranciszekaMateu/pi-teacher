import { describe, expect, it } from "vitest";
import { buildFlashcardAppend, extractFlashcards } from "./flashcards";

describe("Pi Teacher flashcards", () => {
	it("extracts cards only for concepts that still need practice", () => {
		const text = "```pi-flashcards\n{\"cards\":[{\"conceptId\":\"epsilon\",\"question\":\"¿Qué es ε de máquina?\",\"answer\":\"La distancia a 1.\"},{\"conceptId\":\"mastered\",\"question\":\"No incluir\",\"answer\":\"x\"}]}\n```";
		expect(extractFlashcards(text, { epsilon: { status: "learning" }, mastered: { status: "mastered" } })).toEqual([{ conceptId: "epsilon", question: "¿Qué es ε de máquina?", answer: "La distancia a 1." }]);
	});
	it("appends only new questions and preserves scheduling comments", () => {
		const existing = "#flashcards/metodos-numericos\n\n¿Existente?\n?\nRespuesta\n<!--SR:!2026-08-12,1,230-->\n";
		const next = buildFlashcardAppend(existing, [{ conceptId: "x", question: "¿Existente?", answer: "Otra" }, { conceptId: "y", question: "¿Nueva?", answer: "Nueva respuesta" }]);
		expect(next).toContain("<!--SR:!2026-08-12,1,230-->");
		expect(next).toContain("¿Nueva?\n?\nNueva respuesta");
		expect(next.match(/¿Existente\?/g)).toHaveLength(1);
	});
});
