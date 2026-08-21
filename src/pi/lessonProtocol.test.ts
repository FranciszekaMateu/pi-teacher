import { describe, expect, it } from "vitest";
import { extractLessonState, lessonGraphMermaid, stripLessonMarkup, type LessonState } from "./lessonProtocol";

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

describe("lessonGraphMermaid", () => {
	const lesson: LessonState = {
		phase: "teach",
		goal: "Differential forms",
		nodes: [
			{ id: "covectors", title: 'Co-vectors ("1-forms")', status: "mastered" },
			{ id: "wedge", title: "Wedge products", status: "current", dependsOn: ["covectors"] },
			{ id: "stokes", title: "Generalized Stokes", status: "locked", dependsOn: ["wedge", "ghost"] },
		],
		sources: [],
	};

	it("renders nodes and only known dependencies as a flowchart", () => {
		const graph = lessonGraphMermaid(lesson);
		expect(graph).toContain("flowchart TD");
		expect(graph).toContain('covectors["Co-vectors (1-forms)"]');
		expect(graph).toContain('covectors["Co-vectors (1-forms)"]:::mastered');
		expect(graph).toContain('wedge["Wedge products"]:::current');
		expect(graph).toContain("covectors --> wedge");
		expect(graph).toContain("wedge --> stokes");
		expect(graph).not.toContain("ghost -->");
		expect(graph).toContain("classDef mastered");
	});
});
