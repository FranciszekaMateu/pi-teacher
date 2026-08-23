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
// Not anchored: the service may prepend injected context (learner profile,
// provided sources) before the attachment block in the same message.
const ATTACHED_DOCUMENT = /<pi-attached-document\s+path="([^"]+)"\s+kind="(Markdown note|PDF text extract)">[\s\S]*?<\/pi-attached-document>\s*/;
const INJECTED_CONTEXT = /<pi-(learner-profile|user-provided-sources)>[\s\S]*?<\/pi-\1>\s*/g;

/** Removes context blocks the service injects into user messages; they are for the model, not the transcript UI. */
export function stripInjectedContext(prompt: string): string {
	return prompt.replace(INJECTED_CONTEXT, "").trim();
}

export function buildAttachedDocumentPrompt(document: AttachedDocument, request: string): string {
	return `${OPEN} path="${document.path}" kind="${document.kind}">\n${document.content}\n${CLOSE}\n\n${request}`;
}

/** Separates private injected context from the small UI attachment preview. */
export function parseAttachedDocumentPrompt(prompt: string): { document?: AttachedDocumentPreview; request: string } {
	const clean = stripInjectedContext(prompt);
	const match = ATTACHED_DOCUMENT.exec(clean);
	if (!match || match.index === undefined) return { request: clean };
	return { document: { path: match[1] ?? "", kind: (match[2] ?? "Markdown note") as AttachedDocument["kind"] }, request: clean.slice(match.index + match[0].length).trim() };
}

export function stripAttachedDocumentMarkup(prompt: string): string {
	return parseAttachedDocumentPrompt(prompt).request;
}
