/* The tabs beside a project's name, and the button that makes one.
 *
 * A project starts with no tabs and only the plus. The first click turns the
 * project's own list into a tab called Main and puts "New tab" beside it, with
 * an empty list of its own. Main is never a row on the server: it is the
 * notes that are in no live tab, so it cannot be removed, and its name is kept
 * on the project instead. Removing the last other tab takes the strip away.
 *
 * Each tab is a link to its own address, so a reload and the back arrow from a
 * note both land on the tab that was open. The open tab's name is a button
 * instead: clicking it turns the name into a field, the same move as the
 * project name in the bar. Removing is on the tab's own right-click menu, so
 * nothing sits beside the name at all.
 *
 * The plus is invisible until the strip is hovered, or something inside it
 * takes keyboard focus. It holds its space either way, so nothing shifts when
 * it appears. */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Tab } from "../../shared/types";

export function TabStrip({
	projectId,
	mainName,
	tabs,
	activeId,
	onAdd,
	onRename,
	onRemove,
}: {
	projectId: string;
	/** What the first tab is called: "Main" until it is renamed. */
	mainName: string;
	tabs: Tab[];
	/** The open tab, or null for Main. */
	activeId: string | null;
	onAdd: () => void;
	/** A null id renames the first tab. Rejects when the name could not be
	 *  saved, so the field can say so where it sits. */
	onRename: (id: string | null, name: string) => Promise<void>;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="group flex flex-wrap items-center gap-1">
			{tabs.length > 0 && (
				<>
					<TabChip
						name={mainName}
						to={`/p/${projectId}`}
						active={activeId === null}
						onRename={(name) => onRename(null, name)}
					/>
					{tabs.map((tab) => (
						<TabChip
							key={tab.id}
							name={tab.name}
							to={`/p/${projectId}?tab=${tab.id}`}
							active={activeId === tab.id}
							onRename={(name) => onRename(tab.id, name)}
							onRemove={() => onRemove(tab.id)}
						/>
					))}
				</>
			)}

			{/* Built from the chip's own two numbers, so the two boxes are the same
			    height by construction rather than by a measurement that can drift:
			    6px of padding around a 27px line box, which is what 18px text sets.
			    That makes it 39 square, and the icon sits centred inside it. */}
			<button
				type="button"
				aria-label="Add tab"
				onClick={onAdd}
				className="flex shrink-0 items-center cursor-pointer justify-center rounded-pill p-[6px] text-muted opacity-0 transition-opacity duration-[144ms] ease-out group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-hover hover:text-text focus-visible:opacity-100"
			>
				<span className="flex size-[27px] items-center justify-center">
					<svg
						viewBox="0 0 24 24"
						aria-hidden="true"
						className="size-5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
				</span>
			</button>
		</div>
	);
}

function TabChip({
	name,
	to,
	active,
	onRename,
	onRemove,
}: {
	name: string;
	to: string;
	active: boolean;
	onRename?: (name: string) => Promise<void>;
	/** Left out on Main, which cannot be removed. */
	onRemove?: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(name);
	const [failed, setFailed] = useState(false);

	/* The padding sits on the name and not on the chip, so the click target
	   fills the whole chip instead of just the letters. */
	const nameClass = "bidi min-w-0 truncate px-4 py-[6px] text-[18px] font-medium";

	/* Removing lives on the right-click menu, so the strip carries no button
	   for it and stays quiet. Main has no menu, and right-clicking it gives the
	   browser's own. The keyboard reaches this the way it reaches any context
	   menu, with the menu key or Shift+F10 on the focused tab. */
	const [menuOpen, setMenuOpen] = useState(false);
	const chip = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		function onPointerDown(event: PointerEvent) {
			if (chip.current !== null && !chip.current.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.stopPropagation();
				setMenuOpen(false);
			}
		}
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [menuOpen]);

	function startEditing() {
		setDraft(name);
		setFailed(false);
		setEditing(true);
	}

	/* Enter and a click outside both land here. Nothing typed, or the same
	   name, simply closes the field; a name the server refused keeps it open
	   and turns it red, so the person can fix it or leave. */
	async function save() {
		const trimmed = draft.trim();
		if (onRename === undefined || trimmed === "" || trimmed === name) {
			setEditing(false);
			setDraft(name);
			return;
		}
		try {
			await onRename(trimmed);
			setEditing(false);
			setFailed(false);
		} catch {
			setFailed(true);
		}
	}

	return (
		<div
			ref={chip}
			onContextMenu={(event) => {
				if (onRemove === undefined) return;
				event.preventDefault();
				setMenuOpen(true);
			}}
			className={`relative flex items-center rounded-card transition-colors duration-[144ms] ease-out ${
				active ? "bg-card text-text" : "text-muted hover:bg-surface-hover hover:text-text"
			}`}
		>
			{editing ? (
				<input
					autoFocus
					value={draft}
					dir="auto"
					aria-label="Tab name"
					size={Math.max(draft.length, 4)}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={() => void save()}
					onKeyDown={(event) => {
						if (event.key === "Enter") void save();
						if (event.key === "Escape") {
							setDraft(name);
							setEditing(false);
						}
					}}
					className={`bidi min-w-0 bg-transparent px-4 py-[6px] text-[18px] font-medium outline-none ${
						failed ? "text-danger" : "text-text"
					}`}
				/>
			) : active && onRename !== undefined ? (
				<button
					type="button"
					aria-label={`Rename ${name}`}
					aria-current="page"
					onClick={startEditing}
					className={`${nameClass} cursor-text`}
				>
					{name}
				</button>
			) : (
				<Link to={to} aria-current={active ? "page" : undefined} className={nameClass}>
					{name}
				</Link>
			)}
			{menuOpen && onRemove !== undefined && (
				<div
					role="menu"
					className="absolute top-full left-0 z-20 mt-1 w-36 overflow-hidden rounded-card border border-border bg-surface shadow-raised"
				>
					<button
						type="button"
						role="menuitem"
						autoFocus
						onClick={() => {
							setMenuOpen(false);
							onRemove();
						}}
						className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
					>
						Remove
					</button>
				</div>
			)}
		</div>
	);
}
