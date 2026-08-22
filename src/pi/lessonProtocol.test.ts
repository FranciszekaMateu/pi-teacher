import { describe, expect, it } from "vitest";
import { extractLessonState, stripLessonMarkup } from "./lessonProtocol";

describe("lesson protocol", () => {
	const message = `Plan listo.\n\n\`\`\`pi-lesson\n{"phase":"plan","goal":"Entender errores numéricos","nodes":[{"id":"floating","title":"Punto flotante","status":"mastered"},{"id":"rounding","title":"Redondeo","status":"current","dependsOn":["floating"]}],"sources":[{"label":"Apunte 1","path":"02 - University/Métodos Numéricos/Apuntes/01.md","kind":"vault"}]}\n\`\`\``;
	it("extracts a persistent lesson map without exposing protocol markup", () => {
		expect(extractLessonState(message)).toMatchObject({ phase: "plan", goal: "Entender errores numéricos", nodes: [{ id: "floating", status: "mastered" }, { id: "rounding", status: "current" }] });
		expect(stripLessonMarkup(message)).toBe("Plan listo.");
	});
	it("rejects malformed or unsafe lesson payloads", () => {
		expect(extractLessonState("```pi-lesson\n{bad}\n``` ")).toBeUndefined();
		expect(extractLessonState("```pi-lesson\n{\"phase\":\"hack\",\"goal\":\"x\",\"nodes\":[]}\n``` ")).toBeUndefined();
	});
});
