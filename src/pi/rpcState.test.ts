import { describe, expect, it } from "vitest";
import { applyRpcEvent, createRpcSnapshot } from "./rpcState";

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
});

function readableText(message: unknown): string {
	const content = (message as { content?: unknown }).content;
	if (!Array.isArray(content)) return "";
	return content.map((part) => (part && (part as { type?: string }).type === "text" ? (part as { text?: string }).text ?? "" : "")).join("\n");
}
