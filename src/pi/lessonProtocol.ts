export type LessonPhase = "probe" | "plan" | "teach" | "practice" | "review" | "complete";
export type LessonNodeStatus = "locked" | "ready" | "current" | "mastered";
export interface LessonNode { id: string; title: string; status: LessonNodeStatus; dependsOn?: string[]; }
export interface LessonSource { label: string; path?: string; kind: "vault" | "external"; }
export interface LessonState { phase: LessonPhase; goal: string; nodes: LessonNode[]; sources: LessonSource[]; }

const BLOCK = /```pi-lesson\s*\n([\s\S]*?)\n```/i;
const PHASES = new Set<LessonPhase>(["probe", "plan", "teach", "practice", "review", "complete"]);
const STATUSES = new Set<LessonNodeStatus>(["locked", "ready", "current", "mastered"]);

export function extractLessonState(text: string): LessonState | undefined {
	const source = BLOCK.exec(text)?.[1];
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

export function stripLessonMarkup(text: string): string { return text.replace(BLOCK, "").trim(); }

/**
 * Renders the lesson dependency graph as a Mermaid flowchart with one class
 * per node status, so the learner can see the whole plan (not just the
 * progress track) at any point during the lesson.
 */
export function lessonGraphMermaid(lesson: LessonState): string {
	const lines = ["flowchart TD"];
	for (const node of lesson.nodes) {
		const label = node.title.replace(/["[\]]/g, "");
		const suffix = node.status === "mastered" || node.status === "current" ? `:::${node.status}` : "";
		lines.push(`  ${node.id}["${label}"]${suffix}`);
	}
	for (const node of lesson.nodes) {
		for (const dependency of node.dependsOn ?? []) {
			if (lesson.nodes.some((candidate) => candidate.id === dependency)) {
				lines.push(`  ${dependency} --> ${node.id}`);
			}
		}
	}
	lines.push("  classDef mastered fill:#3f9d67,color:#fff", "  classDef current fill:#7a6cf0,color:#fff");
	return lines.join("\n");
}
