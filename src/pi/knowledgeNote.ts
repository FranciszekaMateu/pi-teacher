import { extractQuiz, stripQuizMarkup } from "./quizProtocol";
import type { LessonState } from "./lessonProtocol";

type TranscriptMessage = { role?: string; content?: unknown };

export interface KnowledgeNote { title: string; markdown: string; }

export function buildKnowledgeNote(messages: TranscriptMessage[], chatId: string, createdAt: Date, lesson?: LessonState): KnowledgeNote {
	const firstUser = messages.find((message) => message.role === "user");
	const title = titleFromContent(firstUser?.content) || "Sesión de Pi Teacher";
	const knowledge: string[] = [];
	const practice: string[] = [];

	for (let index = 0; index < messages.length; index++) {
		const message = messages[index];
		if (!message || message.role !== "assistant") continue;
		const text = textFromContent(message.content);
		const clean = stripQuizMarkup(text);
		if (clean) knowledge.push(clean);
		const quiz = extractQuiz(text);
		if (!quiz) continue;
		const answer = messages.slice(index + 1).find((candidate) => candidate.role === "user");
		practice.push([`### ${quiz.question}`, ...quiz.options.map((option) => `- ${option}`), answer ? `\n**Respuesta de Fran:** ${titleFromContent(answer.content) || "—"}` : "\n**Respuesta de Fran:** pendiente"].join("\n"));
	}

	const lessonMarkdown = lesson ? ["## Ruta de aprendizaje", `**Fase:** ${lesson.phase}`, `**Objetivo:** ${lesson.goal}`, "", "### Plan", "```mermaid", lessonMermaid(lesson), "```", "", "### Mapa de conceptos", ...lesson.nodes.map((node) => `- [${node.status === "mastered" ? "x" : " "}] **${node.title}** — ${node.status}`), "", "### Fuentes", ...(lesson.sources.length ? lesson.sources.map((source) => `- ${source.kind === "vault" && source.path ? `[[${source.path}|${source.label}]]` : source.path ?? source.label}`) : ["- _Sin fuentes registradas todavía._"]), ""] : [];
	return { title, markdown: [
		"---", "type: pi-teacher-knowledge", `pi_teacher_chat: ${chatId}`, `created: ${createdAt.toISOString().slice(0, 10)}`, "tags:", "  - pi-teacher", "---", "",
		`# ${title}`, "", ...lessonMarkdown, "## Núcleo de conocimiento",
		knowledge.length ? knowledge.join("\n\n---\n\n") : "_Todavía no hay una explicación del Teacher para guardar._", "", "## Práctica y recuperación",
		practice.length ? practice.join("\n\n") : "_Esta conversación todavía no generó quizzes._", "",
	].join("\n") };
}

export function lessonMermaid(lesson: LessonState): string {
	const ids = new Map(lesson.nodes.map((node, index) => [node.id, `n${index}`]));
	const lines = ["flowchart TD"];
	for (const node of lesson.nodes) lines.push(`  ${ids.get(node.id)}["${node.title.replace(/["[\]]/g, "")}"]`);
	for (const node of lesson.nodes) for (const dependency of node.dependsOn ?? []) if (ids.has(dependency)) lines.push(`  ${ids.get(dependency)} --> ${ids.get(node.id)}`);
	return lines.join("\n");
}
export function sourceChatId(activeChatPath: string | undefined, messages: TranscriptMessage[]): string {
	if (activeChatPath) return activeChatPath.replace(/\\/g, "/").split("/").at(-1) || activeChatPath;
	const first = messages.find((message) => message.role === "user");
	return `live-${stableHash(textFromContent(first?.content))}`;
}

/** Ignore the created date when deciding if chat knowledge changed. */
export function noteContentChanged(existing: string, next: string): boolean {
	return canonicalNote(existing) !== canonicalNote(next);
}

function canonicalNote(markdown: string): string {
	return markdown.replace(/^created: .*$/m, "created: <stable>").trim();
}
function stableHash(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
	return (hash >>> 0).toString(36);
}
function textFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.filter((part): part is { type?: string; text?: string } => Boolean(part) && typeof part === "object" && (part as { type?: string }).type === "text" && typeof (part as { text?: string }).text === "string").map((part) => part.text ?? "").join("\n");
}
function titleFromContent(content: unknown): string {
	return textFromContent(content).replace(/<pi-attached-document\b[^>]*>[\s\S]*?<\/pi-attached-document>/gi, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
