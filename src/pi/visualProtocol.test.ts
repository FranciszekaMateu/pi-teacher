import { describe, expect, it } from "vitest";
import { extractVisual, sanitizeSvg, stripVisualMarkup } from "./visualProtocol";

describe("visual protocol", () => {
	it("extracts a safe SVG proposal and hides its protocol block", () => {
		const text = "A visual helps.\n```pi-visual\n{\"title\":\"Punto flotante\",\"svg\":\"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><circle cx='5' cy='5' r='4'/></svg>\"}\n```";
		expect(extractVisual(text)).toMatchObject({ title: "Punto flotante" });
		expect(stripVisualMarkup(text)).toBe("A visual helps.");
	});
	it("rejects active or externally loaded SVG", () => {
		expect(sanitizeSvg("<svg><script>alert(1)</script></svg>")).toBeUndefined();
		expect(sanitizeSvg("<svg><image href='https://evil.example/x'/></svg>")).toBeUndefined();
	});
});
