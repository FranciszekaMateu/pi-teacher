import { describe, expect, it } from "vitest";
import { normalizeMathMarkdown } from "./mathMarkdown";

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
