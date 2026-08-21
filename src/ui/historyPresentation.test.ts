import { describe, expect, it } from "vitest";
import { filterAndGroupChats } from "./historyPresentation";

const chats = [
	{ id: "a", path: "a", title: "Métodos numéricos", updatedAt: "2026-08-20T14:00:00.000Z" },
	{ id: "b", path: "b", title: "Álgebra lineal", updatedAt: "2026-08-19T14:00:00.000Z" },
];

describe("filterAndGroupChats", () => {
	it("filters titles and groups recent chats for the picker", () => {
		const result = filterAndGroupChats(chats, "num", new Date("2026-08-20T18:00:00.000Z"));
		expect(result).toEqual([{ label: "Hoy", chats: [chats[0]] }]);
	});
	it("uses a readable date label for older conversations", () => {
		const result = filterAndGroupChats(chats, "", new Date("2026-08-22T18:00:00.000Z"));
		expect(result.map((group) => group.label)).toEqual(["20 ago", "19 ago"]);
	});
});
