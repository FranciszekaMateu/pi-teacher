/**
 * Inline stroke icons (16×16 viewBox, lucide-style) so the chat chrome looks
 * identical regardless of the system font's glyph coverage. Keep paths on a
 * 0.5px grid and stroke at 1.4 for crispness at 14–18px render sizes.
 */
import React from "react";

interface IconProps {
	className?: string;
}

function PiIcon({ className = "pi-icon", children }: IconProps & { children: React.ReactNode }): React.JSX.Element {
	return (
		<svg
			viewBox="0 0 16 16"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth={1.4}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{children}
		</svg>
	);
}

export function MessageIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M13.5 10.25a1.5 1.5 0 0 1-1.5 1.5H4.75L2.25 14.3V3.75a1.5 1.5 0 0 1 1.5-1.5h8.25a1.5 1.5 0 0 1 1.5 1.5z" />
		</PiIcon>
	);
}

export function BookmarkIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M12.5 1.75h-8a1 1 0 0 0-1 1v11.5l5-2.35 5 2.35V2.75a1 1 0 0 0-1-1z" />
		</PiIcon>
	);
}

export function PlusIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M3.5 8h9M8 3.5v9" />
		</PiIcon>
	);
}

export function RefreshIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M13.75 8A5.75 5.75 0 1 1 8 2.25a5.7 5.7 0 0 1 4.29 1.75l1.46 1.42" />
			<path d="M14 2v3.4h-3.4" />
		</PiIcon>
	);
}

export function CloseIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="m4 4 8 8M12 4l-8 8" />
		</PiIcon>
	);
}

export function SearchIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<circle cx="6.9" cy="6.9" r="4.9" />
			<path d="m14 14-3.1-3.1" />
		</PiIcon>
	);
}

export function ImageIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.75" />
			<circle cx="6" cy="6" r="1.25" />
			<path d="m13.75 10.25-3.25-3.25-8.25 8.25" />
		</PiIcon>
	);
}

export function FileTextIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M9.5 1.75H4.75A1.25 1.25 0 0 0 3.5 3v10a1.25 1.25 0 0 0 1.25 1.25h7A1.25 1.25 0 0 0 13 13V5.25z" />
			<path d="M9.5 1.75v3.5H13" />
			<path d="M6 8.75h4.5M6 11.25h4.5" />
		</PiIcon>
	);
}

export function SendIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M8 13.5v-11M3 7.5l5-5 5 5" />
		</PiIcon>
	);
}

export function StopIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<rect x="4" y="4" width="8" height="8" rx="1.4" fill="currentColor" stroke="none" />
		</PiIcon>
	);
}

export function ChevronDownIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="m4 6.5 4 4 4-4" />
		</PiIcon>
	);
}

export function SlidersIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M2.5 4.25h3.25M10.5 4.25h3M2.5 8h6M12.75 8h.75M2.5 11.75h3.25M10.5 11.75h3" />
			<circle cx="8.25" cy="4.25" r="1.6" />
			<circle cx="10.5" cy="8" r="1.6" />
			<circle cx="8.25" cy="11.75" r="1.6" />
		</PiIcon>
	);
}

export function TrashIcon(props: IconProps): React.JSX.Element {
	return (
		<PiIcon {...props}>
			<path d="M3 4h10M6 4V2h4v2m-6 0 .7 9h6.6l.7-9M6.5 7v3M9.5 7v3" />
		</PiIcon>
	);
}
