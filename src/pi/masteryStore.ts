/**
 * Cross-session mastery persistence. Quiz results are accumulated per
 * concept and written to <vault>/.pi/agent/mastery.json so future lessons
 * can calibrate their probe against what the learner already mastered.
 */
import type { MasteryByConcept, MasteryEvidence } from "./learningProgress";
import { masteryStatus } from "./learningProgress";

export interface MasteryRecord extends MasteryEvidence {
	/** Node title from the lesson that introduced the concept, for humans and for id-less matching. */
	title?: string;
	updatedAt: string;
}

export interface MasteryFile {
	version: 1;
	concepts: Record<string, MasteryRecord>;
}

const MAX_PROFILE_CONCEPTS = 40;

export function buildMasteryFile(mastery: MasteryByConcept, titles: Record<string, string>): MasteryFile {
	const concepts: Record<string, MasteryRecord> = {};
	for (const [id, evidence] of Object.entries(mastery)) {
		concepts[id] = { ...evidence, ...(titles[id] ? { title: titles[id] } : {}), updatedAt: new Date().toISOString() };
	}
	return { version: 1, concepts };
}

/** Tolerant parse: any malformed file yields empty mastery rather than an error. */
export function parseMasteryFile(raw: string): { mastery: MasteryByConcept; titles: Record<string, string> } {
	try {
		const parsed = JSON.parse(raw) as Partial<MasteryFile>;
		if (!parsed || parsed.version !== 1 || !parsed.concepts || typeof parsed.concepts !== "object") {
			return { mastery: {}, titles: {} };
		}
		const mastery: MasteryByConcept = {};
		const titles: Record<string, string> = {};
		for (const [id, record] of Object.entries(parsed.concepts)) {
			if (!id.trim() || !record || typeof record.attempted !== "number" || typeof record.correct !== "number" || typeof record.incorrect !== "number") continue;
			mastery[id.trim()] = {
				attempted: record.attempted,
				correct: record.correct,
				incorrect: record.incorrect,
				status: record.status === "mastered" || record.status === "learning" ? record.status : masteryStatus(record.correct, record.incorrect),
			};
			if (typeof record.title === "string" && record.title.trim()) titles[id.trim()] = record.title.trim();
		}
		return { mastery, titles };
	} catch {
		return { mastery: {}, titles: {} };
	}
}

/** Per-concept union; the live session's evidence wins over the stored one. */
export function mergeMastery(stored: MasteryByConcept, live: MasteryByConcept): MasteryByConcept {
	const merged: MasteryByConcept = { ...stored };
	for (const [id, evidence] of Object.entries(live)) {
		const previous = merged[id];
		merged[id] = previous
			? { attempted: previous.attempted + evidence.attempted, correct: previous.correct + evidence.correct, incorrect: previous.incorrect + evidence.incorrect, status: masteryStatus(previous.correct + evidence.correct, previous.incorrect + evidence.incorrect) }
			: evidence;
	}
	return merged;
}

/**
 * Prompt block injected before the first message of a new lesson so the
 * teacher probes around known strengths and gaps instead of from zero.
 */
export function learnerProfilePrompt(mastery: MasteryByConcept, titles: Record<string, string>): string | null {
	const label = (id: string): string => titles[id] ?? id;
	const mastered = Object.entries(mastery).filter(([, evidence]) => evidence.status === "mastered").map(([id]) => label(id));
	const learning = Object.entries(mastery).filter(([, evidence]) => evidence.status === "learning").map(([id]) => label(id));
	if (mastered.length === 0 && learning.length === 0) return null;
	const lines = ["<pi-learner-profile>", "Quiz-verified mastery from this learner's previous lessons:"];
	if (mastered.length) lines.push(`- Mastered (skip re-probing unless the learner asks): ${mastered.slice(0, MAX_PROFILE_CONCEPTS).join("; ")}`);
	if (learning.length) lines.push(`- Still learning (probe these first): ${learning.slice(0, MAX_PROFILE_CONCEPTS).join("; ")}`);
	lines.push("Calibrate the probe against this profile; do not re-teach mastered prerequisites.", "</pi-learner-profile>");
	return lines.join("\n");
}
