export interface ObsidianMarkdownRenderer {
	render(app: unknown, markdown: string, element: HTMLElement, sourcePath: string, component: unknown): Promise<void>;
}

export function renderChatMarkdown(renderer: ObsidianMarkdownRenderer, app: unknown, markdown: string, element: HTMLElement, component: unknown): Promise<void> {
	return renderer.render(app, markdown, element, "", component);
}
