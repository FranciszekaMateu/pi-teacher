/** Converts common LLM TeX delimiters into the Markdown math syntax Obsidian renders. */
export function normalizeMathMarkdown(markdown: string): string {
	// Never rewrite examples that the teacher intentionally put in a fenced code block.
	return markdown.split(/(```[\s\S]*?```)/g).map((part) => {
		if (part.startsWith("```")) return part;
		const normalized = part
			.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math: string) => `\n\n$$\n${safeTeX(math.trim())}\n$$\n\n`)
			.replace(/\\\(([^\n]*?)\\\)/g, (_match, math: string) => `$${safeTeX(math.trim())}$`);
		return unfoldMathTables(normalized);
	}).join("");
}

/** Markdown tables consume raw pipes before MathJax sees inline TeX. */
function safeTeX(math: string): string {
	return math.replace(/\|/g, "\\vert ");
}

/** Obsidian's MarkdownRenderer leaves $...$ literal inside generated table cells. */
function unfoldMathTables(markdown: string): string {
	const lines = markdown.split("\n");
	const output: string[] = [];
	for (let index = 0; index < lines.length; index++) {
		const header = tableCells(lines[index]);
		const separator = tableCells(lines[index + 1]);
		if (!header || !separator || header.length !== 2 || separator.length !== 2 || !separator.every((cell) => /^:?-{3,}:?$/.test(cell))) {
			output.push(lines[index] ?? "");
			continue;
		}
		const rows: string[][] = [];
		let cursor = index + 2;
		while (cursor < lines.length) {
			const row = tableCells(lines[cursor]);
			if (!row || row.length !== 2) break;
			rows.push(row);
			cursor++;
		}
		if (!rows.some((row) => row.some((cell) => /\$[^$]+\$/.test(cell)))) {
			output.push(lines[index] ?? "");
			continue;
		}
		for (const row of rows) {
			const term = row[0] ?? "";
			const meaning = row[1] ?? "";
			if (/\$[^$]+\$/.test(meaning)) output.push(`- **${term}:**`, "", `  ${meaning}`, "");
			else output.push(`- **${term}:** ${meaning}`);
		}
		index = cursor - 1;
	}
	return output.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function tableCells(line: string | undefined): string[] | undefined {
	if (!line?.trim().startsWith("|")) return undefined;
	const trimmed = line.trim();
	if (!trimmed.endsWith("|")) return undefined;
	return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}
