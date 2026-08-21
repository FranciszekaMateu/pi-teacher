import { App, Modal, Notice, Setting } from "obsidian";
import type { DeviceAuthInfo } from "../pi/openaiCodexOAuth";

/**
 * Modal that shows the OpenAI device-code login flow: a code to type at
 * the verification URL. The user can open the link in whichever browser
 * they want (default, another app, their phone…) and type the code there.
 */
export class CodexDeviceLoginModal extends Modal {
	private readonly device: DeviceAuthInfo;
	private readonly onCancel: () => void;
	private statusEl: HTMLElement | null = null;
	private finished = false;

	constructor(app: App, device: DeviceAuthInfo, onCancel: () => void) {
		super(app);
		this.device = device;
		this.onCancel = onCancel;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("codex-login-modal");

		contentEl.createEl("h2", { text: "Sign in with OpenAI" }); // eslint-disable-line obsidianmd/ui/sentence-case -- product name
		contentEl.createEl("p", {
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- product names (Pi Teacher, ChatGPT)
			text: "Open the link below in any browser (on this computer or your phone), then enter the code to authorize Pi Teacher with your ChatGPT subscription.",
		});

		// Verification link — always visible, easy to copy / open anywhere.
		const linkRow = contentEl.createDiv({ cls: "codex-login__link-row" });
		const linkText = linkRow.createEl("a", {
			text: this.device.verificationUri,
			href: this.device.verificationUri,
		});
		linkText.addClass("codex-login__link");
		const openButton = linkRow.createEl("button", { text: "Open browser", cls: "mod-cta" });
		openButton.addEventListener("click", () => {
			window.open(this.device.verificationUri, "_blank");
		});
		const copyLinkButton = linkRow.createEl("button", { text: "Copy link" });
		copyLinkButton.addEventListener("click", () => {
			void navigator.clipboard.writeText(this.device.verificationUri);
			new Notice("Link copied — paste it in any browser to sign in.");
		});

		// The device code — big, monospace, copy button.
		const codeBox = contentEl.createDiv({ cls: "codex-login__code-box" });
		codeBox.createEl("div", { text: "Your code", cls: "codex-login__code-label" });
		const codeRow = codeBox.createDiv({ cls: "codex-login__code-row" });
		codeRow.createEl("code", { text: this.device.userCode, cls: "codex-login__code" });
		const copyCodeButton = codeRow.createEl("button", { text: "Copy" });
		copyCodeButton.addEventListener("click", () => {
			void navigator.clipboard.writeText(this.device.userCode);
			new Notice("Code copied — enter it at the verification page.");
		});

		this.statusEl = contentEl.createDiv({ cls: "codex-login__status" });
		this.setStatus("Waiting for you to authorize the device…");

		contentEl.createEl("small", {
			cls: "codex-login__hint",
			text: "Prefer another browser? Open the link yourself — for example on your phone — and type the code there. This window stays open until you authorize, cancel, or the code expires (15 min).",
		});

		new Setting(contentEl).addButton((button) =>
			button.setButtonText("Cancel").onClick(() => {
				this.close();
				this.onCancel();
			}),
		);
	}

	/** Update the pending status line while the agent polls for authorization. */
	setStatus(message: string): void {
		if (!this.statusEl || this.finished) {
			return;
		}
		this.statusEl.setText(message);
	}

	/** Mark the modal as finished and close it. Safe to call when already closed. */
	finish(): void {
		this.finished = true;
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}