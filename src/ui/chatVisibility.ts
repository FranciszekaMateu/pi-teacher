import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { splitQuizSegments } from "../pi/quizProtocol";
import { stripFlashcardsMarkup } from "../pi/flashcards";
import { stripLessonMarkup } from "../pi/lessonProtocol";
import { stripVisualMarkup } from "../pi/visualProtocol";
import { parseAttachedDocumentPrompt } from "./attachedDocument";
import { stripIncompleteProtocolFence } from "../pi/streamingText";

/** The conversation view intentionally excludes internal tool transcripts. */
export function isVisibleChatMessage(message: AgentMessage): boolean {
	if (message.role === "user") return true;
	if (message.role !== "assistant") return false;
	return assistantTextParts(message).some((text) => splitQuizSegments(text).some((segment) => {
		if (segment.type === "quiz") return true;
		return stripFlashcardsMarkup(stripVisualMarkup(stripLessonMarkup(stripIncompleteProtocolFence(segment.text)))).trim().length > 0;
	}));
}

function assistantTextParts(message: AgentMessage): string[] {
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return [content];
	if (!Array.isArray(content)) return [];
	return content
		.filter((part): part is { type?: string; text?: string } => Boolean(part) && typeof part === "object")
		.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text ?? "");
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
