import { App, TFile, normalizePath } from "obsidian";
import { PDFParse } from "pdf-parse";
import { Type } from "typebox";
import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { validatePdfRequest } from "./pdfPolicy";

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_CHARS_PER_PAGE = 12_000;

const parameters = Type.Object({
	path: Type.String({ description: "Vault-relative path to a PDF with selectable text." }),
	page_start: Type.Optional(Type.Integer({ minimum: 1, description: "First page, inclusive and 1-indexed." })),
	page_end: Type.Optional(Type.Integer({ minimum: 1, description: "Last page, inclusive and 1-indexed." })),
});

export function createReadPdfTool(app: App): ToolDefinition<typeof parameters> {
	return defineTool({
		name: "read_pdf",
		label: "Read PDF",
		description: "Read selectable text from a PDF inside the vault. Use the narrowest page range necessary. This does not OCR scanned PDFs; cite claims as [[vault/path.pdf]], p. N.",
		promptSnippet: "Read selectable text from a vault PDF with page citations.",
		promptGuidelines: [
			"Use read_pdf only for PDFs with selectable text, never for OCR.",
			"Cite information from a PDF as [[vault/path.pdf]], p. N.",
			"Read the smallest page range that answers the question.",
		],
		parameters,
		executionMode: "sequential",
		async execute(_id, args, signal) {
			if (signal?.aborted) throw new Error("PDF reading was cancelled.");
			const path = normalizePath(args.path.replace(/\\/g, "/"));
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof TFile)) throw new Error(`ENOENT: ${path}`);
			if (file.extension.toLowerCase() !== "pdf") throw new Error("read_pdf only accepts paths ending in .pdf.");
			if (file.stat.size > MAX_PDF_BYTES) throw new Error("PDF exceeds the 30 MiB safety limit.");

			const parser = new PDFParse({ data: new Uint8Array(await app.vault.readBinary(file)) });
			try {
				const info = await parser.getInfo({ parsePageInfo: true });
				const request = validatePdfRequest(path, args.page_start, args.page_end, info.total);
				const sections: string[] = [];
				for (let page = request.pageStart; page <= request.pageEnd; page += 1) {
					if (signal?.aborted) throw new Error("PDF reading was cancelled.");
					const result = await parser.getText({ partial: [page] });
					const raw = result.text.trim();
					const text = raw.length > MAX_CHARS_PER_PAGE
						? `${raw.slice(0, MAX_CHARS_PER_PAGE)}\n\n[Page output truncated at ${MAX_CHARS_PER_PAGE} characters.]`
						: raw || "[No selectable text detected on this page. OCR is not enabled.]";
					sections.push(`Source: [[${request.path}]], p. ${page}\n\n${text}`);
				}
				return { content: [{ type: "text", text: sections.join("\n\n---\n\n") }], details: undefined };
			} finally {
				await parser.destroy();
			}
		},
	});
}
