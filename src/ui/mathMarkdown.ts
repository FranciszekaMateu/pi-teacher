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

export type QuizTextSegment =
	| { type: "text"; value: string }
	| { type: "math"; tex: string; display: boolean };

/**
 * Splits arbitrary quiz copy into prose and math without knowing the subject or
 * formula in advance. Explicit TeX delimiters always win. As a defensive
 * fallback for model output that omits delimiters, expressions are recognized
 * from mathematical syntax (operators, Greek symbols, accents and subscripts).
 */
export function tokenizeQuizText(text: string): QuizTextSegment[] {
	const explicit = tokenizeDelimitedMath(text);
	const result: QuizTextSegment[] = [];
	for (const segment of explicit) {
		if (segment.type === "math") {
			pushSegment(result, segment);
			continue;
		}
		for (const inferred of tokenizeBareMath(segment.value)) pushSegment(result, inferred);
	}
	return result;
}

function tokenizeDelimitedMath(text: string): QuizTextSegment[] {
	const result: QuizTextSegment[] = [];
	let proseStart = 0;
	let index = 0;
	while (index < text.length) {
		const delimiter = delimiterAt(text, index);
		if (!delimiter) {
			index++;
			continue;
		}
		const closeAt = findClosingDelimiter(text, index + delimiter.open.length, delimiter.close, delimiter.display);
		if (closeAt < 0) {
			index += delimiter.open.length;
			continue;
		}
		if (proseStart < index) pushSegment(result, { type: "text", value: unescapeDollar(text.slice(proseStart, index)) });
		const tex = text.slice(index + delimiter.open.length, closeAt).trim();
		if (tex) pushSegment(result, { type: "math", tex, display: delimiter.display });
		else pushSegment(result, { type: "text", value: text.slice(index, closeAt + delimiter.close.length) });
		index = closeAt + delimiter.close.length;
		proseStart = index;
	}
	if (proseStart < text.length) pushSegment(result, { type: "text", value: unescapeDollar(text.slice(proseStart)) });
	return result;
}

function delimiterAt(text: string, index: number): { open: string; close: string; display: boolean } | undefined {
	if (isEscaped(text, index)) return undefined;
	if (text.startsWith("$$", index)) return { open: "$$", close: "$$", display: true };
	if (text[index] === "$") return { open: "$", close: "$", display: false };
	if (text.startsWith("\\(", index)) return { open: "\\(", close: "\\)", display: false };
	if (text.startsWith("\\[", index)) return { open: "\\[", close: "\\]", display: true };
	return undefined;
}

function findClosingDelimiter(text: string, start: number, close: string, display: boolean): number {
	for (let index = start; index <= text.length - close.length; index++) {
		if (!display && text[index] === "\n") return -1;
		if (text.startsWith(close, index) && !isEscaped(text, index)) return index;
	}
	return -1;
}

function isEscaped(text: string, index: number): boolean {
	let slashes = 0;
	for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor--) slashes++;
	return slashes % 2 === 1;
}

function unescapeDollar(text: string): string {
	return text.replace(/\\\$/g, "$");
}

const IDENTIFIER = "[A-Za-zΑ-Ωα-ω][A-Za-z0-9Α-Ωα-ω\\p{M}]*(?:_[A-Za-z0-9Α-Ωα-ω]+)?(?:\\([^()\\n]*\\))?";
const NUMBER = "[−-]?\\d+(?:[.,]\\d+)?";
const OPERAND = `(?:${IDENTIFIER}|${NUMBER}|\\([^()\\n]+\\))`;
const OPERATOR = "(?:=|←|→|≤|≥|≠|≈|±|\\+|−|-|·|×|÷|/|\\*)";
const EXPRESSION = `${OPERAND}(?:\\s*${OPERATOR}\\s*${OPERAND})+`;
const MARKED_IDENTIFIER = `(?:[A-Za-zΑ-Ωα-ω][A-Za-z0-9Α-Ωα-ω\\p{M}]*_[A-Za-z0-9Α-Ωα-ω]+|[A-Za-zΑ-Ωα-ω]*[Α-Ωα-ω][A-Za-z0-9Α-Ωα-ω\\p{M}]*(?:_[A-Za-z0-9Α-Ωα-ω]+)?|[A-Za-zΑ-Ωα-ω]+\\p{M}+(?:\\([^()\\n]*\\))?)`;
const BARE_MATH = new RegExp(`${EXPRESSION}|${MARKED_IDENTIFIER}`, "gu");

function tokenizeBareMath(text: string): QuizTextSegment[] {
	const result: QuizTextSegment[] = [];
	let cursor = 0;
	for (const match of text.matchAll(BARE_MATH)) {
		const index = match.index;
		if (index > cursor) pushSegment(result, { type: "text", value: text.slice(cursor, index) });
		pushSegment(result, { type: "math", tex: unicodeMathToTeX(match[0]), display: false });
		cursor = index + match[0].length;
	}
	if (cursor < text.length) pushSegment(result, { type: "text", value: text.slice(cursor) });
	return result;
}

const TEX_SYMBOLS: Readonly<Record<string, string>> = {
	"Α": "A", "Β": "B", "Γ": "\\Gamma ", "Δ": "\\Delta ", "Ε": "E", "Ζ": "Z", "Η": "H", "Θ": "\\Theta ", "Ι": "I", "Κ": "K", "Λ": "\\Lambda ", "Μ": "M", "Ν": "N", "Ξ": "\\Xi ", "Ο": "O", "Π": "\\Pi ", "Ρ": "P", "Σ": "\\Sigma ", "Τ": "T", "Υ": "\\Upsilon ", "Φ": "\\Phi ", "Χ": "X", "Ψ": "\\Psi ", "Ω": "\\Omega ",
	"α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\epsilon ", "ζ": "\\zeta ", "η": "\\eta ", "θ": "\\theta ", "ι": "\\iota ", "κ": "\\kappa ", "λ": "\\lambda ", "μ": "\\mu ", "ν": "\\nu ", "ξ": "\\xi ", "ο": "o", "π": "\\pi ", "ρ": "\\rho ", "ς": "\\varsigma ", "σ": "\\sigma ", "τ": "\\tau ", "υ": "\\upsilon ", "φ": "\\phi ", "χ": "\\chi ", "ψ": "\\psi ", "ω": "\\omega ",
	"−": "-", "·": " \\cdot ", "×": " \\times ", "÷": " \\div ", "←": " \\leftarrow ", "→": " \\rightarrow ", "≤": " \\leq ", "≥": " \\geq ", "≠": " \\neq ", "≈": " \\approx ", "±": "\\pm ", "∞": "\\infty ", "√": "\\sqrt{}",
};

function unicodeMathToTeX(value: string): string {
	const withAccents = value.replace(/([A-Za-zΑ-Ωα-ω])([̂̄̇̈])/gu, (_match, symbol: string, accent: string) => {
		const command = accent === "̂" ? "hat" : accent === "̄" ? "bar" : accent === "̇" ? "dot" : "ddot";
		return `\\${command}{${TEX_SYMBOLS[symbol]?.trim() ?? symbol}}`;
	});
	const withSubscripts = withAccents.replace(/_([A-Za-z0-9Α-Ωα-ω]+)/gu, (_match, subscript: string) => `_{${mapMathSymbols(subscript).trim()}}`);
	return mapMathSymbols(withSubscripts).replace(/\s+/g, " ").trim();
}

function mapMathSymbols(value: string): string {
	return Array.from(value, (symbol) => TEX_SYMBOLS[symbol] ?? symbol).join("");
}

function pushSegment(target: QuizTextSegment[], segment: QuizTextSegment): void {
	if (segment.type === "text" && !segment.value) return;
	const previous = target.at(-1);
	if (segment.type === "text" && previous?.type === "text") previous.value += segment.value;
	else target.push(segment);
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
