import { describe, expect, it } from "vitest";
import { layoutLessonGraph } from "./lessonGraph";
import type { LessonNode } from "../pi/lessonProtocol";

describe("layoutLessonGraph", () => {
	it("assigns topological layers and columns", () => {
		const nodes: LessonNode[] = [
			{ id: "a", title: "A", status: "mastered" },
			{ id: "b", title: "B", status: "current", dependsOn: ["a"] },
			{ id: "c", title: "C", status: "locked", dependsOn: ["a"] },
			{ id: "d", title: "D", status: "locked", dependsOn: ["b", "c"] },
		];
		const positions = layoutLessonGraph(nodes);
		const layers = Object.fromEntries(positions.map((position) => [position.id, position.layer]));
		expect(layers).toEqual({ a: 0, b: 1, c: 1, d: 2 });
		const b = positions.find((position) => position.id === "b")!;
		const c = positions.find((position) => position.id === "c")!;
		expect(b.column).not.toBe(c.column);
		expect(b.y).toBeGreaterThan(positions.find((position) => position.id === "a")!.y);
	});

	it("ignores dependencies outside the graph", () => {
		const nodes: LessonNode[] = [{ id: "x", title: "X", status: "ready", dependsOn: ["ghost"] }];
		const positions = layoutLessonGraph(nodes);
		expect(positions[0]?.layer).toBe(0);
	});

	it("survives dependency cycles without hanging", () => {
		const nodes: LessonNode[] = [
			{ id: "p", title: "P", status: "ready", dependsOn: ["q"] },
			{ id: "q", title: "Q", status: "ready", dependsOn: ["p"] },
		];
		const positions = layoutLessonGraph(nodes);
		expect(positions).toHaveLength(2);
		for (const position of positions) expect(position.layer).toBeGreaterThanOrEqual(0);
	});
});
