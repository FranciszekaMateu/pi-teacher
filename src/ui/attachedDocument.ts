export interface AttachedDocument {
	path: string;
	kind: "Markdown note" | "PDF text extract";
	content: string;
}

export interface AttachedDocumentPreview {
	path: string;
	kind: AttachedDocument["kind"];
}

const OPEN = "<pi-attached-document";
const CLOSE = "</pi-attached-document>";
const ATTACHED_DOCUMENT = /^<pi-attached-document\s+path="([^"]+)"\s+kind="(Markdown note|PDF text extract)">[\s\S]*?<\/pi-attached-document>\s*/;

export function buildAttachedDocumentPrompt(document: AttachedDocument, request: string): string {
	return `${OPEN} path="${document.path}" kind="${document.kind}">\n${document.content}\n${CLOSE}\n\n${request}`;
}

/** Separates private injected context from the small UI attachment preview. */
export function parseAttachedDocumentPrompt(prompt: string): { document?: AttachedDocumentPreview; request: string } {
	const match = ATTACHED_DOCUMENT.exec(prompt);
	if (!match) return { request: prompt };
	return { document: { path: match[1] ?? "", kind: (match[2] ?? "Markdown note") as AttachedDocument["kind"] }, request: prompt.slice(match[0].length).trim() };
}

export function stripAttachedDocumentMarkup(prompt: string): string {
	return parseAttachedDocumentPrompt(prompt).request;
}
