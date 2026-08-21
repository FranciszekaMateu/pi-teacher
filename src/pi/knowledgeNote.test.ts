import { describe, expect, it } from "vitest";
import { buildKnowledgeNote, noteContentChanged, sourceChatId } from "./knowledgeNote";

describe("knowledge notes", () => {
	const messages = [
		{ role: "user", content: "Enséñame punto flotante" },
		{ role: "assistant", content: [{ type: "text", text: "La mantisa guarda los dígitos significativos.\n```pi-quiz\n{\"question\":\"¿Qué representa la mantisa?\",\"options\":[\"Dígitos significativos\",\"El signo\"],\"allowFreeform\":true}\n```" }] },
		{ role: "user", content: "Dígitos significativos" },
	];

	it("creates a Spanish knowledge note with a stable chat marker", () => {
		const result = buildKnowledgeNote(messages, "session-123", new Date("2026-08-20T10:30:00.000Z"));
		expect(result.title).toBe("Enséñame punto flotante");
		expect(result.markdown).toContain("pi_teacher_chat: session-123");
		expect(result.markdown).toContain("## Núcleo de conocimiento");
		expect(result.markdown).toContain("La mantisa guarda los dígitos significativos.");
		expect(result.markdown).toContain("## Práctica y recuperación");
		expect(result.markdown).toContain("¿Qué representa la mantisa?");
		expect(result.markdown).toContain("**Respuesta de Fran:** Dígitos significativos");
		expect(result.markdown).not.toContain("pi-quiz");
	});

	it("does not consider an identical export new knowledge", () => {
		const markdown = buildKnowledgeNote(messages, "session-123", new Date("2026-08-20T10:30:00.000Z")).markdown;
		expect(noteContentChanged(markdown, markdown)).toBe(false);
	});

	it("uses a persisted session filename as the stable source id", () => {
		expect(sourceChatId("C:/vault/.pi/agent/sessions/abc.jsonl", messages)).toBe("abc.jsonl");
	});
});
