import { App, Modal, Notice, Plugin, Setting } from "obsidian";
import type { PiObsidianSettings } from "./settings";
import { VIEW_TYPE_PI_CHAT } from "./constants";
import type { PiSessionService } from "./pi/piSessionService";

export default class PiObsidianPlugin extends Plugin {
	settings: PiObsidianSettings;
	private session: PiSessionService | null = null;

	async onload(): Promise<void> {
		try {
			const basePath = (this.app.vault.adapter as { getBasePath?: () => string }).getBasePath?.();
			if (!basePath) {
				throw new Error("Pi Teacher requires a filesystem-backed desktop vault.");
			}
			const [{ PiObsidianSettingTab, normalizeSettings }, { PiChatView }, { PiSessionService }] = await Promise.all([
				import("./settings"),
				import("./ui/PiChatView"),
				import("./pi/piSessionService"),
			]);
			await this.loadSettings(normalizeSettings);
			this.session = new PiSessionService({
				app: this.app,
				getSettings: () => this.settings,
				saveSettings: () => this.saveSettings(),
			});
			this.registerView(VIEW_TYPE_PI_CHAT, (leaf) => new PiChatView(leaf, this.requireSession(), () => this.settings.uiLanguage));
			this.addSettingTab(new PiObsidianSettingTab(this.app, this));
		} catch (error) {
			const message = error instanceof Error ? error.stack ?? error.message : String(error);
			console.error("[Pi Teacher] Failed to load pi runtime", error);
			try {
				await this.app.vault.adapter.write(`${this.app.vault.configDir}/plugins/pi-teacher/load-error.txt`, message);
			} catch (diagnosticError) {
				console.error("[Pi Teacher] Failed to persist load error", diagnosticError);
			}
			new Notice(`Pi Teacher could not load its runtime:\n${message}`, 0);
			return;
		}

		this.addCommand({
			id: "open-pi-chat",
			name: "Open pi chat",
			callback: () => {
				void this.activateChatView();
			},
		});
		this.addCommand({
			id: "teach-me",
			name: "Teach me something",
			callback: () => {
				new TeachModal(this.app, (topic) => {
					void this.startLesson(topic);
				}).open();
			},
		});
		this.addRibbonIcon("bot", "Pi teacher — teach me something", () => {
			void this.activateChatView();
		});
	}

	onunload(): void {
		this.session?.dispose();
		this.session = null;
	}

	async loadSettings(
		normalizeSettings: (data: Partial<PiObsidianSettings> | null) => PiObsidianSettings,
	): Promise<void> {
		this.settings = normalizeSettings((await this.loadData()) as Partial<PiObsidianSettings> | null);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async startLesson(topic: string): Promise<void> {
		await this.activateChatView();
		await this.requireSession().sendPrompt(
			`Teach me: ${topic}\n\nFollow the full teaching process: probe my current understanding first, then plan the lesson, then walk you through it one reasoning step at a time, quizzing me at every step.`,
		);
	}

	private async activateChatView(): Promise<void> {
		const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_PI_CHAT)[0];
		if (existingLeaf) {
			await this.app.workspace.revealLeaf(existingLeaf);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice("Could not open pi chat view.");
			return;
		}

		await leaf.setViewState({ type: VIEW_TYPE_PI_CHAT, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}

	private requireSession(): PiSessionService {
		if (!this.session) {
			throw new Error("Pi session is not initialized.");
		}
		return this.session;
	}
}

class TeachModal extends Modal {
	private readonly onSubmit: (topic: string) => void;

	constructor(app: App, onSubmit: (topic: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: "Teach me" });
		contentEl.createEl("p", {
			text: "What do you want to learn? The teacher will probe your current understanding, plan the lesson, and walk you through it step by step.",
		});

		let topic = "";
		new Setting(contentEl)
			.setName("Topic")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- proper nouns (Rust, Maxwell)
			.setDesc("e.g. differential forms, Rust ownership, Maxwell's equations…")
			.addText((text) => {
				text.setPlaceholder("What do you want to learn?");
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter" && topic.trim()) {
						this.close();
						this.onSubmit(topic.trim());
					}
				});
				text.onChange((value) => {
					topic = value;
				});
			});

		new Setting(contentEl).addButton((button) => {
			button.setButtonText("Start lesson").setCta().onClick(() => {
				if (!topic.trim()) {
					return;
				}
				this.close();
				this.onSubmit(topic.trim());
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export { VIEW_TYPE_PI_CHAT };
