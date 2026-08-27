import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import { extractQuiz, type PendingQuiz } from "./quizProtocol";
import { extractLessonState, type LessonState } from "./lessonProtocol";
import { emptyMastery, projectLessonMastery, type MasteryByConcept } from "./learningProgress";
import { extractVisual, type VisualProposal } from "./visualProtocol";
import { extractFlashcards, type FlashcardProposal } from "./flashcards";
import type { ChatHistoryItem } from "./chatHistory";

/** A model Pi has both discovered and authenticated in its shared runtime. */
export interface PiRuntimeModel {
	provider: string;
	id: string;
	name: string;
}

export interface RpcChatSnapshot {
	messages: AgentMessage[];
	streamingMessage?: AgentMessage;
	isStreaming: boolean;
	pendingToolCalls: string[];
	errorMessage?: string;
	provider: string;
	modelId: string;
	thinkingLevel: ThinkingLevel;
	availableModels: PiRuntimeModel[];
	sessionId?: string;
	sessionPath?: string;
	sessionName?: string;
	session?: { path: string };
	pendingQuiz?: PendingQuiz;
	/** Set once the learner answered the pending quiz; the card stays visible (with feedback) until the teacher's next response. */
	quizAnswer?: { selected: string; correct: boolean | null };
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
	assistantMessageEvent?: AssistantStreamDelta;
}

/**
 * The RPC layer strips the accumulated partial message from message_update
 * events (see toJsonEvent in pi-coding-agent) and forwards only the delta,
 * so the transcript must be rebuilt token-by-token here.
 */
interface AssistantStreamDelta {
	type: string;
	contentIndex?: number;
	delta?: string;
	reason?: string;
	message?: AgentMessage;
}

export function createRpcSnapshot(settings: RpcSnapshotSettings): RpcChatSnapshot {
	return {
		messages: [],
		isStreaming: false,
		pendingToolCalls: [],
		provider: settings.provider,
		modelId: settings.modelId,
		thinkingLevel: settings.thinkingLevel,
		availableModels: [],
		chatHistory: [],
		mastery: emptyMastery(),
	};
}

/**
 * Replays a stored transcript through the protocol reducer so a reopened
 * chat recovers everything the live stream would have produced: the lesson
 * plan (and its map), pending quizzes, visuals, flashcards, and message list.
 */
export function hydrateRpcSnapshot(base: RpcChatSnapshot, messages: AgentMessage[]): RpcChatSnapshot {
	let snapshot = { ...base, messages: [] as AgentMessage[] };
	for (const message of messages) {
		snapshot = applyRpcEvent(snapshot, { type: "message_end", message });
	}
	// If the transcript ends with the learner's reply, the last quiz was
	// answered (or bypassed) — do not resurrect it as pending.
	const last = messages.at(-1);
	if (last?.role === "user") {
		return { ...snapshot, pendingQuiz: undefined, quizAnswer: undefined };
	}
	return snapshot;
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
		// Deltas rebuild the content, so start from an empty assistant message.
		return { ...snapshot, streamingMessage: { ...event.message, content: [] } };
	}
	if (event.type === "message_update" && event.assistantMessageEvent) {
		return { ...snapshot, streamingMessage: applyAssistantStreamDelta(snapshot.streamingMessage, event.assistantMessageEvent) };
	}
	if (event.type === "message_end" && event.message) {
		if (event.message.role === "user") {
			// A user reply does not hide the card: it stays as answered feedback
			// until the teacher's next response replaces it.
			return { ...snapshot, messages: [...snapshot.messages, event.message] };
		}
		const text = readTextContent(event.message);
		const pendingQuiz = event.message.role === "assistant" ? extractQuiz(text) : undefined;
		const pendingVisual = event.message.role === "assistant" ? extractVisual(text) : undefined;
		const pendingFlashcards = event.message.role === "assistant" ? extractFlashcards(text, snapshot.mastery) : [];
		const lesson = event.message.role === "assistant" ? extractLessonState(text) : undefined;
		const projectedLesson = lesson ? projectLessonMastery(lesson, snapshot.mastery) : undefined;
		return { ...snapshot, messages: [...snapshot.messages, event.message], streamingMessage: undefined, pendingQuiz, quizAnswer: undefined, ...(pendingVisual ? { pendingVisual } : {}), ...(pendingFlashcards.length ? { pendingFlashcards } : {}), ...(projectedLesson ? { lesson: projectedLesson } : {}) };
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

function emptyStreamingAssistant(): AgentMessage {
	return { role: "assistant", content: [] } as unknown as AgentMessage;
}

/** Accumulates provider deltas into the streaming assistant message. */
function applyAssistantStreamDelta(current: AgentMessage | undefined, delta: AssistantStreamDelta): AgentMessage {
	if (delta.type === "done" && delta.message) return delta.message;
	if (delta.type === "start" || !current) return emptyStreamingAssistant();
	if (delta.type === "text_delta" && typeof delta.delta === "string") {
		return withTextPart(current, delta.contentIndex ?? 0, (existing) => `${existing}${delta.delta}`);
	}
	if (delta.type === "text_end" && typeof delta.contentIndex === "number") {
		// No-op: the accumulated text already matches the final content.
		return current;
	}
	return current;
}

function withTextPart(message: AgentMessage, index: number, update: (existing: string) => string): AgentMessage {
	const source = (message as { content?: unknown }).content;
	const parts: Array<{ type?: string; text?: string }> = Array.isArray(source) ? [...(source as Array<{ type?: string; text?: string }>)] : [];
	// Placeholders keep toolcall/thinking indexes from shifting text parts.
	while (parts.length <= index) parts.push({ type: "text", text: "" });
	const existing = parts[index];
	const existingText = existing?.type === "text" && typeof existing.text === "string" ? existing.text : "";
	parts[index] = { type: "text", text: update(existingText) };
	return { ...message, content: parts } as unknown as AgentMessage;
}
