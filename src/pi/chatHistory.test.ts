import { describe, expect, it } from "vitest";
import { parseChatHistory, readChatTranscript } from "./chatHistory";

describe("parseChatHistory", () => {
	it("lists the newest persisted chat with a title from its first user message", () => {
		const files = [
			{ path: "older.jsonl", modified: 10, content: `${JSON.stringify({ type: "session", id: "older", timestamp: "2026-01-01T00:00:00.000Z" })}\n${JSON.stringify({ type: "message", timestamp: "2026-01-01T00:00:01.000Z", message: { role: "user", content: "Older topic" } })}` },
			{ path: "newer.jsonl", modified: 20, content: `${JSON.stringify({ type: "session", id: "newer", timestamp: "2026-01-02T00:00:00.000Z" })}\n${JSON.stringify({ type: "message", timestamp: "2026-01-02T00:00:01.000Z", message: { role: "user", content: [{ type: "text", text: "Explain eigenvectors carefully" }] } })}` },
		];
		const history = parseChatHistory(files);
		expect(history.map((chat) => chat.id)).toEqual(["newer", "older"]);
		expect(history[0]).toMatchObject({ path: "newer.jsonl", title: "Explain eigenvectors carefully", updatedAt: "2026-01-02T00:00:01.000Z" });
	});

	it("skips malformed files and gives unnamed chats a safe fallback title", () => {
		const history = parseChatHistory([
			{ path: "broken.jsonl", modified: 3, content: "not json" },
			{ path: "empty.jsonl", modified: 2, content: JSON.stringify({ type: "session", id: "empty", timestamp: "2026-01-01T00:00:00.000Z" }) },
		]);
		expect(history).toEqual([{ id: "empty", path: "empty.jsonl", title: "New lesson", updatedAt: "2026-01-01T00:00:00.000Z" }]);
	});

	it("restores only user and assistant messages in chronological order", () => {
		const content = [
			JSON.stringify({ type: "session", id: "one" }),
			JSON.stringify({ type: "message", message: { role: "user", content: "Explain limits" } }),
			JSON.stringify({ type: "message", message: { role: "toolResult", content: "hidden" } }),
			JSON.stringify({ type: "message", message: { role: "assistant", content: [{ type: "text", text: "A limit describes..." }] } }),
		].join("\n");
		expect(readChatTranscript(content)).toEqual([
			{ role: "user", content: "Explain limits" },
			{ role: "assistant", content: [{ type: "text", text: "A limit describes..." }] },
		]);
	});
});
