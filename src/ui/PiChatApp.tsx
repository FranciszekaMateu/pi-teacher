import React, { useEffect, useMemo, useRef, useState } from "react";
import { Component, finishRenderMath, loadMathJax, MarkdownRenderer, renderMath, type App } from "obsidian";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import type { ChatSnapshot, PiSessionService } from "../pi/piSessionService";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ChatInputController } from "./ChatInputController";
import { isSendShortcut } from "./keyboard";
import { ChatContainerRoot, ScrollButton } from "./chatContainer";
import { validateImageAttachment } from "../pi/imageAttachment";
import { splitQuizSegments, matchQuizAnswer, shuffleOptions } from "../pi/quizProtocol";
import { stripIncompleteProtocolFence } from "../pi/streamingText";
import { stripLessonMarkup, type LessonState } from "../pi/lessonProtocol";
import { stripVisualMarkup, type VisualProposal } from "../pi/visualProtocol";
import { stripFlashcardsMarkup, type FlashcardProposal } from "../pi/flashcards";
import { isVisibleChatMessage, nextUserMessageText } from "./chatVisibility";
import { firstPastedImage } from "./clipboardImage";
import { buildAttachedDocumentPrompt, parseAttachedDocumentPrompt, type AttachedDocument } from "./attachedDocument";
import { loadActiveDocument, loadLatestMarkdownNote } from "./activeDocument";
import { isLastNoteQuizRequest } from "./lastNoteQuiz";
import { renderChatMarkdown } from "./markdownRendering";
import { thinkingStatus } from "./thinkingStatus";
import { normalizeMathMarkdown, tokenizeQuizText } from "./mathMarkdown";
import { filterAndGroupChats } from "./historyPresentation";
import { chatStrings, type ChatStrings, type UiLanguage } from "./strings";
import { BookmarkIcon, CloseIcon, FileTextIcon, GraphIcon, ImageIcon, MessageIcon, PlusIcon, RefreshIcon, SearchIcon, SendIcon, StopIcon, TargetIcon, TrashIcon } from "./icons";
import { RuntimeControls } from "./runtimeControls";
import { LessonGraph } from "./lessonGraph";

interface PiChatAppProps {
	app: App;
	service: PiSessionService;
	inputController?: ChatInputController;
	uiLanguage: UiLanguage;
}

export function PiChatApp({ app, service, inputController, uiLanguage }: PiChatAppProps): React.JSX.Element {
	const [snapshot, setSnapshot] = useState<ChatSnapshot>(() => service.getSnapshot());
	const [input, setInput] = useState("");
	const [freeformQuiz, setFreeformQuiz] = useState("");
	const [image, setImage] = useState<{ name: string; mimeType: string; data: string; preview: string } | null>(null);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);
	const [document, setDocument] = useState<AttachedDocument | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [historyQuery, setHistoryQuery] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const sendPromptRef = useRef<() => void>(() => undefined);
	const t = useMemo(() => chatStrings(uiLanguage), [uiLanguage]);

	useEffect(() => {
		const unsubscribe = service.subscribe(setSnapshot);
		void service.initialize();
		void service.listChatHistory();
		return unsubscribe;
	}, [service]);

	// A new quiz replaces the answered one while the input keeps its text —
	// clear it so stale freeform drafts are never submitted to the next quiz.
	const pendingQuestion = snapshot.pendingQuiz?.question;
	useEffect(() => {
		setFreeformQuiz("");
	}, [pendingQuestion]);

	const visibleMessages = useMemo(() => {
		const messages = snapshot.streamingMessage ? [...snapshot.messages, snapshot.streamingMessage] : snapshot.messages;
		return messages.filter(isVisibleChatMessage);
	}, [snapshot.messages, snapshot.streamingMessage]);
	const pendingVisual = snapshot.pendingVisual;
	const pendingFlashcards = snapshot.pendingFlashcards;

	const updateRuntime = (provider: string, modelId: string, effort: ModelThinkingLevel): void => {
		void service.updateRuntimeSettings(provider, modelId, effort).catch((error) => console.error("[Pi Teacher] Runtime settings update failed", error));
	};

	const sendPrompt = async (): Promise<void> => {
		const prompt = input.trim();
		if (!prompt && !image && !document) {
			return;
		}
		const attachment = image;
		let activeDocument = document;
		// This shortcut is an explicit learner request for a vault source. Attach
		// it here, instead of leaving the agent to ask for it or inspect the vault.
		if (!activeDocument && isLastNoteQuizRequest(prompt)) {
			try {
				activeDocument = await loadLatestMarkdownNote(app);
				setAttachmentError(null);
			} catch (error) {
				setAttachmentError(error instanceof Error ? error.message : "Could not load the latest note.");
				return;
			}
		}
		setInput("");
		setImage(null);
		setDocument(null);
		const message = activeDocument
			? buildAttachedDocumentPrompt(activeDocument, prompt || "Please analyze the attached document.")
			: prompt || "Please analyze the attached image.";
		await service.sendPrompt(message, attachment ? [{ type: "image", data: attachment.data, mimeType: attachment.mimeType }] : undefined);
	};

	sendPromptRef.current = () => {
		void sendPrompt();
	};

	useEffect(() => {
		if (!inputController) {
			return undefined;
		}
		inputController.setSubmitHandler(() => sendPromptRef.current());
		return () => {
			inputController.setSubmitHandler(null);
		};
	}, [inputController]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
		// Obsidian's Scope owns Ctrl/Cmd+Enter and routes it through the
		// ChatInputController. The React handler owns plain Enter only; having
		// both paths handle the same key produced two prompts for one reply.
		if (!isSendShortcut(event) || event.ctrlKey || event.metaKey) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		void sendPrompt();
	};

	// Auto-grow the textarea up to a soft cap so the composer feels like a
	// chat composer (single-line that grows) instead of a tall box.
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) {
			return undefined;
		}
		textarea.setCssProps({ height: "auto" });
		const maxHeight = 200;
		const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
		textarea.setCssProps({ height: `${nextHeight}px` });
		return undefined;
	}, [input]);

	const handleImageSelection = async (file: File | undefined): Promise<void> => {
		if (!file) return;
		try {
			const { mimeType } = validateImageAttachment(file);
			const preview = await readFileAsDataUrl(file);
			setImage({ name: file.name, mimeType, data: preview.slice(preview.indexOf(",") + 1), preview });
			setAttachmentError(null);
		} catch (error) {
			setImage(null);
			setAttachmentError(error instanceof Error ? error.message : "Could not attach that image.");
		}
	};

	const attachActiveDocument = async (): Promise<void> => {
		try {
			setDocument(await loadActiveDocument(app));
			setAttachmentError(null);
		} catch (error) {
			setAttachmentError(error instanceof Error ? error.message : "Could not attach the active document.");
		}
	};

	const submitQuizAnswer = (answer: string): void => {
		setFreeformQuiz("");
		service.answerQuiz(answer);
	};

	const requestQuizExplanation = (): void => {
		if (snapshot.isStreaming || !snapshot.pendingQuiz) return;
		void service.sendPrompt("No me siento preparado para responder el quiz actual. Explícame desde cero los conceptos necesarios, con un ejemplo sencillo, sin calificarme todavía. Después vuelve a emitir exactamente el mismo quiz como único quiz activo para que pueda intentarlo.");
	};

	const applySuggestion = (prompt: string): void => {
		setInput(prompt);
		textareaRef.current?.focus();
	};

	const hasMessages = visibleMessages.length > 0 || snapshot.pendingToolCalls.length > 0;
	const historyGroups = useMemo(() => filterAndGroupChats(snapshot.chatHistory, historyQuery, new Date()), [snapshot.chatHistory, historyQuery]);

	// Concepts the Practice button targets: quiz-tracked "learning" concepts
	// first, then any lesson node that is not mastered yet.
	const practiceTargets = useMemo(() => {
		const lesson = snapshot.lesson;
		if (!lesson) return [] as string[];
		const titleOf = new Map(lesson.nodes.map((node) => [node.id, node.title]));
		const learning = Object.entries(snapshot.mastery)
			.filter(([, evidence]) => evidence.status === "learning")
			.map(([id]) => titleOf.get(id) ?? id);
		if (learning.length) return learning.slice(0, 8);
		return lesson.nodes.filter((node) => node.status !== "mastered").map((node) => node.title).slice(0, 8);
	}, [snapshot.lesson, snapshot.mastery]);

	const practiceWeakConcepts = (): void => {
		if (!practiceTargets.length || snapshot.isStreaming) return;
		// Wrapped in a tag so the transcript shows a friendly chip instead of
		// the raw internal instruction (same pattern as the learner profile).
		void service.sendPrompt(
			`<pi-practice>\nquiz me again, one graded question at a time, on these concepts I have not mastered yet: ${practiceTargets.join("; ")}. Focus on the parts I previously got wrong.\n</pi-practice>`,
		);
	};

	return (
		<div className="pi-chat">
			<header className="pi-chat__header">
				<div className="pi-chat__header-titles">
					<h2>{t.title}</h2>
				</div>
				<button
					type="button"
					className="pi-chat__save-note"
					onClick={() => void service.saveKnowledgeNote()}
					disabled={snapshot.isStreaming || !snapshot.messages.some((message) => message.role === "assistant")}
					title={t.saveNote}
				>
					<BookmarkIcon />
					<span className="pi-chat__btn-label">{t.saveNote}</span>
				</button>
				<button
					type="button"
					className="pi-chat__history-toggle"
					onClick={() => {
						const opening = !historyOpen;
						setHistoryOpen(opening);
						if (opening) void service.listChatHistory();
					}}
					aria-expanded={historyOpen}
					title={t.chats}
				>
					<MessageIcon />
					<span className="pi-chat__btn-label">{t.chats}</span>
				</button>
				<button
					type="button"
					className="pi-chat__new-lesson"
					onClick={() => void service.newSession()}
					disabled={snapshot.isStreaming}
					title={t.newLesson}
				>
					<PlusIcon />
					<span className="pi-chat__btn-label">{t.newLesson}</span>
				</button>
			</header>

			{historyOpen ? <div className="pi-chat__history-scrim" role="presentation" onClick={() => setHistoryOpen(false)} /> : null}
			<nav className={historyOpen ? "pi-chat__history is-open" : "pi-chat__history"} aria-label={t.chats}>
				<div className="pi-chat__history-heading">
					<div>
						<span>{t.chats}</span>
						<small>{t.savedCount(snapshot.chatHistory.length)}</small>
					</div>
					<div className="pi-chat__history-heading-actions">
						<button type="button" onClick={() => void service.listChatHistory()} title={t.refreshHistory} aria-label={t.refreshHistory}>
							<RefreshIcon />
						</button>
						<button type="button" onClick={() => setHistoryOpen(false)} title={t.closeHistory} aria-label={t.closeHistory}>
							<CloseIcon />
						</button>
					</div>
				</div>
				<div className="pi-chat__history-search">
					<SearchIcon />
					<input value={historyQuery} onChange={(event) => setHistoryQuery(event.currentTarget.value)} placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
				</div>
				<div className="pi-chat__history-list">
					{historyGroups.length === 0 ? (
						<span className="pi-chat__history-empty">{historyQuery ? t.noMatches : t.noChatsYet}</span>
					) : (
						historyGroups.map((group) => (
							<section className="pi-chat__history-group" key={group.label}>
								<h3>{group.label}</h3>
								{group.chats.map((chat) => (
									<div key={chat.id} className={chat.path === snapshot.activeChatPath ? "pi-chat__history-item is-active" : "pi-chat__history-item"}>
										<button type="button" className="pi-chat__history-open" disabled={snapshot.isStreaming} onClick={() => { setHistoryOpen(false); void service.openChat(chat); }} title={chat.title}>
											<span>{chat.title}</span>
											<time>{new Date(chat.updatedAt).toLocaleDateString()}</time>
										</button>
										<button
											type="button"
											className="pi-chat__history-delete"
											disabled={snapshot.isStreaming}
											onClick={() => void service.deleteChat(chat)}
											title={t.deleteChat(chat.title)}
											aria-label={t.deleteChat(chat.title)}
										>
											<TrashIcon />
										</button>
									</div>
								))}
							</section>
						))
					)}
				</div>
			</nav>

			{snapshot.errorMessage ? (
				<div className="pi-chat__error">
					<strong>{t.errorPrefix}:</strong> {snapshot.errorMessage}
				</div>
			) : null}
			{snapshot.lesson ? <LessonProgress lesson={snapshot.lesson} t={t} onPractice={practiceWeakConcepts} canPractice={practiceTargets.length > 0 && !snapshot.isStreaming} /> : null}

			<ChatContainerRoot className="pi-chat__messages" label={t.title}>
				{!hasMessages ? (
					<EmptyState t={t} onSuggestion={applySuggestion} />
				) : (
					<>
						{visibleMessages.map((message, index) => (
							<MessageRow
								key={index}
								app={app}
								message={message}
								t={t}
								nextUserText={nextUserMessageText(visibleMessages, index)}
								pendingQuestion={snapshot.pendingQuiz?.question}
								showCaret={snapshot.isStreaming && message === snapshot.streamingMessage && message.role === "assistant"}
							/>
						))}
						{/* Show the visual explanation before testing recall with the quiz. */}
						{pendingVisual ? <VisualCard visual={pendingVisual} t={t} onSave={() => void service.saveVisual(pendingVisual)} /> : null}
						{snapshot.pendingQuiz ? (
							<QuizCard {...snapshot.pendingQuiz} answer={snapshot.quizAnswer} app={app} freeformValue={freeformQuiz} onFreeformChange={setFreeformQuiz} onAnswer={submitQuizAnswer} onRequestExplanation={requestQuizExplanation} t={t} />
						) : null}
						{pendingFlashcards?.length ? <FlashcardCard cards={pendingFlashcards} t={t} onSave={() => void service.saveFlashcards(pendingFlashcards)} /> : null}
						{snapshot.isStreaming && (!snapshot.streamingMessage || snapshot.pendingToolCalls.length > 0) ? (
							<ThinkingIndicator label={thinkingStatus(snapshot.isStreaming, snapshot.pendingToolCalls.length, t)} />
						) : null}
					</>
				)}
				<ScrollButton label={t.scrollToLatest} />
			</ChatContainerRoot>

			<footer className="pi-chat__composer">
				{image ? <ComposerAttachment kind="image" name={image.name} detail={image.mimeType.replace("image/", "").toUpperCase()} preview={image.preview} onRemove={() => setImage(null)} t={t} /> : null}
				{document ? <ComposerAttachment kind="document" name={document.path.split("/").at(-1) ?? document.path} detail={document.kind} onRemove={() => setDocument(null)} t={t} /> : null}
				{attachmentError ? <div className="pi-chat__attachment-error">{attachmentError}</div> : null}
				<div className="pi-chat__composer-row">
					<label className="pi-chat__attach" title={t.attachImageTitle}>
						<ImageIcon />
						<span className="pi-chat__attach-label">{t.attachImageLabel}</span>
						<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void handleImageSelection(event.currentTarget.files?.[0])} />
					</label>
					<button type="button" className="pi-chat__attach" title={t.attachDocumentTitle} onClick={() => void attachActiveDocument()} aria-label={t.attachDocumentTitle}>
						<FileTextIcon />
						<span className="pi-chat__attach-label">{t.attachDocumentLabel}</span>
					</button>
					<textarea
						ref={textareaRef}
						value={input}
						onFocus={() => setHistoryOpen(false)}
						onChange={(event) => setInput(event.currentTarget.value)}
						onKeyDown={handleKeyDown}
						onPaste={(event) => {
							const pastedImage = firstPastedImage(event.clipboardData.files);
							if (!pastedImage) return;
							event.preventDefault();
							void handleImageSelection(pastedImage);
						}}
						placeholder={t.placeholder}
						rows={1}
						className="pi-chat__composer-input"
					/>
					<div className="pi-chat__composer-actions">
						{snapshot.isStreaming ? (
							<button type="button" className="pi-chat__abort" onClick={() => service.abort()} title={t.abortTitle} aria-label={t.abortTitle}>
								<StopIcon />
							</button>
						) : (
							<button
								type="button"
								className="pi-chat__send"
								onClick={() => void sendPrompt()}
								disabled={!input.trim() && !image && !document}
								title={t.sendTitle}
								aria-label={t.sendTitle}
							>
								<SendIcon />
							</button>
						)}
					</div>
				</div>
				<div className="pi-chat__composer-meta">
					<span className="pi-chat__composer-hint">{t.composerHint}</span>
					<RuntimeControls
						strings={t}
						provider={snapshot.provider}
						modelId={snapshot.modelId}
						thinkingLevel={snapshot.thinkingLevel}
						models={snapshot.availableModels}
						disabled={snapshot.isStreaming}
						onChange={updateRuntime}
					/>
				</div>
			</footer>
		</div>
	);
}

function ComposerAttachment({ kind, name, detail, preview, onRemove, t }: { kind: "image" | "document"; name: string; detail: string; preview?: string; onRemove: () => void; t: ChatStrings }): React.JSX.Element {
	return (
		<div className="pi-chat__attachment">
			<div className={kind === "image" ? "pi-chat__attachment-thumb is-image" : "pi-chat__attachment-thumb"}>{preview ? <img src={preview} alt="" /> : "⌑"}</div>
			<div className="pi-chat__attachment-meta">
				<strong>{name}</strong>
				<small>{detail}</small>
			</div>
			<button type="button" onClick={onRemove} aria-label={t.removeAttachment(name)} title={t.removeAttachment(name)}>
				<CloseIcon />
			</button>
		</div>
	);
}

function EmptyState({ t, onSuggestion }: { t: ChatStrings; onSuggestion: (prompt: string) => void }): React.JSX.Element {
	return (
		<div className="pi-chat__empty">
			<div className="pi-chat__empty-greeting">{t.emptyGreeting}</div>
			<p>{t.emptyBody}</p>
			<div className="pi-chat__empty-suggestions">
				{t.suggestions.map((suggestion) => (
					<button key={suggestion} type="button" className="pi-chat__suggestion" onClick={() => onSuggestion(suggestion)}>
						{suggestion}
					</button>
				))}
			</div>
		</div>
	);
}

function ThinkingIndicator({ label }: { label: string | null }): React.JSX.Element | null {
	if (!label) return null;
	return (
		<div className="pi-chat__thinking-indicator" aria-live="polite">
			<span className="pi-chat__thinking-mark" aria-hidden="true">
				<i />
				<i />
				<i />
			</span>
			<span>{label}</span>
		</div>
	);
}

function LessonProgress({ lesson, t, onPractice, canPractice }: { lesson: LessonState; t: ChatStrings; onPractice: () => void; canPractice: boolean }): React.JSX.Element {
	const [mapOpen, setMapOpen] = useState(false);
	const mastered = lesson.nodes.filter((node) => node.status === "mastered").length;
	const current = lesson.nodes.find((node) => node.status === "current");
	return (
		<>
			<section className="pi-chat__lesson-progress">
				<div>
					<span className="pi-chat__lesson-phase">{lesson.phase}</span>
					<strong>{lesson.goal}</strong>
					<small>{current ? t.lessonNow(current.title) : t.lessonProgress(mastered, lesson.nodes.length)}</small>
				</div>
				<div className="pi-chat__lesson-actions">
					<div className="pi-chat__lesson-track" aria-label={t.lessonProgress(mastered, lesson.nodes.length)}>
						{lesson.nodes.map((node) => (
							<i key={node.id} className={`is-${node.status}`} title={node.title} />
						))}
					</div>
					<button
						type="button"
						className="pi-chat__lesson-map-toggle"
						onClick={onPractice}
						disabled={!canPractice}
						title={t.practice}
						aria-label={t.practice}
					>
						<TargetIcon />
						<span aria-hidden="true">{t.practice}</span>
					</button>
					<button
						type="button"
						className={mapOpen ? "pi-chat__lesson-map-toggle is-open" : "pi-chat__lesson-map-toggle"}
						onClick={() => setMapOpen((value) => !value)}
						aria-expanded={mapOpen}
						title={t.lessonMap}
					>
						<GraphIcon />
						<span aria-hidden="true">{t.lessonMap}</span>
					</button>
				</div>
			</section>
			{mapOpen ? (
				<div className="pi-chat__lesson-map">
					<LessonGraph lesson={lesson} />
				</div>
			) : null}
		</>
	);
}

function VisualCard({ visual, t, onSave }: { visual: VisualProposal; t: ChatStrings; onSave: () => void }): React.JSX.Element {
	const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(visual.svg)}`;
	return (
		<article className="pi-chat__visual">
			<header>
				<span>{t.visualKicker}</span>
				<strong>{visual.title}</strong>
			</header>
			<img src={preview} alt={visual.title} />
			<button type="button" onClick={onSave}>
				{t.saveVisual}
			</button>
		</article>
	);
}

function FlashcardCard({ cards, t, onSave }: { cards: FlashcardProposal[]; t: ChatStrings; onSave: () => void }): React.JSX.Element {
	return (
		<article className="pi-chat__flashcards">
			<header>
				<span>{t.flashcardsKicker}</span>
				<strong>{t.flashcardsCount(cards.length)}</strong>
			</header>
			<ul>
				{cards.map((card) => (
					<li key={`${card.conceptId}-${card.question}`}>{card.question}</li>
				))}
			</ul>
			<button type="button" onClick={onSave}>
				{t.saveFlashcards}
			</button>
		</article>
	);
}

function QuizCard({
	question,
	options,
	allowFreeform,
	correctOption,
	explanation,
	hint,
	answer,
	frozen,
	app,
	freeformValue,
	onFreeformChange,
	onAnswer,
	onRequestExplanation,
	t,
}: {
	question: string;
	options: string[];
	allowFreeform: boolean;
	correctOption?: string;
	explanation?: string;
	hint?: string;
	answer?: { selected: string; correct: boolean | null };
	/** Historical quiz rendered inside the transcript: no inputs, stays forever. */
	frozen?: boolean;
	app: App;
	freeformValue: string;
	onFreeformChange: (value: string) => void;
	onAnswer: (answer: string) => void;
	onRequestExplanation: () => void;
	t: ChatStrings;
}): React.JSX.Element {
	const [hintShown, setHintShown] = useState(false);
	// Shuffle once per quiz so option position carries no signal; grading
	// compares option text, so order does not affect correctness. The teacher
	// re-emits the quiz block on every response, and React keeps component
	// state across prop changes — reset the shuffle (and the hint) whenever a
	// different quiz lands here, or clicks would grade against stale options.
	const quizKey = `${question}\u0000${options.join("\u0000")}`;
	const [shuffledFor, setShuffledFor] = useState(quizKey);
	const [displayOptions, setDisplayOptions] = useState(() => shuffleOptions(options));
	if (shuffledFor !== quizKey) {
		setShuffledFor(quizKey);
		setDisplayOptions(shuffleOptions(options));
		setHintShown(false);
	}
	const answered = Boolean(answer);
	const locked = answered || Boolean(frozen);

	// Graded quizzes submit immediately — the right/wrong feedback lives in
	// the snapshot (quizAnswer), so the card stays visible with the correction
	// while the teacher prepares the next response.
	const chooseOption = (option: string): void => {
		// Only options of the current quiz are valid answers; anything else
		// would be a stale click left over from a replaced quiz.
		if (answered || !options.includes(option)) return;
		onAnswer(option);
	};

	const optionClass = (option: string): string => {
		const selected = answer?.selected;
		if (!answer || selected === undefined) return "pi-chat__quiz-option";
		const isCorrectOption = typeof correctOption === "string" && option.trim() === correctOption.trim();
		if (isCorrectOption) return "pi-chat__quiz-option is-correct";
		if (option === selected && answer.correct === false) return "pi-chat__quiz-option is-incorrect";
		if (option === selected) return "pi-chat__quiz-option is-selected";
		return "pi-chat__quiz-option";
	};

	const feedbackText = (): string | null => {
		if (!answer) return null;
		if (answer.correct === true) return t.quizCorrect;
		if (answer.correct === false) return t.quizIncorrect(correctOption ?? answer.selected);
		return t.quizAnswered(answer.selected);
	};
	const feedback = feedbackText();

	return (
		<article className="pi-chat__quiz">
			<header className="pi-chat__quiz-header">
				<span className="pi-chat__quiz-tag">{t.quizTag}</span>
				<div className="pi-chat__quiz-question">
					<QuizText app={app} text={question} />
				</div>
			</header>
			{!locked ? (
				<button type="button" className="pi-chat__quiz-explain" onClick={onRequestExplanation}>
					{t.quizExplain}
				</button>
			) : null}
			{displayOptions.length > 0 ? (
				<div className="pi-chat__quiz-options">
					{displayOptions.map((option, index) => (
						<button key={`${index}-${option}`} type="button" className={optionClass(option)} onClick={() => chooseOption(option)} disabled={locked}>
							<span className="pi-chat__quiz-option-letter">{String.fromCharCode(65 + index)}</span>
							<QuizText app={app} text={option} />
						</button>
					))}
				</div>
			) : null}
			{feedback ? (
				<div
					className={answer?.correct === true ? "pi-chat__quiz-feedback is-correct" : answer?.correct === false ? "pi-chat__quiz-feedback is-incorrect" : "pi-chat__quiz-feedback"}
					aria-live="polite"
				>
					<QuizText app={app} text={feedback} />
				</div>
			) : null}
			{answered && explanation ? (
				<div className="pi-chat__quiz-explanation">
					<QuizText app={app} text={explanation} />
				</div>
			) : null}
			{allowFreeform && !locked ? (
				<div className="pi-chat__quiz-freeform">
					<input
						type="text"
						value={freeformValue}
						onChange={(event) => onFreeformChange(event.currentTarget.value)}
						placeholder={t.quizFreeformPlaceholder}
						onKeyDown={(event) => {
							if (event.key === "Enter" && freeformValue.trim()) {
								onAnswer(freeformValue.trim());
							}
						}}
					/>
					{hint ? (
						<button type="button" className="pi-chat__quiz-hint-toggle" onClick={() => setHintShown((value) => !value)} aria-expanded={hintShown}>
							{t.quizHint}
						</button>
					) : null}
					<button type="button" onClick={() => onAnswer(freeformValue.trim())} disabled={!freeformValue.trim()}>
						{t.quizAnswer}
					</button>
				</div>
			) : null}
			{allowFreeform && !locked && hint && hintShown ? (
				<div className="pi-chat__quiz-hint">
					<QuizText app={app} text={hint} />
				</div>
			) : null}
		</article>
	);
}

/** Renders quiz prose inline and sends every parsed formula directly to MathJax. */
function QuizText({ text }: { app: App; text: string }): React.JSX.Element {
	const ref = useRef<HTMLSpanElement | null>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || !text.trim()) return;
		el.empty();
		let cancelled = false;
		void (async () => {
			try {
				await loadMathJax();
			} catch {
				if (!cancelled) el.replaceChildren(document.createTextNode(text));
				return;
			}
			if (cancelled) return;
			const rendered = document.createDocumentFragment();
			for (const segment of tokenizeQuizText(text)) {
				if (segment.type === "text") rendered.append(segment.value);
				else {
					try {
						rendered.appendChild(renderMath(segment.tex, segment.display));
					} catch {
						// Isolate malformed model output instead of breaking the quiz.
						rendered.append(segment.tex);
					}
				}
			}
			if (cancelled) return;
			el.replaceChildren(rendered);
			// Rendering already succeeded; a stylesheet flush failure must not
			// append a second raw copy of the question.
			try {
				await finishRenderMath();
			} catch {
				// Keep the successfully rendered nodes in place.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [text]);

	return <span className="pi-quiz-text" ref={ref} />;
}

function MessageRow({ app, message, t, showCaret, nextUserText, pendingQuestion }: { app: App; message: AgentMessage; t: ChatStrings; showCaret?: boolean; nextUserText?: string; pendingQuestion?: string }): React.JSX.Element {
	const { author, label } = describeRole(message.role, t);
	return (
		<article className={`pi-chat__message pi-chat__message--${message.role}`}>
			<div className={`pi-chat__avatar pi-chat__avatar--${message.role}`} aria-hidden="true">
				{author}
			</div>
			<div className="pi-chat__message-bubble">
				<div className="pi-chat__message-meta">
					<span className="pi-chat__message-author">{label}</span>
				</div>
				<div className="pi-chat__message-content">
					{renderMessageContent(app, message, t, nextUserText, pendingQuestion)}
					{showCaret ? <span className="pi-chat__stream-caret" aria-hidden="true" /> : null}
				</div>
			</div>
		</article>
	);
}

function describeRole(role: string, t: ChatStrings): { author: string; label: string } {
	if (role === "user") return { author: t.roleUser.charAt(0).toUpperCase(), label: t.roleUser };
	if (role === "assistant") return { author: "π", label: t.roleAssistant };
	if (role === "toolResult") return { author: t.roleTool.charAt(0).toUpperCase(), label: t.roleTool };
	return { author: role.charAt(0).toUpperCase(), label: role };
}

function renderMessageContent(app: App, message: AgentMessage, t: ChatStrings, nextUserText?: string, pendingQuestion?: string): React.ReactNode {
	if (message.role === "user") {
		return renderUserMessage(app, message, t);
	}
	if (message.role === "assistant") {
		return renderAssistantMessage(app, message, t, nextUserText, pendingQuestion);
	}
	return renderToolResultMessage(app, message as ToolResultMessage);
}

function renderUserMessage(app: App, message: UserMessage, t: ChatStrings): React.ReactNode {
	if (typeof message.content === "string") return renderUserText(app, message.content, t);
	return message.content.map((content, index) => {
		if (content.type === "text") return <React.Fragment key={index}>{renderUserText(app, content.text, t)}</React.Fragment>;
		return <img key={index} className="pi-chat__message-image" src={`data:${content.mimeType};base64,${content.data}`} alt="Attached image" />;
	});
}

function renderUserText(app: App, text: string, t: ChatStrings): React.ReactNode {
	const { document, practice, request } = parseAttachedDocumentPrompt(text);
	return (
		<>
			{document ? <AttachedDocumentCard path={document.path} kind={document.kind} /> : null}
			{practice ? (
				<div className="pi-chat__message-attachment pi-chat__message-attachment--practice">
					<span className="pi-chat__message-attachment-icon" aria-hidden="true">
						<TargetIcon />
					</span>
					<span className="pi-chat__message-attachment-text">
						<strong>{t.practiceRequestLabel}</strong>
					</span>
				</div>
			) : null}
			{request ? <MarkdownBlock app={app} text={request} /> : null}
		</>
	);
}

function AttachedDocumentCard({ path, kind }: { path: string; kind: AttachedDocument["kind"] }): React.JSX.Element {
	const pieces = path.split("/");
	const name = pieces.pop() || path;
	const location = pieces.join(" › ");
	return (
		<div className="pi-chat__message-attachment">
			<span className="pi-chat__message-attachment-icon" aria-hidden="true">
				{kind === "PDF text extract" ? "PDF" : "MD"}
			</span>
			<span className="pi-chat__message-attachment-text">
				<strong>{name}</strong>
				{location ? <small>{location}</small> : null}
			</span>
		</div>
	);
}

function renderAssistantMessage(app: App, message: AssistantMessage, t: ChatStrings, nextUserText?: string, pendingQuestion?: string): React.ReactNode {
	return message.content.flatMap((content, index) => {
		if (content.type !== "text") return [];
		const segments = splitQuizSegments(content.text);
		// A response may contain malformed/repeated protocol blocks. Keep only
		// the last quiz in that response so the transcript cannot present more
		// than one new quiz at a time; the live pendingQuiz is the only one
		// that remains answerable.
		let latestQuizIndex = -1;
		segments.forEach((segment, segmentIndex) => {
			if (segment.type === "quiz") latestQuizIndex = segmentIndex;
		});
		return segments.map((segment, segmentIndex): React.ReactNode => {
			const key = `${index}-${segmentIndex}`;
			if (segment.type === "quiz") {
				if (segmentIndex !== latestQuizIndex) return null;
				// The live pending quiz renders once, as the interactive card below.
				if (segment.quiz.question === pendingQuestion) return null;
				return (
					<QuizCard
						key={key}
						{...segment.quiz}
						app={app}
						t={t}
						frozen
						answer={matchQuizAnswer(segment.quiz, nextUserText)}
						freeformValue=""
						onFreeformChange={() => undefined}
						onAnswer={() => undefined}
						onRequestExplanation={() => undefined}
					/>
				);
			}
			// The incomplete-fence strip keeps half-written protocol JSON out of
			// the chat while the message is still streaming.
			const cleaned = stripFlashcardsMarkup(stripVisualMarkup(stripLessonMarkup(stripIncompleteProtocolFence(segment.text))));
			if (!cleaned.trim()) return null;
			return <MarkdownBlock key={key} app={app} text={cleaned} />;
		});
	});
}

function renderToolResultMessage(app: App, message: ToolResultMessage): React.ReactNode {
	return (
		<div className={message.isError ? "pi-chat__tool-result pi-chat__tool-result--error" : "pi-chat__tool-result"}>
			<div>
				Tool result: <strong>{message.toolName}</strong>
			</div>
			{message.content.map((content, index) => {
				if (content.type === "text") {
					return <MarkdownBlock key={index} app={app} text={content.text} />;
				}
				return <img key={index} className="pi-chat__message-image" src={`data:${content.mimeType};base64,${content.data}`} alt="Attached image" />;
			})}
		</div>
	);
}

/**
 * Renders markdown with Obsidian's own renderer, so LaTeX ($…$, $$…$$) and
 * mermaid diagrams render exactly as they would in a vault note.
 */
function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Could not read the selected image."));
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
			} else {
				reject(new Error("Could not read the selected image."));
			}
		};
		reader.readAsDataURL(file);
	});
}

function MarkdownBlock({ app, text }: { app: App; text: string }): React.JSX.Element {
	const ref = useRef<HTMLDivElement | null>(null);
	const componentRef = useRef<Component | null>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el || !text.trim()) {
			return;
		}
		el.empty();
		componentRef.current?.unload();
		const component = new Component();
		componentRef.current = component;
		void renderChatMarkdown(MarkdownRenderer, app, normalizeMathMarkdown(text), el, component);
		return () => {
			component.unload();
			componentRef.current = null;
		};
	}, [text]);

	return <div className="pi-chat__markdown" ref={ref} />;
}
