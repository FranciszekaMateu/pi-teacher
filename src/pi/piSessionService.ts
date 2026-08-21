import { App, Notice, normalizePath, TFile } from "obsidian";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import { getPreferredThinkingLevel, type PiObsidianSettings } from "../settings";
import { applyRpcEvent, createRpcSnapshot, type RpcChatSnapshot } from "./rpcState";
import { resolveNodeExecutable } from "./nodeExecutable";
import { withRpcTimeout } from "./rpcTimeout";
import { parseChatHistory, readChatTranscript, type ChatHistoryItem } from "./chatHistory";
import { sessionFileToDelete } from "./chatDeletion";
import { buildKnowledgeNote, noteContentChanged, sourceChatId } from "./knowledgeNote";
import { applyQuizAttempt } from "./learningProgress";
import type { VisualProposal } from "./visualProtocol";
import { providedSourceUrls } from "./providedSources";
import { teacherSystemPrompt } from "./teacherPrompt";
import { buildFlashcardAppend, type FlashcardProposal } from "./flashcards";

export type ChatSnapshot = RpcChatSnapshot;
type SnapshotListener = (snapshot: ChatSnapshot) => void;

type RpcResponse = {
	type: "response";
	id?: number;
	command?: string;
	success: boolean;
	data?: { sessionId?: string; sessionFile?: string; sessionName?: string };
	error?: string;
};

type RpcEvent = { type: string; [key: string]: unknown };
type PendingRequest = { command: string; resolve: (value: RpcResponse) => void; reject: (error: Error) => void };

export interface PiSessionServiceOptions {
	getSettings: () => PiObsidianSettings;
	saveSettings: () => Promise<void>;
	app: App;
}

/**
 * Renderer-side proxy for Pi's official `--mode rpc` process.
 *
 * No provider request or OAuth code runs in Obsidian's Chromium renderer. The
 * spawned Node process owns Pi, its HTTP dispatcher, and the JSONL protocol.
 */
export class PiSessionService {
	private readonly app: App;
	private readonly getSettings: () => PiObsidianSettings;
	private readonly saveSettings: () => Promise<void>;
	private readonly listeners = new Set<SnapshotListener>();
	private child: ChildProcessWithoutNullStreams | null = null;
	private initialization: Promise<void> | null = null;
	private snapshot: ChatSnapshot;
	private nextRequestId = 1;
	private readonly pending = new Map<number, PendingRequest>();
	private stdoutBuffer = "";
	private readonly stdoutDecoder = new StringDecoder("utf8");
	private stderr = "";
	private resumeSessionPath: string | null = null;

	constructor(options: PiSessionServiceOptions) {
		this.app = options.app;
		this.getSettings = options.getSettings;
		this.saveSettings = options.saveSettings;
		this.snapshot = this.createSnapshot();
	}

	subscribe(listener: SnapshotListener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot);
		return () => this.listeners.delete(listener);
	}

	getSnapshot(): ChatSnapshot {
		return this.snapshot;
	}

	async initialize(): Promise<void> {
		if (this.child && this.child.exitCode === null) return;
		if (this.initialization) return this.initialization;
		this.initialization = this.startProcess();
		try {
			await this.initialization;
		} finally {
			this.initialization = null;
		}
	}

	async listChatHistory(): Promise<void> {
		const sessionsDir = join(getVaultBasePath(this.app), ".pi", "agent", "sessions");
		try {
			const names = (await readdir(sessionsDir)).filter((name) => name.endsWith(".jsonl"));
			const files = await Promise.all(names.map(async (name) => {
				const path = join(sessionsDir, name);
				const [content, details] = await Promise.all([readFile(path, "utf8"), stat(path)]);
				return { path, content, modified: details.mtimeMs };
			}));
			this.snapshot = { ...this.snapshot, chatHistory: parseChatHistory(files) };
			this.notify();
		} catch {
			this.snapshot = { ...this.snapshot, chatHistory: [] };
			this.notify();
		}
	}

	async openChat(chat: ChatHistoryItem): Promise<void> {
		if (this.snapshot.isStreaming) {
			this.setError("Wait for the current response before opening another chat.");
			return;
		}
		try {
			const transcript = readChatTranscript(await readFile(chat.path, "utf8")) as AgentMessage[];
			this.resumeSessionPath = chat.path;
			const child = this.child;
			this.child = null;
			try { child?.kill("SIGTERM"); } catch { /* process is already gone */ }
			this.snapshot = { ...this.createSnapshot(), messages: transcript, chatHistory: this.snapshot.chatHistory, activeChatPath: chat.path };
			this.notify();
			await this.initialize();
		} catch (error) {
			this.setError(toSafeError(error));
		}
	}

	async deleteChat(chat: ChatHistoryItem): Promise<void> {
		if (this.snapshot.isStreaming) {
			this.setError("Wait for the current response before deleting a chat.");
			return;
		}
		if (!window.confirm(`Delete this chat permanently?\n\n${chat.title}\n\nThis deletes only the chat history. Knowledge notes are kept.`)) return;
		try {
			const wasActive = chat.path === this.snapshot.activeChatPath;
			if (wasActive) {
				this.resumeSessionPath = null;
				const child = this.child;
				this.child = null;
				try { child?.kill("SIGTERM"); } catch { /* process is already gone */ }
			}
			const sessionsDir = join(getVaultBasePath(this.app), ".pi", "agent", "sessions");
			await rm(sessionFileToDelete(sessionsDir, chat.path), { force: false });
			this.snapshot = { ...this.snapshot, chatHistory: this.snapshot.chatHistory.filter((item) => item.path !== chat.path) };
			this.notify();
			if (wasActive) await this.newSession();
			new Notice("Chat deleted. Knowledge notes were kept.");
		} catch (error) {
			this.setError(toSafeError(error));
		}
	}

	async saveKnowledgeNote(): Promise<void> {
		if (!this.snapshot.messages.some((message) => message.role === "assistant")) {
			this.setError("Wait for a Teacher response before saving a knowledge note.");
			return;
		}
		const folder = "05 - Resources/Pi Teacher";
		const chatId = sourceChatId(this.snapshot.activeChatPath, this.snapshot.messages);
		try {
			const existing = await findKnowledgeNote(this.app, folder, chatId);
			const existingContent = existing ? await this.app.vault.read(existing) : undefined;
			const note = buildKnowledgeNote(this.snapshot.messages, chatId, new Date(), this.snapshot.lesson);
			if (existing && existingContent && !noteContentChanged(existingContent, note.markdown)) {
				new Notice("Knowledge note is already up to date.");
				return;
			}
			const action = existing ? "Update" : "Create";
			const target = existing?.path ?? `${folder}/${ensureSafeFileStem(note.title)}.md`;
			if (!window.confirm(`${action} this knowledge note?\n\n${target}`)) return;
			if (existing) {
				await this.app.vault.modify(existing, note.markdown);
				new Notice(`Knowledge note updated: ${existing.path}`);
				return;
			}
			await ensureVaultFolder(this.app, folder);
			const path = uniqueKnowledgePath(this.app, folder, note.title);
			await this.app.vault.create(path, note.markdown);
			new Notice(`Knowledge note saved: ${path}`);
		} catch (error) {
			this.setError(toSafeError(error));
		}
	}

	async saveVisual(visual: VisualProposal): Promise<void> {
		const folder = "05 - Resources/Pi Teacher/Visuals";
		const path = `${folder}/${ensureSafeFileStem(visual.title)}.svg`;
		if (!window.confirm(`Save this SVG visual to your vault?\n\n${path}`)) return;
		try {
			await ensureVaultFolder(this.app, folder);
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) await this.app.vault.modify(existing, visual.svg);
			else await this.app.vault.create(path, visual.svg);
			this.snapshot = { ...this.snapshot, pendingVisual: undefined };
			this.notify();
			new Notice(`Visual saved: ${path}`);
		} catch (error) { this.setError(toSafeError(error)); }
	}

	async saveFlashcards(cards: FlashcardProposal[]): Promise<void> {
		const target = flashcardDeckPath(this.snapshot.lesson?.sources.map((source) => source.path).filter((path): path is string => Boolean(path)) ?? []);
		const existing = this.app.vault.getAbstractFileByPath(target);
		const content = existing instanceof TFile ? await this.app.vault.read(existing) : `#flashcards/${target.includes("Métodos Numéricos") ? "metodos-numericos" : "pi-teacher"}\n`;
		const next = buildFlashcardAppend(content, cards);
		if (next === content) { new Notice("Those flashcards are already in the deck."); return; }
		if (!window.confirm(`Add ${cards.length} flashcard proposal(s) to Spaced Repetition?\n\n${target}`)) return;
		try {
			await ensureVaultFolder(this.app, target.split("/").slice(0, -1).join("/"));
			if (existing instanceof TFile) await this.app.vault.modify(existing, next); else await this.app.vault.create(target, next);
			this.snapshot = { ...this.snapshot, pendingFlashcards: undefined };
			this.notify();
			new Notice(`Flashcards saved: ${target}`);
		} catch (error) { this.setError(toSafeError(error)); }
	}

	async sendPrompt(prompt: string, images?: Array<{ type: "image"; data: string; mimeType: string }>): Promise<void> {
		await this.initialize();
		if (this.snapshot.isStreaming) {
			this.setError("The agent is already responding.");
			return;
		}
		this.snapshot = { ...this.snapshot, errorMessage: undefined };
		this.notify();
		const sourceUrls = providedSourceUrls(prompt);
		const sourceContext = sourceUrls.length ? `\n\n<pi-user-provided-sources>\n${sourceUrls.map((url) => `- ${url}`).join("\n")}\n</pi-user-provided-sources>` : "";
		try {
			await this.sendCommand("prompt", { message: `${prompt}${sourceContext}`, ...(images?.length ? { images } : {}) });
		} catch (error) {
			this.setError(toSafeError(error));
		}
	}

	async updateRuntimeSettings(modelId: string, thinkingLevel: ThinkingLevel): Promise<void> {
		if (this.snapshot.isStreaming) {
			this.setError("Wait for the current response before changing model or effort.");
			return;
		}
		const settings = this.getSettings();
		settings.modelId = modelId;
		settings.thinkingLevel = thinkingLevel;
		await this.saveSettings();
		const child = this.child;
		this.child = null;
		try { child?.kill("SIGTERM"); } catch { /* process is already gone */ }
		this.snapshot = this.createSnapshot();
		this.notify();
		await this.initialize();
	}

	abort(): void {
		void this.sendCommand("abort").catch((error) => this.setError(toSafeError(error)));
	}

	async newSession(): Promise<void> {
		try {
			this.resumeSessionPath = null;
			await this.initialize();
			await this.sendCommand("new_session");
			this.snapshot = this.createSnapshot();
			this.notify();
		} catch (error) {
			this.setError(toSafeError(error));
		}
	}

	answerQuiz(answer: string): void {
		const quiz = this.snapshot.pendingQuiz;
		if (quiz) {
			this.snapshot = { ...this.snapshot, mastery: applyQuizAttempt(this.snapshot.mastery, quiz, answer), pendingQuiz: undefined };
			this.notify();
		}
		void this.sendPrompt(answer);
	}

	dispose(): void {
		const child = this.child;
		this.child = null;
		if (child) {
			try { child.kill("SIGTERM"); } catch { /* process is already gone */ }
		}
		this.rejectPending(new Error("Pi runtime stopped."));
		this.listeners.clear();
	}

	private async startProcess(): Promise<void> {
		const settings = this.getSettings();
		const vaultRoot = getVaultBasePath(this.app);
		const pluginDir = join(vaultRoot, this.app.vault.configDir, "plugins", "pi-teacher");
		const runtimePath = join(pluginDir, "pi-runtime.cjs");
		if (!existsSync(runtimePath)) {
			throw new Error("Pi runtime is missing. Rebuild and reinstall the Pi Teacher plugin.");
		}
		const args = [
			runtimePath,
			"--provider", settings.provider,
			"--model", settings.modelId,
			"--thinking", getPreferredThinkingLevel(settings),
			"--tools", "read,grep,find,ls",
			"--append-system-prompt", "You are a patient, adaptive teacher. Teach via Probe → Plan → Teach → Practice → Review. First diagnose prerequisite understanding with one graded multiple-choice question at a time; treat ‘I don’t know’ as useful data. Then plan a dependency path and teach one reasoning step at a time. Quiz periodically, use answers to recalibrate, and never rush ahead. Use only source material the learner explicitly provides (attached vault documents, pasted material, or URLs they explicitly give); never discover or search for external sources yourself. Treat attached vault material as primary, and label claims based on it as `Fuente proporcionada por Fran`; identify an inference plainly when evidence is absent. Never narrate tool calls, tool results, private reasoning, or implementation details. For every completed probe, plan update, teaching-node update, practice result, review, or completion, append one fenced pi-lesson block containing strict JSON: {\"phase\":\"probe|plan|teach|practice|review|complete\",\"goal\":string,\"nodes\":[{\"id\":string,\"title\":string,\"status\":\"locked|ready|current|mastered\",\"dependsOn\"?:string[]}],\"sources\":[{\"label\":string,\"path\"?:string,\"kind\":\"vault|external\"}]}. Keep it truthful and compact. When you want an interactive quiz, append one fenced pi-quiz block containing strict JSON: {\"question\":string,\"options\":string[],\"allowFreeform\":boolean,\"conceptId\"?:string,\"correctOption\"?:string}. For a concept where a visual materially helps, append a pi-visual fenced JSON block {\"title\":string,\"svg\":string} with a self-contained inert SVG (no scripts, external URLs, event handlers, or foreignObject); at most one proposal per response. For multiple-choice quizzes, include conceptId and exact correctOption; those fields are protocol metadata and are hidden from the learner UI. Do not include an answer for freeform quizzes.",
			"--session-dir", join(vaultRoot, ".pi", "agent", "sessions"),
			"--append-system-prompt", teacherSystemPrompt(),
			...(this.resumeSessionPath ? ["--session", this.resumeSessionPath] : []),
			"--no-extensions",
		];
		const nodeExecutable = resolveNodeExecutable(process.env.PI_OBSIDIAN_NODE_PATH, process.platform, existsSync);
		console.debug("[Pi Teacher] Starting Node RPC runtime", { nodeExecutable, runtimePath });
		const child = spawn(nodeExecutable, args, {
			cwd: vaultRoot,
			env: {
				...process.env,
				PI_CODING_AGENT_DIR: join(vaultRoot, ".pi", "agent"),
				PI_PACKAGE_DIR: join(pluginDir, "runtime-assets"),
			},
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
		});
		this.child = child;
		child.stdout.on("data", (chunk: Buffer) => this.handleStdout(chunk));
		child.stderr.on("data", (chunk: Buffer) => {
			this.stderr = limitText(`${this.stderr}${chunk.toString("utf8")}`, 4000);
		});
		child.on("error", (error) => this.handleProcessFailure(new Error(`Could not start Pi runtime: ${error.message}`)));
		child.on("exit", (code, signal) => {
			if (this.child !== child) return;
			this.child = null;
			const suffix = this.stderr ? ` Runtime stderr: ${toSafeError(this.stderr)}` : "";
			this.handleProcessFailure(new Error(`Pi runtime exited (${code ?? signal ?? "unknown"}).${suffix}`));
		});
		let state: RpcResponse;
		try {
			state = await withRpcTimeout(this.sendCommand("get_state"), 12000, "get_state");
		} catch (error) {
			try { child.kill("SIGTERM"); } catch { /* process is already gone */ }
			throw error;
		}
		const data = state.data;
		this.snapshot = {
			...this.createSnapshot(),
			messages: this.snapshot.messages,
			chatHistory: this.snapshot.chatHistory,
			activeChatPath: this.resumeSessionPath ?? data?.sessionFile,
			sessionId: data?.sessionId,
			sessionPath: data?.sessionFile,
			sessionName: data?.sessionName,
		};
		this.notify();
	}

	private handleStdout(chunk: Buffer): void {
		this.stdoutBuffer += this.stdoutDecoder.write(chunk);
		while (true) {
			const newline = this.stdoutBuffer.indexOf("\n");
			if (newline < 0) return;
			const line = this.stdoutBuffer.slice(0, newline).replace(/\r$/, "");
			this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
			if (!line) continue;
			try {
				this.handleRpcMessage(JSON.parse(line) as RpcResponse | RpcEvent);
			} catch {
				this.handleProcessFailure(new Error("Pi runtime emitted an invalid RPC message."));
			}
		}
	}

	private handleRpcMessage(message: RpcResponse | RpcEvent): void {
		console.debug("[Pi Teacher] RPC message", {
			type: message.type,
			...(typeof (message as RpcResponse).id === "number" ? { id: (message as RpcResponse).id } : {}),
			...((message as RpcResponse).command ? { command: (message as RpcResponse).command } : {}),
			...(typeof (message as RpcResponse).success === "boolean" ? { success: (message as RpcResponse).success } : {}),
		});
		if (message.type === "response") {
			const response = message as RpcResponse;
			const id = response.id;
			if (typeof id !== "number") return;
			const pending = this.pending.get(id);
			if (!pending) return;
			this.pending.delete(id);
			if (response.success) pending.resolve(response);
			else pending.reject(new Error(response.error || `${pending.command} failed.`));
			return;
		}
		const event = message as RpcEvent;
		if (event.type === "agent_end" && typeof event.errorMessage === "string") {
			console.error("[Pi Teacher] Agent turn failed", event.errorMessage);
		}
		this.snapshot = applyRpcEvent(this.snapshot, event as never);
		this.notify();
	}

	private sendCommand(type: string, extra: Record<string, unknown> = {}): Promise<RpcResponse> {
		const child = this.child;
		if (!child?.stdin.writable) return Promise.reject(new Error("Pi runtime is not running."));
		const id = this.nextRequestId++;
		return new Promise<RpcResponse>((resolve, reject) => {
			this.pending.set(id, { command: type, resolve, reject });
			child.stdin.write(`${JSON.stringify({ type, id, ...extra })}\n`, "utf8", (error) => {
				if (!error) return;
				this.pending.delete(id);
				reject(error);
			});
		});
	}

	private handleProcessFailure(error: Error): void {
		this.rejectPending(error);
		this.setError(toSafeError(error));
	}

	private rejectPending(error: Error): void {
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}

	private createSnapshot(): ChatSnapshot {
		const settings = this.getSettings();
		return createRpcSnapshot({
			provider: settings.provider,
			modelId: settings.modelId,
			thinkingLevel: getPreferredThinkingLevel(settings) as ThinkingLevel,
		});
	}

	private setError(message: string): void {
		this.snapshot = { ...this.snapshot, isStreaming: false, errorMessage: message };
		this.notify();
	}

	private notify(): void {
		for (const listener of this.listeners) listener(this.snapshot);
	}
}

function flashcardDeckPath(sources: string[]): string {
	return sources.some((source) => /métodos numéricos/i.test(source)) ? "05 - Resources/Flashcards/Métodos Numéricos flashcards.md" : "05 - Resources/Flashcards/Pi Teacher flashcards.md";
}

function getVaultBasePath(app: App): string {
	const adapter = app.vault.adapter as { getBasePath?: () => string };
	const basePath = adapter.getBasePath?.();
	if (!basePath) throw new Error("Pi Teacher requires a filesystem-backed desktop vault.");
	return basePath;
}

async function findKnowledgeNote(app: App, folder: string, chatId: string): Promise<TFile | undefined> {
	const marker = `pi_teacher_chat: ${chatId}`;
	for (const file of app.vault.getMarkdownFiles()) {
		if (!file.path.startsWith(`${folder}/`)) continue;
		if ((await app.vault.read(file)).includes(marker)) return file;
	}
	return undefined;
}

function ensureSafeFileStem(title: string): string {
	// eslint-disable-next-line no-control-regex -- \x00-\x1f strips characters invalid in file names
	const stem = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, " ").trim().slice(0, 72);
	return stem || "Sesion de Pi Teacher";
}

async function ensureVaultFolder(app: App, folder: string): Promise<void> {
	const parts = normalizePath(folder).split("/");
	let path = "";
	for (const part of parts) {
		path = path ? `${path}/${part}` : part;
		if (app.vault.getAbstractFileByPath(path)) continue;
		await app.vault.createFolder(path);
	}
}

function uniqueKnowledgePath(app: App, folder: string, title: string): string {
	const base = ensureSafeFileStem(title);
	const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
	let path = `${folder}/${base} — ${stamp}.md`;
	let suffix = 2;
	while (app.vault.getAbstractFileByPath(path)) {
		path = `${folder}/${base} — ${stamp} (${suffix++}).md`;
	}
	return path;
}

function limitText(value: string, max: number): string {
	return value.length <= max ? value : value.slice(-max);
}

function toSafeError(error: unknown): string {
	const text = error instanceof Error ? error.message : String(error);
	return limitText(text.replace(/(?:access|refresh|token|authorization)\s*[:=]\s*[^\s,]+/gi, "$1=[REDACTED]"), 600);
}
