/** Pure selection logic for the latest note; independent from the Obsidian runtime. */
export function latestMarkdownNote<T extends { path: string; extension: string; stat: { mtime: number } }>(files: readonly T[]): T | undefined {
	return files
		// Flashcard decks and Pi Teacher's saved lessons are generated learning
		// material. Saving one must not make it silently replace the learner's
		// latest vault note as the source of a quiz.
		.filter((file) => file.extension.toLowerCase() === "md" && isLearnerNotePath(file.path))
		.reduce<T | undefined>((latest, file) => {
			if (!latest) return file;
			if (file.stat.mtime !== latest.stat.mtime) return file.stat.mtime > latest.stat.mtime ? file : latest;
			return file.path.localeCompare(latest.path) > 0 ? file : latest;
		}, undefined);
}

function isLearnerNotePath(path: string): boolean {
	const folders = path.replace(/\\/g, "/").split("/").slice(0, -1).map((folder) => folder.trim().toLocaleLowerCase());
	return !folders.some((folder) => folder.startsWith(".") || folder === "flashcards" || folder === "pi teacher");
}
