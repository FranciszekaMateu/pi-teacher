import { describe, expect, it } from "vitest";
import { latestMarkdownNote } from "./latestMarkdownNote";

describe("latestMarkdownNote", () => {
	it("chooses the most recently modified Markdown note", () => {
		const files = [
			{ path: "old.md", extension: "md", stat: { mtime: 1 } },
			{ path: "diagram.canvas", extension: "canvas", stat: { mtime: 100 } },
			{ path: "latest.md", extension: "MD", stat: { mtime: 3 } },
		];
		expect(latestMarkdownNote(files)?.path).toBe("latest.md");
	});

	it("ignores generated Pi Teacher material even when it was modified later", () => {
		const files = [
			{ path: "01 - Journal/Daily Notes/2026-08-26.md", extension: "md", stat: { mtime: 10 } },
			{ path: "05 - Resources/Flashcards/Métodos Numéricos flashcards.md", extension: "md", stat: { mtime: 20 } },
			{ path: "05 - Resources/Pi Teacher/Sesión.md", extension: "md", stat: { mtime: 30 } },
			{ path: ".pi/skills/teaching/SKILL.md", extension: "md", stat: { mtime: 40 } },
		];
		expect(latestMarkdownNote(files)?.path).toBe("01 - Journal/Daily Notes/2026-08-26.md");
	});

	it("returns no source if the vault has no Markdown notes", () => {
		expect(latestMarkdownNote([{ path: "board.canvas", extension: "canvas", stat: { mtime: 3 } }])).toBeUndefined();
	});
});
