/**
 * Minimal bilingual (es/en) string table for the chat UI. The language is
 * resolved once per chat view from the user setting, defaulting to the
 * Obsidian locale.
 */
export type UiLanguagePref = "auto" | "es" | "en";
export type UiLanguage = "es" | "en";

/** Pure resolver so tests don't need Obsidian's moment. */
export function resolveUiLanguage(pref: UiLanguagePref, locale: string): UiLanguage {
	if (pref === "es" || pref === "en") {
		return pref;
	}
	return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

export interface ChatStrings {
	/** Brand shown in the header; same in both languages. */
	title: string;
	saveNote: string;
	chats: string;
	newLesson: string;
	refreshHistory: string;
	closeHistory: string;
	savedCount: (count: number) => string;
	searchPlaceholder: string;
	noMatches: string;
	noChatsYet: string;
	deleteChat: (title: string) => string;
	errorPrefix: string;
	emptyGreeting: string;
	emptyBody: string;
	suggestions: string[];
	placeholder: string;
	attachImageTitle: string;
	attachImageLabel: string;
	attachDocumentTitle: string;
	attachDocumentLabel: string;
	removeAttachment: (name: string) => string;
	composerHint: string;
	modelLabel: string;
	effortLabel: string;
	runtimeButtonTitle: string;
	sendTitle: string;
	abortTitle: string;
	scrollToLatest: string;
	quizTag: string;
	quizAnswer: string;
	quizFreeformPlaceholder: string;
	quizCorrect: string;
	quizIncorrect: (answer: string) => string;
	quizAnswered: (answer: string) => string;
	quizHint: string;
	quizExplain: string;
	practice: string;
	practiceRequestLabel: string;
	lessonMap: string;
	visualKicker: string;
	saveVisual: string;
	flashcardsKicker: string;
	flashcardsCount: (count: number) => string;
	saveFlashcards: string;
	lessonNow: (title: string) => string;
	lessonProgress: (mastered: number, total: number) => string;
	roleUser: string;
	roleAssistant: string;
	roleTool: string;
	thinking: string;
	thinkingWithTools: string;
}

const EN: ChatStrings = {
	title: "Pi teacher",
	saveNote: "Save note",
	chats: "Chats",
	newLesson: "New lesson",
	refreshHistory: "Refresh chat history",
	closeHistory: "Close chat history",
	savedCount: (count) => `${count} saved`,
	searchPlaceholder: "Search conversations",
	noMatches: "No matches",
	noChatsYet: "No saved chats yet",
	deleteChat: (title) => `Delete ${title}`,
	errorPrefix: "Pi error",
	emptyGreeting: "👋 I'm your personal teacher.",
	emptyBody:
		"Tell me what you want to learn and I'll probe what you know, plan the lesson, and walk you through it one step at a time.",
	suggestions: [
		"Teach me differential forms",
		"Quiz me on my last note",
		"Explain Maxwell's equations step by step",
	],
	placeholder: 'Say: "Teach me <topic>…"',
	attachImageTitle: "Attach image (PNG, JPEG, WebP or GIF; max 5 MiB)",
	attachImageLabel: "Image",
	attachDocumentTitle: "Attach the active Markdown note or PDF",
	attachDocumentLabel: "Note",
	removeAttachment: (name) => `Remove ${name}`,
	composerHint: "Enter to send · Shift+Enter for a new line",
	modelLabel: "Model",
	effortLabel: "Effort",
	runtimeButtonTitle: "Model and effort",
	sendTitle: "Send",
	abortTitle: "Abort",
	scrollToLatest: "Scroll to latest message",
	quizTag: "Quiz",
	quizAnswer: "Answer",
	quizFreeformPlaceholder: "Type your answer…",
	quizCorrect: "Correct!",
	quizIncorrect: (answer) => `Not quite — the correct answer was “${answer}”`,
	quizAnswered: (answer) => `You answered: “${answer}”`,
	quizHint: "Hint",
	quizExplain: "I need an explanation first",
	practice: "Practice",
	practiceRequestLabel: "Targeted practice",
	lessonMap: "Map",
	visualKicker: "Proposed visual",
	saveVisual: "Save visual",
	flashcardsKicker: "Proposed spaced repetition",
	flashcardsCount: (count) => `${count} ${count === 1 ? "card" : "cards"} to reinforce`,
	saveFlashcards: "Add to spaced repetition",
	lessonNow: (title) => `Now: ${title}`,
	lessonProgress: (mastered, total) => `${mastered}/${total} concepts mastered`,
	roleUser: "You",
	roleAssistant: "Teacher",
	roleTool: "Tool",
	thinking: "Thinking",
	thinkingWithTools: "Checking your notes",
};

const ES: ChatStrings = {
	title: "Pi teacher",
	saveNote: "Guardar nota",
	chats: "Chats",
	newLesson: "Nueva lección",
	refreshHistory: "Actualizar historial",
	closeHistory: "Cerrar historial",
	savedCount: (count) => `${count} guardado${count === 1 ? "" : "s"}`,
	searchPlaceholder: "Buscar conversaciones",
	noMatches: "No hay coincidencias",
	noChatsYet: "Todavía no hay chats guardados",
	deleteChat: (title) => `Eliminar ${title}`,
	errorPrefix: "Error de Pi",
	emptyGreeting: "👋 Soy tu profesor personal.",
	emptyBody:
		"Dime qué quieres aprender y sondearé lo que sabes, planearé la lección y te guiaré paso a paso.",
	suggestions: [
		"Enséñame formas diferenciales",
		"Hazme un quiz de mi última nota",
		"Explícame las ecuaciones de Maxwell paso a paso",
	],
	placeholder: 'Escribe: "Enséñame <tema>…"',
	attachImageTitle: "Adjuntar imagen (PNG, JPEG, WebP o GIF; máx. 5 MiB)",
	attachImageLabel: "Imagen",
	attachDocumentTitle: "Adjuntar la nota Markdown o PDF activa",
	attachDocumentLabel: "Nota",
	removeAttachment: (name) => `Quitar ${name}`,
	composerHint: "Enter para enviar · Shift+Enter para nueva línea",
	modelLabel: "Modelo",
	effortLabel: "Esfuerzo",
	runtimeButtonTitle: "Modelo y esfuerzo",
	sendTitle: "Enviar",
	abortTitle: "Detener",
	scrollToLatest: "Ir al último mensaje",
	quizTag: "Quiz",
	quizAnswer: "Responder",
	quizFreeformPlaceholder: "Escribe tu respuesta…",
	quizCorrect: "¡Correcto!",
	quizIncorrect: (answer) => `No exactamente — la respuesta correcta era «${answer}»`,
	quizAnswered: (answer) => `Respondiste: «${answer}»`,
	quizHint: "Pista",
	quizExplain: "Necesito una explicación",
	practice: "Practicar",
	practiceRequestLabel: "Práctica dirigida",
	lessonMap: "Mapa",
	visualKicker: "Visual propuesto",
	saveVisual: "Guardar visual",
	flashcardsKicker: "Práctica espaciada propuesta",
	flashcardsCount: (count) => `${count} tarjeta${count === 1 ? "" : "s"} para reforzar`,
	saveFlashcards: "Añadir a repetición espaciada",
	lessonNow: (title) => `Ahora: ${title}`,
	lessonProgress: (mastered, total) => `${mastered}/${total} conceptos consolidados`,
	roleUser: "Tú",
	roleAssistant: "Profesor",
	roleTool: "Herramienta",
	thinking: "Pensando",
	thinkingWithTools: "Revisando tus notas",
};

export function chatStrings(lang: UiLanguage): ChatStrings {
	return lang === "es" ? ES : EN;
}
