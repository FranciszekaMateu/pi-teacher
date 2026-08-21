import type { ChatStrings } from "./strings";

export function thinkingStatus(isStreaming: boolean, pendingToolCount: number, strings: ChatStrings): string | null {
	if (!isStreaming) return null;
	return pendingToolCount > 0 ? strings.thinkingWithTools : strings.thinking;
}
