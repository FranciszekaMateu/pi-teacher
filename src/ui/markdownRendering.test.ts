import { describe, expect, it, vi } from "vitest";
import { renderChatMarkdown } from "./markdownRendering";

describe("renderChatMarkdown", () => {
	it("uses Obsidian's current renderer API with the app instance", async () => {
		const render = vi.fn(async () => undefined);
		const app = {};
		const element = {} as HTMLElement;
		const component = {};
		await renderChatMarkdown({ render }, app, "$$x^2$$", element, component);
		expect(render).toHaveBeenCalledWith(app, "$$x^2$$", element, "", component);
	});
});
