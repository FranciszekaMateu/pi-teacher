import type { LessonSource } from "./lessonProtocol";

const FOLDER = "05 - Resources/Flashcards";
const GENERIC_FOLDERS = new Set(["recursos", "resources", "material", "materials", "documentos", "documents", "apuntes", "notes", "assets", "attachments"]);

export interface FlashcardDeck {
	path: string;
	tag: string;
	subject: string;
}

/** Resolves a stable, central deck per subject without moving older decks. */
export function flashcardDeck(sources: LessonSource[]): FlashcardDeck {
	const subject = sources.map((source) => sourceSubject(source)).find((value): value is string => Boolean(value)) ?? "Pi Teacher";
	return {
		path: `${FOLDER}/${subject} flashcards.md`,
		tag: slugify(subject),
		subject,
	};
}

function sourceSubject(source: LessonSource): string | undefined {
	if (source.kind !== "vault" || !source.path) return undefined;
	const parts = source.path.replace(/\\/g, "/").split("/").filter(Boolean);
	parts.pop(); // File name, including PDF sources.
	for (let index = parts.length - 1; index >= 0; index--) {
		const candidate = cleanSubject(parts[index] ?? "");
		if (!candidate || GENERIC_FOLDERS.has(candidate.toLocaleLowerCase()) || /^\d+\s*-/.test(parts[index] ?? "")) continue;
		return candidate;
	}
	return undefined;
}

function cleanSubject(value: string): string {
	const printable = Array.from(value, (character) => character.charCodeAt(0) >= 32 ? character : "").join("");
	return printable.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim().slice(0, 72);
}

function slugify(value: string): string {
	const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	return slug || "pi-teacher";
}
