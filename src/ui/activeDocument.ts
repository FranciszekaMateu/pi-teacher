import { App, TFile } from "obsidian";
import { PDFParse } from "pdf-parse";
import { MAX_PDF_PAGES_PER_READ } from "../pi/pdfPolicy";
import type { AttachedDocument } from "./attachedDocument";
import { configurePdfWorkerForObsidian } from "./pdfWorker";
import { latestMarkdownNote } from "./latestMarkdownNote";

const MAX_ATTACHMENT_CHARS = 60_000;
const MAX_PDF_BYTES = 30 * 1024 * 1024;

export async function loadActiveDocument(app: App): Promise<AttachedDocument> {
	const file = app.workspace.getActiveFile();
	if (!(file instanceof TFile)) throw new Error("No active vault file to attach.");
	if (file.extension.toLowerCase() === "md") {
		return { path: file.path, kind: "Markdown note", content: limit(await app.vault.read(file)) };
	}
	if (file.extension.toLowerCase() !== "pdf") throw new Error("The active file must be a Markdown note or a PDF.");
	if (file.stat.size > MAX_PDF_BYTES) throw new Error("The active PDF exceeds the 30 MiB safety limit.");
	return { path: file.path, kind: "PDF text extract", content: await extractPdfText(app, file) };
}

/**
 * Loads the Markdown note the learner worked on most recently. This powers
 * the "quiz me on my last note" shortcut without asking the model to inspect
 * the vault (which it must never do on its own).
 */
export async function loadLatestMarkdownNote(app: App): Promise<AttachedDocument> {
	const file = latestMarkdownNote(app.vault.getMarkdownFiles());
	if (!file) throw new Error("No Markdown notes are available to use for a quiz.");
	return { path: file.path, kind: "Markdown note", content: limit(await app.vault.read(file)) };
}

async function extractPdfText(app: App, file: TFile): Promise<string> {
	PDFParse.setWorker();
	configurePdfWorkerForObsidian();
	const parser = new PDFParse({ data: new Uint8Array(await app.vault.readBinary(file)) });
	try {
		const info = await parser.getInfo({ parsePageInfo: true });
		const sections: string[] = [];
		for (let page = 1; page <= Math.min(info.total, MAX_PDF_PAGES_PER_READ); page += 1) {
			const text = (await parser.getText({ partial: [page] })).text.trim() || "[No selectable text on this page; OCR is disabled.]";
			sections.push(`Source: [[${file.path}]], p. ${page}\n${text}`);
			if (sections.join("\n\n---\n\n").length >= MAX_ATTACHMENT_CHARS) break;
		}
		return limit(sections.join("\n\n---\n\n"));
	} finally {
		await parser.destroy();
	}
}

function limit(text: string): string {
	return text.length <= MAX_ATTACHMENT_CHARS ? text : `${text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n[Attachment truncated at ${MAX_ATTACHMENT_CHARS} characters.]`;
}
