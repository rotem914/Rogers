/* One project: the composer on top, then its notes, pinned first.
 *
 * The sections are the whole Keep behaviour: PINNED above OTHERS, with the
 * headers only when something is pinned. The order inside each comes from the
 * Worker; this file splits the two and lets each one be dragged into a new
 * order of its own. */

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useParams } from "react-router";
import type {
	NotePreview,
	Project as ProjectType,
	ReorderNotesBody,
} from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { useApi } from "../lib/useApi";
import { arrange, moved } from "../lib/reorder";
import { TopBar } from "../components/TopBar";
import { NoteRow } from "../components/NoteRow";
import { Composer, type ComposerHandle } from "../components/Composer";
import { Toast } from "../components/Feedback";

export function Project() {
	const { id } = useParams<{ id: string }>();

	/* There is no endpoint for one project, so the name comes from the list.
	   It is a small payload, and it also answers the question a direct link
	   raises: a project that is not in the list is either gone or archived. */
	const projects = useApi<ProjectType[]>("/api/projects");
	const project = projects.data?.find((candidate) => candidate.id === id) ?? null;

	const notes = useApi<NotePreview[]>(
		id === undefined ? null : `/api/projects/${id}/notes`,
	);

	const composer = useRef<ComposerHandle>(null);
	const [orderFailed, setOrderFailed] = useState(false);

	/* N opens the composer, unless the keystroke belongs to a field. */
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key !== "n" && event.key !== "N") return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const target = event.target as HTMLElement | null;
			const typing =
				target !== null &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable);
			if (typing) return;
			event.preventDefault();
			composer.current?.open();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	if (projects.loading) {
		return (
			<>
				<TopBar backTo="/" title="" />
				<main className="mx-auto max-w-2xl px-4 py-6" />
			</>
		);
	}

	if (project === null) {
		return (
			<>
				<TopBar backTo="/" title="Rogers" />
				<main className="mx-auto max-w-2xl px-4 py-8">
					<p className="text-muted">That project is not here any more.</p>
				</main>
				<Toast message={projects.error} />
			</>
		);
	}

	const pinned = notes.data?.filter((note) => note.pinnedAt !== null) ?? [];
	const others = notes.data?.filter((note) => note.pinnedAt === null) ?? [];
	const sectioned = pinned.length > 0;

	return (
		<>
			<TopBar
				backTo="/"
				title={<ProjectName project={project} onRenamed={projects.refetch} />}
			/>

			<main className="mx-auto max-w-[752px] px-4 pt-14 pb-6">
				<div className="mb-6">
					<Composer ref={composer} projectId={project.id} onClosed={notes.refetch} />
				</div>

				{sectioned && (
					<Section
						label="Pinned"
						projectId={project.id}
						notes={pinned}
						onChanged={notes.refetch}
						onOrderFailed={setOrderFailed}
					/>
				)}
				<Section
					label={sectioned ? "Others" : null}
					projectId={project.id}
					notes={others}
					onChanged={notes.refetch}
					onOrderFailed={setOrderFailed}
				/>

				{!notes.loading && notes.data?.length === 0 && (
					<p className="text-faint">Nothing in this project yet. Start typing above.</p>
				)}
			</main>

			<Toast
				message={
					notes.error !== null
						? `Could not load the notes. ${notes.error}`
						: orderFailed
							? "Could not save the new order."
							: null
				}
			/>
		</>
	);
}

function Section({
	label,
	projectId,
	notes,
	onChanged,
	onOrderFailed,
}: {
	label: string | null;
	projectId: string;
	notes: NotePreview[];
	onChanged: () => void;
	onOrderFailed: (failed: boolean) => void;
}) {
	/* The order being dragged: in state so the list redraws, and in a ref so the
	   drop handler can read what the last hover wrote, because state is a render
	   behind by then. An empty list means "however the Worker sent them".

	   Each section owns its own, and that is what keeps a row dragged out of
	   Pinned from landing among the others: the section it is dragged into never
	   learns a drag is running, so it never becomes a drop target and the row
	   goes back where it started. Crossing the line between the two sections is
	   what the pin does, not what a drag does. */
	const [order, setOrder] = useState<string[]>([]);
	const orderRef = useRef<string[]>([]);
	const [dragging, setDragging] = useState<string | null>(null);
	const draggedRef = useRef<string | null>(null);
	const droppedRef = useRef(false);

	const rows = arrange(notes, order);

	function showOrder(next: string[]) {
		orderRef.current = next;
		setOrder(next);
	}

	function startDrag(event: DragEvent<HTMLLIElement>, id: string) {
		draggedRef.current = id;
		droppedRef.current = false;
		setDragging(id);
		/* Seeded from what is on screen, so a preview built on top of it can never
		   disagree with the list the drag started from. */
		showOrder(rows.map((note) => note.id));
		event.dataTransfer.effectAllowed = "move";
		/* Firefox starts no drag at all unless the drag carries something. */
		event.dataTransfer.setData("text/plain", id);
	}

	/* Hovering a row moves the dragged one into its place, so the list shows the
	   result while the mouse is still down instead of after it is let go. */
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

		onOrderFailed(false);
		try {
			const body: ReorderNotesBody = { ids };
			await apiFetch<NotePreview[]>(`/api/projects/${projectId}/notes/order`, {
				method: "PUT",
				body: JSON.stringify(body),
			});
			onChanged();
		} catch {
			/* Back to the order the Worker still holds. A list showing an order
			   that was never saved is worse than one that did not move. */
			showOrder([]);
			onOrderFailed(true);
		}
	}

	function endDrag() {
		draggedRef.current = null;
		setDragging(null);
		/* Let go outside the list, or cancelled with Escape: put the preview back. */
		if (!droppedRef.current) showOrder([]);
	}

	if (notes.length === 0) return null;

	return (
		<section className="mb-6">
			{label !== null && (
				<h2 className="mb-2 px-1 text-xs font-medium tracking-wider text-faint uppercase">
					{label}
				</h2>
			)}
			<ul
				className="flex flex-col gap-[14px]"
				onDragOver={(event) => {
					/* Without this the list is not a drop target and no drop fires. */
					if (draggedRef.current !== null) event.preventDefault();
				}}
				onDrop={() => void drop()}
			>
				{rows.map((note) => (
					<li
						key={note.id}
						draggable
						onDragStart={(event) => startDrag(event, note.id)}
						onDragEnter={() => dragOnto(note.id)}
						onDragEnd={endDrag}
						className={dragging === note.id ? "opacity-50" : undefined}
					>
						<NoteRow note={note} onChanged={onChanged} />
					</li>
				))}
			</ul>
		</section>
	);
}

/**
 * The project name in the bar, renameable where it sits.
 *
 * Clicking the name turns it into a field, which is the same move as the tile
 * menu on Home and saves a trip back there to rename something you are looking
 * at.
 */
function ProjectName({
	project,
	onRenamed,
}: {
	project: ProjectType;
	onRenamed: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(project.name);
	const [failed, setFailed] = useState(false);

	async function save() {
		const trimmed = name.trim();
		if (trimmed === "" || trimmed === project.name) {
			setEditing(false);
			setName(project.name);
			return;
		}
		try {
			await apiFetch<ProjectType>(`/api/projects/${project.id}`, {
				method: "PATCH",
				body: JSON.stringify({ name: trimmed }),
			});
			setEditing(false);
			setFailed(false);
			onRenamed();
		} catch {
			setFailed(true);
		}
	}

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => setEditing(true)}
				className="bidi block w-full truncate text-left text-[32px] font-medium"
			>
				{project.name}
			</button>
		);
	}

	return (
		<input
			autoFocus
			value={name}
			dir="auto"
			aria-label="Project name"
			onChange={(event) => setName(event.target.value)}
			onBlur={() => void save()}
			onKeyDown={(event) => {
				if (event.key === "Enter") void save();
				if (event.key === "Escape") {
					setName(project.name);
					setEditing(false);
				}
			}}
			className={`w-full bg-transparent text-[32px] font-medium outline-none ${
				failed ? "text-danger" : "text-text"
			}`}
		/>
	);
}
