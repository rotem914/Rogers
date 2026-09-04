/* One line in a project's list.
 *
 * A row, not a card: the project page is a single column the way Keep's list
 * view is, so a long note and a one-word note sit in the same rhythm.
 *
 * The row is a div with a covering link, so the pin and the menu can sit above
 * it as real buttons; a control nested inside a link is neither reliably
 * clickable nor announced properly. */

import { Link } from "react-router";
import type { Note, NotePreview } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { Menu } from "./Menu";
import { ImageStrip } from "./ImageStrip";

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
		<div className="group relative rounded-card border border-border bg-surface px-4 py-3 hover:bg-surface-hover">
			{/* Not draggable: a link drags its own address by default, and this one
			    covers the row, so it would win over dragging the row itself into a
			    new place in the list. */}
			<Link
				to={`/n/${note.id}`}
				aria-label={untitled ? "Open note" : `Open ${note.title}`}
				draggable={false}
				className="absolute inset-0 rounded-card"
			/>

			<div className="pointer-events-none pr-16">
				{!untitled && (
					<span className="bidi block truncate font-medium">{note.title}</span>
				)}

				{note.preview.trim() !== "" && (
					/* Three lines at most, so one long note cannot push the rest of the
					   list off the screen. No `block` here on purpose: line-clamp needs
					   display:-webkit-box and Tailwind emits .block afterwards, which
					   would silently kill the clamp. break-words is for a pasted link,
					   one unbroken word that would otherwise run past the edge. */
					<span
						className={`bidi line-clamp-3 break-words whitespace-pre-wrap text-muted ${
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

			{/* Chrome, top right whatever direction the text runs in. Hidden until
			    the row is hovered or a control inside it has focus, like Keep. A
			    pinned star stays visible so the section reads at a glance. */}
			<div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
				<button
					type="button"
					aria-label={pinned ? "Unpin" : "Pin"}
					aria-pressed={pinned}
					onClick={(event) => {
						event.preventDefault();
						void save({ pinned: !pinned });
					}}
					className={`rounded-card px-2 py-1 hover:bg-surface-hover ${
						pinned ? "text-accent" : "text-muted"
					}`}
				>
					{pinned ? "★" : "☆"}
				</button>
				<Menu
					label={untitled ? "Actions for note" : `Actions for ${note.title}`}
					items={[{ label: "Archive", onSelect: () => void archive(), danger: true }]}
				/>
			</div>
		</div>
	);
}
