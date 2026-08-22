/**
 * Self-rendered SVG dependency graph for the lesson map. We deliberately do
 * not use Obsidian's ```mermaid pipeline here: the mermaid security prompt
 * does not behave well when triggered from plugin-rendered markdown, and the
 * graph is generated from our own lesson protocol (not vault content), so
 * there is nothing untrusted to gate.
 */
import React from "react";
import type { LessonNode, LessonState } from "../pi/lessonProtocol";

const NODE_W = 148;
const NODE_H = 46;
const GAP_X = 14;
const GAP_Y = 26;

export interface GraphPosition {
	id: string;
	x: number;
	y: number;
	layer: number;
	column: number;
}

/**
 * Assigns each node a topological layer (0 for roots) and a column within
 * its layer. Cycles cannot hang: nodes still being visited fall back to the
 * deepest layer seen so far.
 */
export function layoutLessonGraph(nodes: LessonNode[]): GraphPosition[] {
	const ids = new Set(nodes.map((node) => node.id));
	const layerOf = new Map<string, number>();
	const visiting = new Set<string>();

	const layerFor = (id: string): number => {
		const cached = layerOf.get(id);
		if (cached !== undefined) return cached;
		if (visiting.has(id)) return -1; // cycle: let the caller place it below
		visiting.add(id);
		const node = nodes.find((candidate) => candidate.id === id);
		let layer = 0;
		for (const dependency of node?.dependsOn ?? []) {
			if (ids.has(dependency)) layer = Math.max(layer, layerFor(dependency) + 1);
		}
		visiting.delete(id);
		layerOf.set(id, layer);
		return layer;
	};

	for (const node of nodes) layerFor(node.id);
	// Cycle members never got a layer; place them at the deepest layer + 1.
	const maxLayer = Math.max(0, ...[...layerOf.values()]);
	for (const node of nodes) if (!layerOf.has(node.id)) layerOf.set(node.id, maxLayer + 1);

	const columns = new Map<number, number>();
	return nodes.map((node) => {
		const layer = layerOf.get(node.id) ?? 0;
		const column = columns.get(layer) ?? 0;
		columns.set(layer, column + 1);
		return { id: node.id, x: column * (NODE_W + GAP_X), y: layer * (NODE_H + GAP_Y), layer, column };
	});
}

function wrapTitle(title: string): string[] {
	const words = title.split(/\s+/);
	const lines: string[] = [];
	let current = "";
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length > 22 && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) lines.push(current);
	if (lines.length <= 2) return lines;
	return [...lines.slice(0, 2).map((line) => (line.length > 24 ? `${line.slice(0, 23)}…` : line))];
}

export function LessonGraph({ lesson }: { lesson: LessonState }): React.JSX.Element {
	const positions = layoutLessonGraph(lesson.nodes);
	const byId = new Map(positions.map((position) => [position.id, position]));
	const columns = Math.max(...positions.map((position) => position.column + 1), 1);
	const layers = Math.max(...positions.map((position) => position.layer + 1), 1);
	const width = columns * NODE_W + (columns - 1) * GAP_X;
	const height = layers * NODE_H + (layers - 1) * GAP_Y;

	const center = (position: GraphPosition, side: "top" | "bottom"): { cx: number; cy: number } => ({
		cx: position.x + NODE_W / 2,
		cy: side === "top" ? position.y : position.y + NODE_H,
	});

	return (
		<svg
			className="pi-lesson-graph"
			viewBox={`0 0 ${width} ${height}`}
			style={{ minWidth: `${Math.min(width, 560)}px` }}
			role="img"
			aria-label={lesson.goal}
		>
			<defs>
				<marker id="pi-lesson-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
					<path d="M0 0 L8 4 L0 8 z" className="pi-lesson-graph__arrow" />
				</marker>
			</defs>
			{lesson.nodes.flatMap((node) =>
				(node.dependsOn ?? [])
					.filter((dependency) => byId.has(dependency))
					.map((dependency) => {
						const from = center(byId.get(dependency)!, "bottom");
						const to = center(byId.get(node.id)!, "top");
						const midY = (from.cy + to.cy) / 2;
						return (
							<path
								key={`${dependency}-${node.id}`}
								d={`M ${from.cx} ${from.cy} C ${from.cx} ${midY}, ${to.cx} ${midY}, ${to.cx} ${to.cy}`}
								className="pi-lesson-graph__edge"
								markerEnd="url(#pi-lesson-arrow)"
								fill="none"
							/>
						);
					}),
			)}
			{lesson.nodes.map((node) => {
				const position = byId.get(node.id)!;
				const lines = wrapTitle(node.title);
				return (
					<g key={node.id} className={`pi-lesson-graph__node is-${node.status}`} transform={`translate(${position.x}, ${position.y})`}>
						<rect width={NODE_W} height={NODE_H} rx="8" />
						<text x={NODE_W / 2} y={NODE_H / 2 + (lines.length > 1 ? -3 : 4)} textAnchor="middle">
							{lines.slice(0, 2).map((line, index) => (
								<tspan key={index} x={NODE_W / 2} dy={index === 0 ? 0 : 13}>
									{line}
								</tspan>
							))}
						</text>
					</g>
				);
			})}
		</svg>
	);
}
