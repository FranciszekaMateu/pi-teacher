import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { parseAttachedDocumentPrompt } from "./attachedDocument";

/** The conversation view intentionally excludes internal tool transcripts. */
export function isVisibleChatMessage(message: AgentMessage): boolean {
	return message.role === "user" || message.role === "assistant";
}

/** Visible text of the first user message after the given index (for historical quiz answers). */
export function nextUserMessageText(messages: AgentMessage[], index: number): string | undefined {
	for (let i = index + 1; i < messages.length; i++) {
		const message = messages[i];
		if (!message || message.role !== "user") continue;
		const content = (message as { content?: unknown }).content;
		const raw = typeof content === "string"
			? content
			: Array.isArray(content)
				? content
						.filter((part): part is { type?: string; text?: string } => Boolean(part) && typeof part === "object")
						.filter((part) => part.type === "text" && typeof part.text === "string")
						.map((part) => part.text)
						.join("\n")
				: "";
		const visible = parseAttachedDocumentPrompt(raw).request.trim();
		return visible || undefined;
	}
	return undefined;
}
