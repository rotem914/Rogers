/* One line in a project's list.
 *
 * A row, not a card: the project page is a single column the way Keep's list
 * view is, so a long note and a one-word note sit in the same rhythm.
 *
 * The row is a div with a covering link, so the right-click menu can sit above
 * it as real buttons; a control nested inside a link is neither reliably
 * clickable nor announced properly. */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Note, NotePreview } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { ImageStrip } from "./ImageStrip";

/** The popup's own width, `w-36`, so it can be kept inside the row. */
const MENU_WIDTH = 144;

export function NoteRow({
	note,
	onChanged,
}: {
	note: NotePreview;
	/** The list refetches after a pin or an archive. */
	onChanged: () => void;
}) {
	const untitled = note.title.trim() === "";
	const empty = untitled && note.preview.trim() === "";
	const pinned = note.pinnedAt !== null;

	/* Pinning and archiving live on the right-click menu, so the row carries no
	   buttons of its own and stays quiet. Same shape as the tab chips: the point
	   is where the menu opens, measured from the row's own corner. The keyboard
	   reaches this the way it reaches any context menu, with the menu key or
	   Shift+F10 on the focused row. */
	const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
	const root = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (point === null) return;
		function onPointerDown(event: PointerEvent) {
			if (root.current !== null && !root.current.contains(event.target as Node)) {
				setPoint(null);
			}
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				event.stopPropagation();
				setPoint(null);
			}
		}
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [point]);

	async function save(body: object) {
		try {
			await apiFetch<Note>(`/api/notes/${note.id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			});
		} catch {
			/* The list stays as it was; the next refetch shows the truth. */
		}
		onChanged();
	}

	async function archive() {
		try {
			await apiFetch<Note>(`/api/notes/${note.id}`, { method: "DELETE" });
		} catch {
			/* Same: nothing on screen is invented. */
		}
		onChanged();
	}

	return (
		<div
			ref={root}
			onContextMenu={(event) => {
				event.preventDefault();
				/* Kept inside the row, so a right-click near the right edge does not
				   open a menu hanging off it. */
				const box = event.currentTarget.getBoundingClientRect();
				setPoint({
					x: Math.max(0, Math.min(event.clientX - box.left, box.width - MENU_WIDTH)),
					y: Math.max(0, event.clientY - box.top),
				});
			}}
			className="group relative rounded-[10px] bg-card px-4 py-4 transition-colors duration-[144ms] ease-out hover:bg-card-hover"
		>
			{/* Not draggable: a link drags its own address by default, and this one
			    covers the row, so it would win over dragging the row itself into a
			    new place in the list. */}
			<Link
				to={`/n/${note.id}`}
				aria-label={untitled ? "Open note" : `Open ${note.title}`}
				draggable={false}
				className="absolute inset-0 rounded-[10px]"
			/>

			<div className="pointer-events-none">
				{!untitled && (
					<span className="bidi block truncate text-lg font-medium">{note.title}</span>
				)}

				{note.preview.trim() !== "" && (
					/* Three lines at most, so one long note cannot push the rest of the
					   list off the screen. No `block` here on purpose: line-clamp needs
					   display:-webkit-box and Tailwind emits .block afterwards, which
					   would silently kill the clamp. break-words is for a pasted link,
					   one unbroken word that would otherwise run past the edge. */
					<span
						className={`bidi line-clamp-3 break-words whitespace-pre-wrap text-lg text-muted ${
							untitled ? "" : "mt-1"
						}`}
					>
						{note.preview}
					</span>
				)}

				{empty && note.images.length === 0 && (
					<span className="block text-faint">Empty note</span>
				)}

				{note.images.length > 0 && (
					<div className={untitled && note.preview.trim() === "" ? "" : "mt-2"}>
						<ImageStrip keys={note.images} size="sm" />
					</div>
				)}
			</div>

			{point !== null && (
				<div
					role="menu"
					aria-label={untitled ? "Actions for note" : `Actions for ${note.title}`}
					style={{ left: point.x, top: point.y }}
					className="absolute z-20 w-36 overflow-hidden rounded-card border border-border bg-surface shadow-raised"
				>
					<button
						type="button"
						role="menuitem"
						autoFocus
						onClick={() => {
							setPoint(null);
							void save({ pinned: !pinned });
						}}
						className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-text hover:bg-surface-hover"
					>
						{pinned ? "Unpin" : "Pin"}
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							setPoint(null);
							void archive();
						}}
						className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-danger hover:bg-surface-hover"
					>
						Archive
					</button>
				</div>
			)}
		</div>
	);
}
