export interface PersistedChatFile {
	path: string;
	modified: number;
	content: string;
}

export interface ChatHistoryItem {
	id: string;
	path: string;
	title: string;
	updatedAt: string;
}

type SessionLine = { type?: string; id?: string; timestamp?: string; message?: { role?: string; content?: unknown } };

export function parseChatHistory(files: PersistedChatFile[]): ChatHistoryItem[] {
	const chats: ChatHistoryItem[] = [];
	for (const file of files) {
		const entries = file.content.split(/\r?\n/).flatMap((line) => {
			try { return line.trim() ? [JSON.parse(line) as SessionLine] : []; } catch { return []; }
		});
		const header = entries.find((entry) => entry.type === "session" && typeof entry.id === "string");
		if (!header?.id) continue;
		const messages = entries.filter((entry) => entry.type === "message" && entry.message?.role === "user");
		const firstUser = messages[0];
		const last = entries.at(-1);
		chats.push({
			id: header.id,
			path: file.path,
			title: titleFromContent(firstUser?.message?.content),
			updatedAt: last?.timestamp ?? header.timestamp ?? new Date(file.modified).toISOString(),
		});
	}
	return chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readChatTranscript(content: string): unknown[] {
	return content.split(/\r?\n/).flatMap((line) => {
		try {
			const entry = JSON.parse(line) as SessionLine;
			const message = entry.type === "message" ? entry.message : undefined;
			return message?.role === "user" || message?.role === "assistant" ? [message] : [];
		} catch { return []; }
	});
}

function titleFromContent(content: unknown): string {
	const text = typeof content === "string"
		? content
		: Array.isArray(content)
			? content.filter((part): part is { type?: string; text?: string } => Boolean(part) && typeof part === "object").filter((part) => part.type === "text" && typeof part.text === "string").map((part) => part.text).join(" ")
			: "";
	const normalized = text.replace(/<pi-attached-document\b[^>]*>[\s\S]*?<\/pi-attached-document>/gi, "").replace(/\s+/g, " ").trim();
	return normalized ? normalized.slice(0, 56) : "New lesson";
}
