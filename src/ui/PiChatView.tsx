import { ItemView, Scope, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { VIEW_TYPE_PI_CHAT } from "../constants";
import type { PiSessionService } from "../pi/piSessionService";
import { PiChatApp } from "./PiChatApp";
import { ChatInputController } from "./ChatInputController";
import { resolveUiLanguage, type UiLanguage, type UiLanguagePref } from "./strings";

export class PiChatView extends ItemView {
	private readonly service: PiSessionService;
	private readonly inputController = new ChatInputController();
	private readonly getUiLanguage: () => UiLanguagePref;
	private root: Root | null = null;

	constructor(leaf: WorkspaceLeaf, service: PiSessionService, getUiLanguage: () => UiLanguagePref) {
		super(leaf);
		this.service = service;
		this.getUiLanguage = getUiLanguage;
		this.scope = new Scope(this.app.scope);
		this.scope.register(["Mod"], "Enter", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.inputController.submit();
			return false;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_PI_CHAT;
	}

	getDisplayText(): string {
		return "Pi chat";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
			this.contentEl.empty();
			this.contentEl.addClass("pi-chat-view");
			const locale = (window as { moment?: { locale: () => string } }).moment?.locale() ?? "en";
			const uiLanguage: UiLanguage = resolveUiLanguage(this.getUiLanguage(), locale);
			this.root = createRoot(this.contentEl);
			this.root.render(<PiChatApp app={this.app} service={this.service} inputController={this.inputController} uiLanguage={uiLanguage} />);
		}

	async onClose(): Promise<void> {
		this.inputController.setSubmitHandler(null);
		this.root?.unmount();
		this.root = null;
	}
}
