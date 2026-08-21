import type { ChatHistoryItem } from "../pi/chatHistory";

export interface ChatHistoryGroup { label: string; chats: ChatHistoryItem[]; }

export function filterAndGroupChats(chats: ChatHistoryItem[], query: string, now: Date): ChatHistoryGroup[] {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const groups = new Map<string, ChatHistoryItem[]>();
	for (const chat of chats) {
		if (normalizedQuery && !chat.title.toLocaleLowerCase().includes(normalizedQuery)) continue;
		const label = dateLabel(new Date(chat.updatedAt), now);
		const group = groups.get(label) ?? [];
		group.push(chat);
		groups.set(label, group);
	}
	return [...groups].map(([label, groupedChats]) => ({ label, chats: groupedChats }));
}

function dateLabel(date: Date, now: Date): string {
	const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
	const difference = Math.round((start(now) - start(date)) / 86_400_000);
	if (difference === 0) return "Hoy";
	if (difference === 1) return "Ayer";
	return new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "short" }).format(date).replace(".", "");
}
