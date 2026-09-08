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
 * it appears.
 *
 * Tabs are dragged into the order they should sit in, the same way the tiles on
 * Home are: the whole chip is the handle and the strip rearranges under the
 * mouse rather than only after the drop. Main is not draggable, because it has
 * no row of its own and so nowhere to keep a position; it stays first. */

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router";
import type { Tab } from "../../shared/types";
import { arrange, moved } from "../lib/reorder";

export function TabStrip({
	projectId,
	mainName,
	tabs,
	activeId,
	onAdd,
	onRename,
	onRemove,
	onToggleChecklist,
	onReorder,
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
	/** Turns that tab's checkbox column on, or off again. Main has no menu. */
	onToggleChecklist: (id: string) => void;
	/** The tabs after Main, in their new order. Rejects when it was not saved,
	 *  so the strip can go back to the order the Worker still holds. */
	onReorder: (ids: string[]) => Promise<void>;
}) {
	/* The order being dragged: in state so the strip redraws, and in a ref so the
	   drop handler can read what the last hover wrote, because state is a render
	   behind by then. An empty list means "however the Worker sent them". */
	const [order, setOrder] = useState<string[]>([]);
	const orderRef = useRef<string[]>([]);
	const [dragging, setDragging] = useState<string | null>(null);
	const draggedRef = useRef<string | null>(null);
	const droppedRef = useRef(false);

	const shown = arrange(tabs, order);

	function showOrder(next: string[]) {
		orderRef.current = next;
		setOrder(next);
	}

	function startDrag(event: DragEvent<HTMLDivElement>, id: string) {
		/* A drag begun inside the rename field would carry the chip off instead
		   of selecting the text being edited. */
		if (event.target instanceof HTMLInputElement) {
			event.preventDefault();
			return;
		}

		draggedRef.current = id;
		droppedRef.current = false;
		setDragging(id);
		/* Seeded from what is on screen, so a preview built on top of it can never
		   disagree with the strip the drag started from. */
		showOrder(shown.map((tab) => tab.id));
		event.dataTransfer.effectAllowed = "move";
		/* Firefox starts no drag at all unless the drag carries something. */
		event.dataTransfer.setData("text/plain", id);
	}

	/* Hovering a chip moves the dragged one into its place, so the strip shows
	   the result while the mouse is still down instead of after it is let go.
	   Main carries none of this, so nothing can be dropped in front of it. */
	function dragOnto(id: string) {
		const dragged = draggedRef.current;
		if (dragged === null) return;
		const next = moved(orderRef.current, dragged, id);
		if (next !== null) showOrder(next);
	}

	async function drop() {
		droppedRef.current = true;
		draggedRef.current = null;
		setDragging(null);

		const ids = orderRef.current;
		if (ids.length === 0) return;

		try {
			await onReorder(ids);
		} catch {
			/* Back to the order the Worker still holds. A strip showing an order
			   that was never saved is worse than one that did not move. */
			showOrder([]);
		}
	}

	function endDrag() {
		draggedRef.current = null;
		setDragging(null);
		/* Let go outside the strip, or cancelled with Escape: put the preview back. */
		if (!droppedRef.current) showOrder([]);
	}

	/* The strip carries its own block of the page's own colour, so the cards
	   scrolling under the sticky bar pass behind the tabs instead of showing
	   through them. */
	return (
		<div className="bg-bg py-3">
			<div
				className="group flex flex-wrap items-center gap-1"
				onDragOver={(event) => {
					/* Without this the strip is not a drop target and no drop fires. */
					if (draggedRef.current !== null) event.preventDefault();
				}}
				onDrop={() => void drop()}
			>
				{tabs.length > 0 && (
					<>
						<TabChip
							name={mainName}
							to={`/p/${projectId}`}
							active={activeId === null}
							onRename={(name) => onRename(null, name)}
						/>
						{shown.map((tab) => (
							<div
								key={tab.id}
								draggable
								onDragStart={(event) => startDrag(event, tab.id)}
								onDragEnter={() => dragOnto(tab.id)}
								onDragEnd={endDrag}
								className={`flex ${dragging === tab.id ? "opacity-50" : ""}`}
							>
								<TabChip
									name={tab.name}
									to={`/p/${projectId}?tab=${tab.id}`}
									active={activeId === tab.id}
									onRename={(name) => onRename(tab.id, name)}
									onRemove={() => onRemove(tab.id)}
									checklist={tab.checklist}
									onToggleChecklist={() => onToggleChecklist(tab.id)}
								/>
							</div>
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
		</div>
	);
}

function TabChip({
	name,
	to,
	active,
	onRename,
	onRemove,
	checklist = false,
	onToggleChecklist,
}: {
	name: string;
	to: string;
	active: boolean;
	onRename?: (name: string) => Promise<void>;
	/** Left out on Main, which cannot be removed. */
	onRemove?: () => void;
	/** Whether this tab already has one, which is what the item says. */
	checklist?: boolean;
	/** Left out on Main too: the menu itself only exists on a real tab. */
	onToggleChecklist?: () => void;
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
				/* A link drags its own address by default and would win over the
				   chip's drag, so it is told not to. */
				<Link
					to={to}
					draggable={false}
					aria-current={active ? "page" : undefined}
					className={nameClass}
				>
					{name}
				</Link>
			)}
			{menuOpen && onRemove !== undefined && (
				<div
					role="menu"
					className="absolute top-full left-0 z-20 mt-1 w-36 overflow-hidden rounded-card border border-border bg-surface shadow-raised"
				>
					{onToggleChecklist !== undefined && (
						<button
							type="button"
							role="menuitem"
							autoFocus
							onClick={() => {
								setMenuOpen(false);
								onToggleChecklist();
							}}
							className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-text hover:bg-surface-hover"
						>
							{checklist ? "Remove checklist" : "Add checklist"}
						</button>
					)}
					<button
						type="button"
						role="menuitem"
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
