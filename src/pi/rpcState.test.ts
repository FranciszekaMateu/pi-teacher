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
		const empty = { role: "assistant", content: [{ type: "text", text: "" }] } as never;
		const partial = { role: "assistant", content: [{ type: "text", text: "Ho" }] } as never;
		const more = { role: "assistant", content: [{ type: "text", text: "Hola" }] } as never;
		const userEcho = { role: "user", content: "hola" } as never;

		const started = applyRpcEvent(initial, { type: "agent_start" });
		const withUserEcho = applyRpcEvent(started, { type: "message_end", message: userEcho });
		const streaming = applyRpcEvent(applyRpcEvent(applyRpcEvent(withUserEcho, { type: "message_start", message: empty }), { type: "message_update", message: partial }), { type: "message_update", message: more });

		expect(streaming.streamingMessage).toEqual(more);
		expect(streaming.messages).toEqual([userEcho]);
		expect(streaming.isStreaming).toBe(true);

		const finished = applyRpcEvent(streaming, { type: "message_end", message: more });
		expect(finished.streamingMessage).toBeUndefined();
		expect(finished.messages).toEqual([userEcho, more]);
	});

	it("ignores streaming updates for non-assistant messages", () => {
		const initial = createRpcSnapshot({ provider: "openai-codex", modelId: "gpt-5.6-luna", thinkingLevel: "high" });
		const toolResult = { role: "toolResult", content: [] } as never;
		const snapshot = applyRpcEvent(initial, { type: "message_update", message: toolResult });
		expect(snapshot.streamingMessage).toBeUndefined();
		expect(snapshot).toEqual(initial);
	});
});
