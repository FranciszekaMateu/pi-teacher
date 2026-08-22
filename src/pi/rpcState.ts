import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import { extractQuiz, type PendingQuiz } from "./quizProtocol";
import { extractLessonState, type LessonState } from "./lessonProtocol";
import { emptyMastery, projectLessonMastery, type MasteryByConcept } from "./learningProgress";
import { extractVisual, type VisualProposal } from "./visualProtocol";
import { extractFlashcards, type FlashcardProposal } from "./flashcards";
import type { ChatHistoryItem } from "./chatHistory";

export interface RpcChatSnapshot {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	isStreaming: boolean;
	pendingToolCalls: string[];
	errorMessage?: string;
	provider: string;
	modelId: string;
	thinkingLevel: ThinkingLevel;
	sessionId?: string;
	sessionPath?: string;
	sessionName?: string;
	session?: { path: string };
	pendingQuiz?: PendingQuiz;
	pendingVisual?: VisualProposal;
	pendingFlashcards?: FlashcardProposal[];
	lesson?: LessonState;
	mastery: MasteryByConcept;
	chatHistory: ChatHistoryItem[];
	activeChatPath?: string;
}

export interface RpcSnapshotSettings {
	provider: string;
	modelId: string;
	thinkingLevel: ThinkingLevel;
}

interface RpcAgentEvent {
	type: string;
	messages?: AgentMessage[];
	errorMessage?: string;
	message?: AgentMessage;
	toolCallId?: string;
	toolName?: string;
}

export function createRpcSnapshot(settings: RpcSnapshotSettings): RpcChatSnapshot {
	return {
		messages: [],
		isStreaming: false,
		pendingToolCalls: [],
		provider: settings.provider,
		modelId: settings.modelId,
		thinkingLevel: settings.thinkingLevel,
		chatHistory: [],
		mastery: emptyMastery(),
	};
}

export function applyRpcEvent(snapshot: RpcChatSnapshot, event: RpcAgentEvent): RpcChatSnapshot {
	if (event.type === "agent_start") {
		return { ...snapshot, errorMessage: undefined, isStreaming: true };
	}
	if (event.type === "tool_execution_start" && event.toolCallId) {
		return {
			...snapshot,
			pendingToolCalls: [...snapshot.pendingToolCalls, event.toolName ?? event.toolCallId],
		};
	}
	if (event.type === "tool_execution_end" && event.toolCallId) {
		return {
			...snapshot,
			pendingToolCalls: snapshot.pendingToolCalls.filter((tool) => tool !== (event.toolName ?? event.toolCallId)),
		};
	}
	if (event.type === "message_start" && event.message?.role === "assistant") {
		return { ...snapshot, streamingMessage: event.message };
	}
	if (event.type === "message_update" && event.message?.role === "assistant") {
		return { ...snapshot, streamingMessage: event.message };
	}
	if (event.type === "message_end" && event.message) {
		const text = readTextContent(event.message);
		const pendingQuiz = event.message.role === "assistant" ? extractQuiz(text) : undefined;
		const pendingVisual = event.message.role === "assistant" ? extractVisual(text) : undefined;
		const pendingFlashcards = event.message.role === "assistant" ? extractFlashcards(text, snapshot.mastery) : [];
		const lesson = event.message.role === "assistant" ? extractLessonState(text) : undefined;
		const projectedLesson = lesson ? projectLessonMastery(lesson, snapshot.mastery) : undefined;
		return { ...snapshot, messages: [...snapshot.messages, event.message], streamingMessage: undefined, pendingQuiz, ...(pendingVisual ? { pendingVisual } : {}), ...(pendingFlashcards.length ? { pendingFlashcards } : {}), ...(projectedLesson ? { lesson: projectedLesson } : {}) };
	}
	if (event.type === "agent_end") {
		return {
			...snapshot,
			messages: snapshot.messages,
			streamingMessage: undefined,
			isStreaming: false,
			pendingToolCalls: [],
			errorMessage: event.errorMessage ?? snapshot.errorMessage,
		};
	}
	return snapshot;
}

function readTextContent(message: AgentMessage): string {
	const content = (message as { content?: unknown }).content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is { type: "text"; text: string } => Boolean(part) && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")
		.map((part) => part.text)
		.join("\n");
}
