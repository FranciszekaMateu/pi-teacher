/**
 * ChatContainer — a prompt-kit-style chat scroll container.
 *
 * Mirrors the structure of prompt-kit's ChatContainer (Root + Content +
 * ScrollAnchor) but implemented in plain DOM so it works inside Obsidian's
 * React renderer without needing the shadcn CLI install.
 *
 * Auto-scroll behavior:
 *  - Sticks to the bottom when new content arrives IF the user is
 *    already near the bottom (within `bottomThreshold`).
 *  - Stops sticking when the user scrolls up.
 *  - Resumes sticking when the user scrolls back to the bottom.
 *  - Uses a `ResizeObserver` to catch size changes from streaming tokens.
 */
import { useEffect, useRef } from "react";
import type { JSX, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { ChevronDownIcon } from "./icons";

interface ChatContainerProps {
	children: ReactNode;
	className?: string;
	bottomThreshold?: number; // px from the bottom that count as "at bottom"
	label?: string;
}

export function ChatContainerRoot({ children, className, bottomThreshold = 32, label = "Chat messages" }: ChatContainerProps): JSX.Element {
	const scrollRootRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const stuckRef = useRef<boolean>(true);

	// Restart-stick behavior: whenever the content actually changes we
	// re-evaluate whether to follow along (only if the user was at bottom).
	// We rely on the content being a React child so size changes flow through
	// a ResizeObserver.
	useEffect(() => {
		const root = scrollRootRef.current;
		const content = contentRef.current;
		if (!root || !content) {
			return undefined;
		}

		const userScrolledUp = (): void => {
			const distanceFromBottom = root.scrollHeight - (root.scrollTop + root.clientHeight);
			// If the user is more than the threshold away from the bottom,
			// we consider them "scrolled up" and stop following.
			stuckRef.current = distanceFromBottom <= bottomThreshold;
		};

		root.addEventListener("scroll", userScrolledUp, { passive: true });

		const stickToBottom = (): void => {
			if (!stuckRef.current) {
				return;
			}
			root.scrollTop = root.scrollHeight;
		};

		// Observe content resizes (streaming tokens, tool result appends).
		const resizeObserver = new ResizeObserver(() => {
			stickToBottom();
		});
		resizeObserver.observe(content);

		// Children render commits also trigger a stick; we already observe
		// the content node, but a fallback microtask follows.
		const id = window.requestAnimationFrame(stickToBottom);

		return () => {
			root.removeEventListener("scroll", userScrolledUp);
			resizeObserver.disconnect();
			window.cancelAnimationFrame(id);
		};
	}, [bottomThreshold]);

	const handleContainerClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
		// Clicking the empty area near the right/bottom edge gives the user
		// a quick way to jump back to the latest message.
		if (!scrollRootRef.current) {
			return;
		}
		void event;
	};

	return (
		<div
			ref={scrollRootRef}
			className={classNames("pi-chat-container", className)}
			role="log"
			aria-live="polite"
			aria-label={label}
			onClick={handleContainerClick}
		>
			<div ref={contentRef} className="pi-chat-container__content">
				{children}
			</div>
			<div className="pi-chat-container__scroll-anchor" aria-hidden="true" />
		</div>
	);
}

/**
 * ScrollButton — a small floating button that appears when the user has
 * scrolled up, and jumps back to the bottom when clicked.
 */
export function ScrollButton({
	className,
	bottomThreshold = 32,
	label = "Scroll to latest message",
}: {
	className?: string;
	bottomThreshold?: number;
	label?: string;
}): JSX.Element | null {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const visibleRef = useRef<boolean>(false);

	useEffect(() => {
		// Find the nearest ancestor chat container.
		let node: HTMLElement | null = rootRef.current?.parentElement ?? null;
		while (node && !node.classList.contains("pi-chat-container")) {
			node = node.parentElement;
		}
		if (!node) {
			return undefined;
		}
		node.classList.add("pi-chat-container--has-scroll-button");

		const onScroll = (): void => {
			const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
			const shouldShow = distanceFromBottom > bottomThreshold;
			if (shouldShow !== visibleRef.current) {
				visibleRef.current = shouldShow;
				if (rootRef.current) {
					rootRef.current.style.display = shouldShow ? "flex" : "none";
				}
			}
		};
		node.addEventListener("scroll", onScroll, { passive: true });
		onScroll();

		return () => {
			node.removeEventListener("scroll", onScroll);
			node.classList.remove("pi-chat-container--has-scroll-button");
		};
	}, [bottomThreshold]);

	const scrollToBottom = (): void => {
		let node: HTMLElement | null = rootRef.current?.parentElement ?? null;
		while (node && !node.classList.contains("pi-chat-container")) {
			node = node.parentElement;
		}
		if (!node) {
			return;
		}
		node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
	};

	return (
		<div ref={rootRef} className={classNames("pi-chat-scroll-button", className)} style={{ display: "none" }}>
			<button type="button" onClick={scrollToBottom} aria-label={label}>
				<ChevronDownIcon />
			</button>
		</div>
	);
}

function classNames(...values: Array<string | undefined | null | false>): string {
	return values.filter(Boolean).join(" ");
}