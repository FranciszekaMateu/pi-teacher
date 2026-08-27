import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { createModels } from "@earendil-works/pi-ai";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type PiObsidianPlugin from "./main";
import { DEFAULT_MODEL_ID, DEFAULT_PROVIDER, DEFAULT_THINKING_LEVEL } from "./constants";
import type { UiLanguagePref } from "./ui/strings";
import { CodexDeviceLoginModal } from "./ui/CodexLoginModal";
import { loginCodexWithDeviceCode, refreshCodexToken, type OpenAICodexCredentials } from "./pi/openaiCodexOAuth";

export const CODEX_PROVIDER_ID = "openai-codex";

/** Models known to be retired from the ChatGPT subscription (kept out of the dropdown). */
const RETIRED_CODEX_MODEL_PREFIXES = ["gpt-5.1", "gpt-5.2"];

/**
 * Models newer than the bundled catalog in the installed pi-ai release.
 * Added manually so the dropdown shows the latest subscription models
 * (gpt-5.6 terra/luna/sol) without upgrading the whole pi-ai API.
 */
const CODEX_MODELS_5_6: Array<Record<string, unknown>> = [
	{
		id: "gpt-5.6-terra",
		name: "GPT-5.6 Terra",
		api: "openai-codex-responses",
		provider: "openai-codex",
		baseUrl: "https://chatgpt.com/backend-api",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
		contextWindow: 272000,
		maxTokens: 128000,
		thinkingLevelMap: { xhigh: "xhigh", max: "max", minimal: "low" },
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		api: "openai-codex-responses",
		provider: "openai-codex",
		baseUrl: "https://chatgpt.com/backend-api",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 5, output: 30, cacheRead: 0.5, cacheWrite: 6.25 },
		contextWindow: 272000,
		maxTokens: 128000,
		thinkingLevelMap: { xhigh: "xhigh", max: "max", minimal: "low" },
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		api: "openai-codex-responses",
		provider: "openai-codex",
		baseUrl: "https://chatgpt.com/backend-api",
		reasoning: true,
		input: ["text", "image"],
		cost: { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25 },
		contextWindow: 272000,
		maxTokens: 128000,
		thinkingLevelMap: { xhigh: "xhigh", max: "max", minimal: "low" },
	},
];

export function getProviderModels(provider: string): Array<Record<string, unknown>> {
	const modelsStore = createModels();
	const models = modelsStore.getModels(provider) as unknown as Array<Record<string, unknown>>;
	if (provider !== CODEX_PROVIDER_ID) {
		return models;
	}
	const merged = models.filter(
		(model) => !RETIRED_CODEX_MODEL_PREFIXES.some((prefix) => String(model.id).startsWith(prefix)),
	);
	for (const extra of CODEX_MODELS_5_6) {
		if (!merged.some((model) => model.id === extra.id)) {
			merged.push(extra);
		}
	}
	return merged;
}

export interface SecuritySettings {
	/** Allow edit/write tools (vault modifications). Default: false. */
	allowWrite: boolean;
	/** Allow bash tool with the allowlist. Default: false. */
	allowBash: boolean;
	/** Allowlist of bash commands allowed when allowBash is true. */
	bashAllowlist: string[];
	/** Per-command timeout in milliseconds. */
	bashTimeoutMs: number;
	/** Ask for confirmation before every vault mutation. Default: true. */
	confirmBeforeMutation: boolean;
	/** Ask for confirmation before every bash command. Default: true. */
	confirmBeforeBash: boolean;
}

export interface PiObsidianSettings {
	provider: string;
	modelId: string;
	thinkingLevel: ModelThinkingLevel;
	uiLanguage: UiLanguagePref;
	providerApiKeys: Record<string, string>;
	codexRefreshToken: string;
	codexAccountId: string;
	codexTokenExpiresAt: number;
	codexLoginPending: boolean;
	/** Load locally installed Pi extensions, which may register extra providers. */
	loadTrustedPiExtensions: boolean;
	security: SecuritySettings;
}

export const DEFAULT_SETTINGS: PiObsidianSettings = {
	provider: DEFAULT_PROVIDER,
	modelId: DEFAULT_MODEL_ID,
	thinkingLevel: DEFAULT_THINKING_LEVEL,
	uiLanguage: "auto",
	providerApiKeys: {},
	codexRefreshToken: "",
	codexAccountId: "",
	codexTokenExpiresAt: 0,
	codexLoginPending: false,
	loadTrustedPiExtensions: false,
	security: {
		allowWrite: false,
		allowBash: false,
		// Imported lazily below to avoid a circular import.
		bashAllowlist: [],
		bashTimeoutMs: 15000,
		confirmBeforeMutation: true,
		confirmBeforeBash: true,
	},
};

export function normalizeSettings(data: Partial<PiObsidianSettings> | null | undefined): PiObsidianSettings {
	const provider = data?.provider || DEFAULT_PROVIDER;
	const modelId = data?.modelId || DEFAULT_MODEL_ID;
	const thinkingLevel = data?.thinkingLevel || DEFAULT_THINKING_LEVEL;
	const providerApiKeys = data?.providerApiKeys || {};

	return {
		provider,
		modelId,
		thinkingLevel,
		uiLanguage: data?.uiLanguage === "es" || data?.uiLanguage === "en" ? data.uiLanguage : "auto",
		providerApiKeys: { ...providerApiKeys },
		codexRefreshToken: data?.codexRefreshToken ?? "",
		codexAccountId: data?.codexAccountId ?? "",
		codexTokenExpiresAt: data?.codexTokenExpiresAt ?? 0,
		codexLoginPending: data?.codexLoginPending ?? false,
		loadTrustedPiExtensions: data?.loadTrustedPiExtensions ?? false,
		security: {
			allowWrite: data?.security?.allowWrite ?? false,
			allowBash: data?.security?.allowBash ?? false,
			bashAllowlist: data?.security?.bashAllowlist ?? DEFAULT_SETTINGS.security.bashAllowlist,
			bashTimeoutMs: data?.security?.bashTimeoutMs ?? 15000,
			confirmBeforeMutation: data?.security?.confirmBeforeMutation ?? true,
			confirmBeforeBash: data?.security?.confirmBeforeBash ?? true,
		},
	};
}

export function getSelectedModel(settings: PiObsidianSettings) {
	const models = (getProviderModels(settings.provider) as unknown) as Array<{ id: string; name?: string }>;
	const selectedModel = models.find((model) => model.id === settings.modelId);
	if (selectedModel) {
		return selectedModel;
	}

	const fallbackModel = getProviderModels(DEFAULT_PROVIDER).find((model: Record<string, unknown>) => model.id === DEFAULT_MODEL_ID) as { id: string } | undefined;
	if (fallbackModel) {
		return fallbackModel;
	}
	const firstModel = models[0];
	if (!firstModel) {
		throw new Error(`No default model available for ${DEFAULT_PROVIDER}.`);
	}
	return firstModel;
}

export function getPreferredThinkingLevel(settings: PiObsidianSettings): ModelThinkingLevel {
	return settings.thinkingLevel;
}

export class PiObsidianSettingTab extends PluginSettingTab {
	private readonly plugin: PiObsidianPlugin;

	constructor(app: App, plugin: PiObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Pi agent").setHeading();
		containerEl.createEl("p", {
			text: "Prompts, vault content read by tools, and tool results are sent to the model selected in your local installation.",
		});

		this.addPiConfigurationSetting(containerEl);
		this.addLanguageSetting(containerEl);
		this.addSecuritySetting(containerEl);
	}

	private addPiConfigurationSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Models and authentication")
			.setDesc("Pi Teacher uses the models and credentials already configured in Pi at ~/.pi/agent. Sign in or configure a provider in Pi first; the chat selector then lists only its available models. This includes Pi-supported subscriptions and API-key providers such as OpenCode.");

		new Setting(containerEl)
			.setName("Load trusted extensions")
			.setDesc("Allow locally installed extensions to register additional model providers. Enable this only for extensions you trust, because they execute local code.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.loadTrustedPiExtensions);
				toggle.onChange(async (value) => {
					this.plugin.settings.loadTrustedPiExtensions = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private addLanguageSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Interface language")
			.setDesc("Language used by the chat panel. When set to auto, it follows the app language.")
			.addDropdown((dropdown) => {
				dropdown.addOption("auto", "Auto (Obsidian)");
				dropdown.addOption("es", "Español");
				dropdown.addOption("en", "English");
				dropdown.setValue(this.plugin.settings.uiLanguage);
				dropdown.onChange(async (value) => {
					this.plugin.settings.uiLanguage = value as UiLanguagePref;
					await this.plugin.saveSettings();
				});
			});
	}

	private addProviderSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Provider")
			.setDesc("The selected provider uses your subscription with no API key. Other providers are listed for compatibility.")
			.addDropdown((dropdown) => {
				for (const provider of createModels().getProviders()) {
					dropdown.addOption(provider.id, provider.name || provider.id);
				}
				dropdown.setValue(this.plugin.settings.provider);
				dropdown.onChange(async (provider) => {
					this.plugin.settings.provider = provider;
					this.plugin.settings.modelId = (getProviderModels(provider)[0] as { id: string } | undefined)?.id ?? DEFAULT_MODEL_ID;
					this.plugin.settings.thinkingLevel = getPreferredThinkingLevel(this.plugin.settings);
					await this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private addModelSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Model")
			.setDesc("The default is the newest flagship (gpt-5.6-sol). Higher intelligence matters most for teaching quality.")
			.addDropdown((dropdown) => {
				for (const model of getProviderModels(this.plugin.settings.provider) as Array<{ id: string; name?: string }>) {
					dropdown.addOption(model.id, model.name || model.id);
				}
				dropdown.setValue(this.plugin.settings.modelId);
				dropdown.onChange(async (modelId) => {
					this.plugin.settings.modelId = modelId;
					this.plugin.settings.thinkingLevel = getPreferredThinkingLevel(this.plugin.settings);
					await this.plugin.saveSettings();
					this.display();
				});
			});
	}

	private addThinkingSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Thinking level")
			.setDesc("Higher thinking yields better reasoning at the cost of tokens.")
			.addDropdown((dropdown) => {
				for (const level of ["off", "minimal", "low", "medium", "high", "xhigh", "max"]) {
					dropdown.addOption(level, level);
				}
				dropdown.setValue(this.plugin.settings.thinkingLevel);
				dropdown.onChange(async (level) => {
					this.plugin.settings.thinkingLevel = level as ModelThinkingLevel;
					await this.plugin.saveSettings();
				});
			});
	}

	private addApiKeySetting(containerEl: HTMLElement): void {
		if (this.plugin.settings.provider === CODEX_PROVIDER_ID) {
			this.addCodexSubscriptionLogin(containerEl);
			return;
		}
		const provider = this.plugin.settings.provider;
		const label = `${provider} API key`;

		new Setting(containerEl)
			.setName(label)
			.setDesc("Stored locally in Obsidian plugin data and sent only to the selected provider for model requests.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("Enter API key");
				text.setValue(this.plugin.settings.providerApiKeys[provider] ?? "");
				text.onChange(async (apiKey) => {
					this.plugin.settings.providerApiKeys[provider] = apiKey.trim();
					await this.plugin.saveSettings();
				});
			});
	}

	private addCodexSubscriptionLogin(containerEl: HTMLElement): void {
		const stored = this.plugin.settings.providerApiKeys[CODEX_PROVIDER_ID];
		const refresh = this.plugin.settings.codexRefreshToken;
		const isLoggedIn = !!stored && !!refresh && !this.plugin.settings.codexLoginPending;

		new Setting(containerEl)
			.setName("Subscription login")
			.setDesc(
				isLoggedIn
					? "Connected. No API key is needed and the token refreshes automatically."
					: "Sign in to use the Codex models included in your subscription.",
			)
			.addButton((button) => {
				if (isLoggedIn) {
					button.setButtonText("Disconnect").onClick(async () => {
						this.plugin.settings.providerApiKeys[CODEX_PROVIDER_ID] = "";
						this.plugin.settings.codexRefreshToken = "";
						this.plugin.settings.codexAccountId = "";
						await this.plugin.saveSettings();
						this.display();
					});
				} else if (this.plugin.settings.codexLoginPending) {
					button.setButtonText("Cancel login").onClick(async () => {
						this.plugin.settings.codexLoginPending = false;
						await this.plugin.saveSettings();
						new Notice("Codex login cancelled. You can start a new sign-in at any time.");
						this.display();
					});
				} else {
					button.setButtonText("Sign in").setCta().onClick(() => {
						void this.startCodexLogin();
					});
				}
			});
	}

	private addSecuritySetting(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Vault privileges").setHeading();
		containerEl.createEl("p", {
			text: "By default the agent only reads your vault. Opt in to write and bash tools below. The bash tool is sandboxed by an allowlist.",
		});

		new Setting(containerEl)
			.setName("Confirm before running bash")
			.setDesc("Ask for confirmation before each allowlisted command.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.security.confirmBeforeBash);
				toggle.onChange(async (value) => {
					this.plugin.settings.security.confirmBeforeBash = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Confirm before modifying notes")
			.setDesc("Ask for confirmation before each edit or write operation.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.security.confirmBeforeMutation);
				toggle.onChange(async (value) => {
					this.plugin.settings.security.confirmBeforeMutation = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Allow write tools (edit, write)")
			.setDesc("Lets the agent create and modify notes in your vault.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.security.allowWrite);
				toggle.onChange(async (value) => {
					this.plugin.settings.security.allowWrite = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Allow bash tool")
			.setDesc("Runs commands from the allowlist under your vault root. The agent cannot escape it.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.security.allowBash);
				toggle.onChange(async (value) => {
					this.plugin.settings.security.allowBash = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Bash command allowlist")
			.setDesc("Comma-separated list of commands the agent is allowed to run.")
			.addText((text) => {
				text.setValue(this.plugin.settings.security.bashAllowlist.join(", "));
				text.onChange(async (value) => {
					this.plugin.settings.security.bashAllowlist = value
						.split(",")
						.map((s) => s.trim().toLowerCase())
						.filter(Boolean);
					await this.plugin.saveSettings();
				});
			});
	}

	private async startCodexLogin(): Promise<void> {
		this.plugin.settings.codexLoginPending = true;
		void this.plugin.saveSettings();
		this.display();
		this.runDeviceCodeLogin();
	}

	private runDeviceCodeLogin(): void {
		let modal: CodexDeviceLoginModal | null = null;
		const controller = new AbortController();
		const loginPromise = loginCodexWithDeviceCode(
			{
				onUserCode: (device: DeviceAuthInfo) => {
					modal = new CodexDeviceLoginModal(this.app, device, () => controller.abort());
					modal.open();
				},
				onTick: (message: string) => {
					if (modal) modal.setStatus(message);
				},
			},
			controller.signal,
		);

		void (async () => {
			try {
				const credentials: OpenAICodexCredentials = await loginPromise;
				(modal as CodexDeviceLoginModal | null)?.finish();
				this.plugin.settings.providerApiKeys[CODEX_PROVIDER_ID] = credentials.access;
				this.plugin.settings.codexRefreshToken = credentials.refresh;
				this.plugin.settings.codexTokenExpiresAt = credentials.expires;
				this.plugin.settings.codexAccountId = credentials.accountId ?? "";
					new Notice("Connected. Ready to learn!");
			} catch (error) {
				if (!controller.signal.aborted) {
					(modal as CodexDeviceLoginModal | null)?.finish();
				}
				const message = error instanceof Error ? error.message : String(error);
				new Notice(`OpenAI login failed: ${message}`);
			} finally {
				this.plugin.settings.codexLoginPending = false;
				await this.plugin.saveSettings();
				this.display();
			}
		})();
	}

	/** Refresh an expired Codex token before a request if needed. */
	async ensureFreshCodexToken(): Promise<string | undefined> {
		const access = this.plugin.settings.providerApiKeys[CODEX_PROVIDER_ID];
		const refresh = this.plugin.settings.codexRefreshToken;
		if (!access || !refresh) return undefined;
		const expires = this.plugin.settings.codexTokenExpiresAt ?? 0;
		if (Date.now() < expires - 60_000) return access;
		try {
			const creds = await refreshCodexToken(refresh);
			this.plugin.settings.providerApiKeys[CODEX_PROVIDER_ID] = creds.access;
			this.plugin.settings.codexRefreshToken = creds.refresh;
			this.plugin.settings.codexTokenExpiresAt = creds.expires;
			this.plugin.settings.codexAccountId = creds.accountId ?? this.plugin.settings.codexAccountId;
			await this.plugin.saveSettings();
			return creds.access;
		} catch (error) {
			new Notice(`Codex token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}
}

interface DeviceAuthInfo {
	deviceAuthId: string;
	userCode: string;
	intervalSeconds: number;
	verificationUri: string;
}
