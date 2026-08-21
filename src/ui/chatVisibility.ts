import type { AgentMessage } from "@earendil-works/pi-agent-core";

/** The conversation view intentionally excludes internal tool transcripts. */
export function isVisibleChatMessage(message: AgentMessage): boolean {
	return message.role === "user" || message.role === "assistant";
}
