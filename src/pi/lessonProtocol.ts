export type LessonPhase = "probe" | "plan" | "teach" | "practice" | "review" | "complete";
export type LessonNodeStatus = "locked" | "ready" | "current" | "mastered";
export interface LessonNode { id: string; title: string; status: LessonNodeStatus; dependsOn?: string[]; }
export interface LessonSource { label: string; path?: string; kind: "vault" | "external"; }
export interface LessonState { phase: LessonPhase; goal: string; nodes: LessonNode[]; sources: LessonSource[]; }

const BLOCK = /```pi-lesson\s*\n([\s\S]*?)\n```/gi;
const PHASES = new Set<LessonPhase>(["probe", "plan", "teach", "practice", "review", "complete"]);
const STATUSES = new Set<LessonNodeStatus>(["locked", "ready", "current", "mastered"]);

/** The model may emit several blocks per reply (probe → plan in one message); the last valid one wins. */
export function extractLessonState(text: string): LessonState | undefined {
	let result: LessonState | undefined;
	for (const match of text.matchAll(BLOCK)) {
		const lesson = parseLessonSource(match[1]);
		if (lesson) result = lesson;
	}
	return result;
}

function parseLessonSource(source: string | undefined): LessonState | undefined {
	if (!source) return undefined;
	try {
		const parsed = JSON.parse(source) as Partial<LessonState>;
		if (!PHASES.has(parsed.phase as LessonPhase) || typeof parsed.goal !== "string" || !parsed.goal.trim() || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.sources)) return undefined;
		const nodes = parsed.nodes.every((node) => node && typeof node.id === "string" && typeof node.title === "string" && STATUSES.has(node.status))
			? parsed.nodes.map((node) => ({ id: node.id.trim(), title: node.title.trim(), status: node.status, ...(Array.isArray(node.dependsOn) ? { dependsOn: node.dependsOn.filter((id): id is string => typeof id === "string") } : {}) })).filter((node) => node.id && node.title)
			: undefined;
		const sources = parsed.sources.every((source) => source && typeof source.label === "string" && (source.kind === "vault" || source.kind === "external"))
			? parsed.sources.map((source) => ({ label: source.label.trim(), kind: source.kind, ...(typeof source.path === "string" ? { path: source.path } : {}) })).filter((source) => source.label)
			: undefined;
		return nodes && sources ? { phase: parsed.phase as LessonPhase, goal: parsed.goal.trim(), nodes, sources } : undefined;
	} catch { return undefined; }
}

export function stripLessonMarkup(text: string): string { return text.replace(BLOCK, "").replace(/\n{3,}/g, "\n\n").trim(); }
