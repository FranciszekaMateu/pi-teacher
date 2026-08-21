import type { LessonState } from "./lessonProtocol";

export type MasteryStatus = "unknown" | "learning" | "mastered";
export interface MasteryEvidence { attempted: number; correct: number; incorrect: number; status: MasteryStatus; }
export type MasteryByConcept = Record<string, MasteryEvidence>;
type GradableQuiz = { conceptId?: string; correctOption?: string };

export function emptyMastery(): MasteryByConcept { return {}; }

/** Objective grading shared by mastery tracking and the quiz UI. Returns null when the quiz is not gradable. */
export function isCorrectQuizAnswer(quiz: { correctOption?: string }, answer: string): boolean | null {
	if (typeof quiz.correctOption !== "string" || !quiz.correctOption.trim()) return null;
	return answer.trim() === quiz.correctOption.trim();
}

/** Records only objectively gradable multiple-choice answers; freeform stays ungraded. */
export function applyQuizAttempt(current: MasteryByConcept, quiz: GradableQuiz, answer: string): MasteryByConcept {
	if (!quiz.conceptId?.trim()) return current;
	const id = quiz.conceptId.trim();
	const previous = current[id] ?? { attempted: 0, correct: 0, incorrect: 0, status: "unknown" as const };
	const graded = isCorrectQuizAnswer(quiz, answer);
	const correct = graded === true;
	const next = { attempted: previous.attempted + 1, correct: previous.correct + (correct ? 1 : 0), incorrect: previous.incorrect + (graded === false ? 1 : 0), status: masteryStatus(previous.correct + (correct ? 1 : 0), previous.incorrect + (graded === false ? 1 : 0)) };
	return { ...current, [id]: next };
}

export function projectLessonMastery(lesson: LessonState, mastery: MasteryByConcept): LessonState {
	return { ...lesson, nodes: lesson.nodes.map((node) => mastery[node.id]?.status === "mastered" ? { ...node, status: "mastered" } : node) };
}

export function masteryStatus(correct: number, incorrect: number): MasteryStatus {
	if (correct >= 2 && correct >= incorrect * 2) return "mastered";
	if (correct + incorrect > 0) return "learning";
	return "unknown";
}
