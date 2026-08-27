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
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
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
	const currentName = currentModel ? `${currentModel.provider} · ${currentModel.name}` : modelId;

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
						<select value={`${currentModel?.provider ?? ""}\u0000${modelId}`} disabled={disabled || models.length === 0} onChange={(event) => {
							const [provider, nextModelId] = event.currentTarget.value.split("\u0000", 2);
							if (provider && nextModelId) onChange(provider, nextModelId, thinkingLevel);
						}}>
							{models.map((model) => (
								<option key={`${model.provider}/${model.id}`} value={`${model.provider}\u0000${model.id}`}>
									{model.provider} · {model.name}
								</option>
							))}
						</select>
					</label>
					<label className="pi-chat__runtime-control">
						{strings.effortLabel}
						<select value={thinkingLevel} disabled={disabled || !currentModel} onChange={(event) => {
							if (currentModel) onChange(currentModel.provider, modelId, event.currentTarget.value as ModelThinkingLevel);
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
