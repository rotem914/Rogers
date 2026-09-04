/* A small actions menu behind a "⋯" button.
 *
 * Rows, the note page and tiles all need one, so it lives here once. Escape
 * and a click outside close it, and focus goes back to the button, so the
 * keyboard is never left stranded. */

import { useEffect, useRef, useState, type ReactNode } from "react";

export type MenuItem = {
	label: string;
	onSelect: () => void;
	/** Styled as destructive. */
	danger?: boolean;
};

export function Menu({
	label,
	items,
	className = "",
	children,
}: {
	/** Accessible name of the button, such as "Actions for Hooks". */
	label: string;
	items: MenuItem[];
	className?: string;
	/** Anything rendered inside the trigger instead of the default dots. */
	children?: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		function onPointerDown(event: PointerEvent) {
			if (root.current !== null && !root.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.stopPropagation();
				setOpen(false);
				button.current?.focus();
			}
		}
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	return (
		<div ref={root} className={`relative ${className}`}>
			<button
				ref={button}
				type="button"
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setOpen((value) => !value);
				}}
				className="rounded-card px-2 py-1 text-muted hover:bg-surface-hover hover:text-text"
			>
				{children ?? "⋯"}
			</button>

			{open && (
				<div
					role="menu"
					className="absolute top-full right-0 z-20 mt-1 w-36 overflow-hidden rounded-card border border-border bg-surface shadow-raised"
				>
					{items.map((item) => (
						<button
							key={item.label}
							type="button"
							role="menuitem"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								setOpen(false);
								item.onSelect();
							}}
							className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-hover ${
								item.danger ? "text-danger" : "text-text"
							}`}
						>
							{item.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
