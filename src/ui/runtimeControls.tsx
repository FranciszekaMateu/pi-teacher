/**
 * Compact runtime controls: a single toggle that opens a small popover with
 * the model and thinking-effort selects, so the composer meta row stays slim
 * on narrow leaves.
 */
import React, { useEffect, useRef, useState } from "react";
import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import { SlidersIcon } from "./icons";
import type { ChatStrings } from "./strings";
import type { PiRuntimeModel } from "../pi/rpcState";

const THINKING_LEVELS: ModelThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

/**
 * Keep provider and model IDs together without embedding a control character
 * in the HTML option value. Browsers can truncate NUL-delimited values, which
 * leaves the model select visually blank even when a model is selected.
 */
function modelOptionValue(model: Pick<PiRuntimeModel, "provider" | "id">): string {
	return JSON.stringify([model.provider, model.id]);
}

function parseModelOptionValue(value: string): [string, string] | undefined {
	try {
		const parsed: unknown = JSON.parse(value);
		if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === "string" && typeof parsed[1] === "string") {
			return [parsed[0], parsed[1]];
		}
	} catch {
		// Ignore malformed values; the controlled select will retain its current option.
	}
	return undefined;
}

interface RuntimeControlsProps {
	strings: ChatStrings;
	provider: string;
	modelId: string;
	thinkingLevel: ModelThinkingLevel;
	models: PiRuntimeModel[];
	disabled: boolean;
	onChange: (provider: string, modelId: string, effort: ModelThinkingLevel) => void;
}

export function RuntimeControls({ strings, provider, modelId, thinkingLevel, models, disabled, onChange }: RuntimeControlsProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) {
			return undefined;
		}
		const onPointerDown = (event: PointerEvent): void => {
			if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("keydown", onKeyDown, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("keydown", onKeyDown, true);
		};
	}, [open]);

	const currentModel = models.find((model) => model.provider === provider && model.id === modelId);
	// The runtime can briefly report its internal "Unknown" placeholder while
	// its catalog is loading. Keep the selects bound to a real option so the UI
	// never renders a blank model field during that transition.
	const selectedModel = currentModel ?? models.find((model) => model.provider === provider) ?? models[0];
	const currentName = selectedModel ? `${selectedModel.provider} · ${selectedModel.name}` : modelId;

	return (
		<div className="pi-chat__runtime" ref={rootRef}>
			<button
				type="button"
				className={open ? "pi-chat__runtime-toggle is-open" : "pi-chat__runtime-toggle"}
				onClick={() => setOpen((value) => !value)}
				disabled={disabled}
				aria-expanded={open}
				title={strings.runtimeButtonTitle}
				aria-label={strings.runtimeButtonTitle}
			>
				<SlidersIcon />
				<span className="pi-chat__runtime-model">{currentName}</span>
			</button>
			{open ? (
				<div className="pi-chat__runtime-popover" role="dialog" aria-label={strings.runtimeButtonTitle}>
					<label className="pi-chat__runtime-control">
						{strings.modelLabel}
						<select value={selectedModel ? modelOptionValue(selectedModel) : ""} disabled={disabled || models.length === 0} onChange={(event) => {
							const selection = parseModelOptionValue(event.currentTarget.value);
							if (selection) onChange(selection[0], selection[1], thinkingLevel);
						}}>
							{models.map((model) => (
								<option key={`${model.provider}/${model.id}`} value={modelOptionValue(model)}>
									{model.provider} · {model.name}
								</option>
							))}
						</select>
					</label>
					<label className="pi-chat__runtime-control">
						{strings.effortLabel}
						<select value={thinkingLevel} disabled={disabled || !selectedModel} onChange={(event) => {
							if (selectedModel) onChange(selectedModel.provider, selectedModel.id, event.currentTarget.value as ModelThinkingLevel);
						}}>
							{THINKING_LEVELS.map((level) => (
								<option key={level} value={level}>
									{level}
								</option>
							))}
						</select>
					</label>
				</div>
			) : null}
		</div>
	);
}
