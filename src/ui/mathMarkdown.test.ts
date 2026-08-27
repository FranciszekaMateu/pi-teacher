import { describe, expect, it } from "vitest";
import { normalizeMathMarkdown, tokenizeQuizText } from "./mathMarkdown";

describe("normalizeMathMarkdown", () => {
	it("turns TeX display delimiters into standalone Obsidian math blocks", () => {
		expect(normalizeMathMarkdown("Antes \\[\nx=\\pm 2\n\\] después"))
			.toBe("Antes \n\n$$\nx=\\pm 2\n$$\n\n después");
	});
	it("turns inline TeX delimiters into dollar math", () => {
		expect(normalizeMathMarkdown("Valor \\(x^2\\)."))
			.toBe("Valor $x^2$.");
	});
	it("trims whitespace inside inline TeX delimiters so Obsidian recognizes math", () => {
		expect(normalizeMathMarkdown("Número \\( \\varepsilon_M \\) cerca de \\(1\\)."))
			.toBe("Número $\\varepsilon_M$ cerca de $1$.");
	});

	it("moves inline math out of Markdown table cells that Obsidian does not typeset", () => {
		const input = ["| Concepto | Significado |", "| --- | --- |", "| Error absoluto | \\(\\vert x-\\tilde x\\vert\\) |", "| Redondeo | Error al representar un número |"];
		expect(normalizeMathMarkdown(input.join("\n"))).toBe(["- **Error absoluto:**", "", "  $\\vert x-\\tilde x\\vert$", "", "- **Redondeo:** Error al representar un número"].join("\n"));
	});
	it("does not change TeX-looking examples inside fenced code", () => {
		expect(normalizeMathMarkdown("```tex\n\\[x\\]\n```\n\\(y\\)"))
			.toBe("```tex\n\\[x\\]\n```\n$y$");
	});
});

describe("tokenizeQuizText", () => {
	it("parses every supported TeX delimiter without inspecting the formula", () => {
		expect(tokenizeQuizText("A $x_i=2$, B \\(f(t)\\), C $$y=3$$ y D \\[z=4\\].")).toEqual([
			{ type: "text", value: "A " },
			{ type: "math", tex: "x_i=2", display: false },
			{ type: "text", value: ", B " },
			{ type: "math", tex: "f(t)", display: false },
			{ type: "text", value: ", C " },
			{ type: "math", tex: "y=3", display: true },
			{ type: "text", value: " y D " },
			{ type: "math", tex: "z=4", display: true },
			{ type: "text", value: "." },
		]);
	});

	it("infers bare formulas from general mathematical syntax", () => {
		expect(tokenizeQuizText("Si e=20, η=0.1 y x_i=0, el cambio es Δw_i.")).toEqual([
			{ type: "text", value: "Si " },
			{ type: "math", tex: "e=20", display: false },
			{ type: "text", value: ", " },
			{ type: "math", tex: "\\eta =0.1", display: false },
			{ type: "text", value: " y " },
			{ type: "math", tex: "x_{i}=0", display: false },
			{ type: "text", value: ", el cambio es " },
			{ type: "math", tex: "\\Delta w_{i}", display: false },
			{ type: "text", value: "." },
		]);
	});

	it("keeps an arbitrary bare equation together and converts Unicode math symbols", () => {
		expect(tokenizeQuizText("Δw_i = ηex_i = 0.1·(−10)·3 = −3. Resultado.")).toEqual([
			{ type: "math", tex: "\\Delta w_{i} = \\eta ex_{i} = 0.1 \\cdot (-10) \\cdot 3 = -3", display: false },
			{ type: "text", value: ". Resultado." },
		]);
	});

	it("does not reinterpret ordinary prose or escaped currency as math", () => {
		expect(tokenizeQuizText("Capítulo 1: cuesta \\$20 y sigue siendo texto.")).toEqual([
			{ type: "text", value: "Capítulo 1: cuesta $20 y sigue siendo texto." },
		]);
	});
});
