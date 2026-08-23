import { describe, expect, it } from "vitest";
import { applyRpcEvent, createRpcSnapshot, hydrateRpcSnapshot } from "./rpcState";

describe("Pi RPC snapshot reducer", () => {
	it("uses the final agent messages and clears the streaming state", () => {
		const initial = createRpcSnapshot({
			provider: "openai-codex",
			modelId: "gpt-5.6-luna",
			thinkingLevel: "high",
		});
		const userMessage = { role: "user", content: "hola" } as never;
		const assistantMessage = { role: "assistant", content: [{ type: "text", text: "Hola" }] } as never;

		const streaming = applyRpcEvent(initial, { type: "agent_start" });
		const withUser = applyRpcEvent(streaming, { type: "message_end", message: userMessage });
		const withAssistant = applyRpcEvent(withUser, { type: "message_end", message: assistantMessage });
		const settled = applyRpcEvent(withAssistant, { type: "agent_end", messages: [userMessage, assistantMessage] });

		expect(streaming.isStreaming).toBe(true);
		expect(settled.isStreaming).toBe(false);
		expect(settled.messages).toEqual([userMessage, assistantMessage]);
	});

	it("adds messages delivered individually by the RPC stream", () => {
		const initial = createRpcSnapshot({
			provider: "openai-codex",
			modelId: "gpt-5.6-luna",
			thinkingLevel: "high",
		});
		const userMessage = { role: "user", content: "hola" } as never;
		const assistantMessage = { role: "assistant", content: [{ type: "text", text: "Hola" }] } as never;

		const withUser = applyRpcEvent(initial, { type: "message_end", message: userMessage });
		const withAssistant = applyRpcEvent(withUser, { type: "message_end", message: assistantMessage });

		expect(withAssistant.messages).toEqual([userMessage, assistantMessage]);
	});

	it("keeps streamed messages when agent_end carries an empty summary", () => {
		const initial = createRpcSnapshot({
			provider: "openai-codex",
			modelId: "gpt-5.6-luna",
			thinkingLevel: "high",
		});
		const assistantMessage = { role: "assistant", content: [{ type: "text", text: "Hola" }] } as never;
		const streamed = applyRpcEvent(initial, { type: "message_end", message: assistantMessage });
		const settled = applyRpcEvent(streamed, { type: "agent_end", messages: [] });

		expect(settled.messages).toEqual([assistantMessage]);
	});

	it("keeps prior turns when a later agent_end only summarizes its own turn", () => {
		const initial = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const firstTurn = { role: "assistant", content: [{ type: "text", text: "First" }] } as never;
		const laterUser = { role: "user", content: [{ type: "text", text: "Second" }] } as never;
		const laterAssistant = { role: "assistant", content: [{ type: "text", text: "Answer" }] } as never;
		const streamed = applyRpcEvent(applyRpcEvent(applyRpcEvent(initial, { type: "message_end", message: firstTurn }), { type: "message_end", message: laterUser }), { type: "message_end", message: laterAssistant });
		const settled = applyRpcEvent(streamed, { type: "agent_end", messages: [laterUser, laterAssistant] });

		expect(settled.messages).toEqual([firstTurn, laterUser, laterAssistant]);
	});

	it("projects agent errors without exposing raw process details", () => {
		const initial = createRpcSnapshot({
			provider: "openai-codex",
			modelId: "gpt-5.6-luna",
			thinkingLevel: "high",
		});

		const snapshot = applyRpcEvent(initial, {
			type: "agent_end",
			messages: [],
			errorMessage: "provider request failed",
		});

		expect(snapshot.errorMessage).toBe("provider request failed");
	});

	it("streams assistant messages token-by-token without duplicating them", () => {
		const initial = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const userEcho = { role: "user", content: "hola" } as never;
		const finalMessage = { role: "assistant", content: [{ type: "text", text: "Hola" }] } as never;

		const started = applyRpcEvent(initial, { type: "agent_start" });
		const withUserEcho = applyRpcEvent(started, { type: "message_end", message: userEcho });
		const streaming = applyRpcEvent(
			applyRpcEvent(
				applyRpcEvent(withUserEcho, { type: "message_start", message: { role: "assistant", content: [] } as never }),
				{ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "Ho" } },
			),
			{ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "la" } },
		);

		expect(streaming.streamingMessage).toEqual({ role: "assistant", content: [{ type: "text", text: "Hola" }] });
		expect(streaming.messages).toEqual([userEcho]);
		expect(streaming.isStreaming).toBe(true);

		const finished = applyRpcEvent(streaming, { type: "message_end", message: finalMessage });
		expect(finished.streamingMessage).toBeUndefined();
		expect(finished.messages).toEqual([userEcho, finalMessage]);
	});

	it("accumulates text deltas at separate content indexes without shifting", () => {
		const initial = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const afterStart = applyRpcEvent(initial, { type: "message_start", message: { role: "assistant", content: [] } as never });
		const withThinking = applyRpcEvent(afterStart, { type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "reasoning…" } });
		const withText = applyRpcEvent(withThinking, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: "Hola" } });

		const content = (withText.streamingMessage as { content: Array<{ type: string; text?: string }> }).content;
		expect(content[1]).toEqual({ type: "text", text: "Hola" });
		expect(readableText(withText.streamingMessage)).toBe("\nHola");
	});

	it("replaces the stream with the final message on the done delta", () => {
		const initial = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const finalMessage = { role: "assistant", content: [{ type: "text", text: "Listo" }] } as never;
		const snapshot = applyRpcEvent(initial, { type: "message_update", assistantMessageEvent: { type: "done", reason: "stop", message: finalMessage } });
		expect(snapshot.streamingMessage).toEqual(finalMessage);
	});

	it("hydrates a reopened transcript: lesson, quiz, and answered quizzes", () => {
		const base = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const user = { role: "user", content: "enséñame punto flotante" } as never;
		const answeredQuiz = { role: "assistant", content: [{ type: "text", text: "Pregunta.\n```pi-quiz\n{\"question\":\"q1\",\"options\":[\"A\"],\"allowFreeform\":false}\n```" }] } as never;
		const answer = { role: "user", content: "A" } as never;
		const lesson = { role: "assistant", content: [{ type: "text", text: "Plan.\n```pi-lesson\n{\"phase\":\"plan\",\"goal\":\"Punto flotante\",\"nodes\":[{\"id\":\"pf\",\"title\":\"Punto flotante\",\"status\":\"current\"}],\"sources\":[]}\n```" }] } as never;
		const pendingQuiz = { role: "assistant", content: [{ type: "text", text: "Siguiente.\n```pi-quiz\n{\"question\":\"q2\",\"options\":[\"B\"],\"allowFreeform\":false,\"correctOption\":\"B\"}\n```" }] } as never;

		const hydrated = hydrateRpcSnapshot(base, [user, answeredQuiz, answer, lesson, pendingQuiz]);

		expect(hydrated.messages).toHaveLength(5);
		expect(hydrated.lesson).toMatchObject({ phase: "plan", goal: "Punto flotante" });
		// The early quiz was answered; only the last one stays pending.
		expect(hydrated.pendingQuiz).toMatchObject({ question: "q2", correctOption: "B" });
	});

	it("keeps the quiz card after the learner replies; only the teacher's next response replaces it", () => {
		const base = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const quiz = { role: "assistant", content: [{ type: "text", text: "```pi-quiz\n{\"question\":\"q\",\"options\":[\"A\"],\"allowFreeform\":false}\n```" }] } as never;
		const withQuiz = applyRpcEvent(base, { type: "message_end", message: quiz });
		expect(withQuiz.pendingQuiz).toMatchObject({ question: "q" });
		const afterReply = applyRpcEvent(withQuiz, { type: "message_end", message: { role: "user", content: "A" } as never });
		expect(afterReply.pendingQuiz).toMatchObject({ question: "q" });
		const afterNextAnswer = applyRpcEvent(afterReply, { type: "message_end", message: { role: "assistant", content: [{ type: "text", text: "Bien." }] } as never });
		expect(afterNextAnswer.pendingQuiz).toBeUndefined();
		expect(afterNextAnswer.quizAnswer).toBeUndefined();
	});

	it("does not resurrect a quiz when the transcript ends with the learner's reply", () => {
		const base = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const quiz = { role: "assistant", content: [{ type: "text", text: "```pi-quiz\n{\"question\":\"q\",\"options\":[\"A\"],\"allowFreeform\":false}\n```" }] } as never;
		const hydrated = hydrateRpcSnapshot(base, [quiz, { role: "user", content: "A" } as never]);
		expect(hydrated.pendingQuiz).toBeUndefined();
		const endsWithQuiz = hydrateRpcSnapshot(base, [quiz]);
		expect(endsWithQuiz.pendingQuiz).toMatchObject({ question: "q" });
	});
});

function readableText(message: unknown): string {
	const content = (message as { content?: unknown }).content;
	if (!Array.isArray(content)) return "";
	return content.map((part) => (part && (part as { type?: string }).type === "text" ? (part as { text?: string }).text ?? "" : "")).join("\n");
}
