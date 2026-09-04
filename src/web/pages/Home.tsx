/* Home: every project as a tile, plus one tile that makes a new one.
 *
 * Tiles are dragged into the order they should sit in. The whole tile is the
 * handle, so there is no grip to find, and the grid rearranges under the mouse
 * rather than only after the drop. */

import { useRef, useState, type DragEvent } from "react";
import type {
	CreateProjectBody,
	Project,
	ReorderProjectsBody,
} from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { useApi } from "../lib/useApi";
import { arrange, moved } from "../lib/reorder";
import { TopBar } from "../components/TopBar";
import { ProjectTile } from "../components/ProjectTile";
import { TileSkeleton, Toast } from "../components/Feedback";

export function Home() {
	const { data, loading, error, refetch } = useApi<Project[]>("/api/projects");

	/* The order being dragged: in state so the grid redraws, and in a ref so the
	   drop handler can read what the last hover wrote, because state is a render
	   behind by then. An empty list means "however the server sent them". */
	const [order, setOrder] = useState<string[]>([]);
	const orderRef = useRef<string[]>([]);
	const [dragging, setDragging] = useState<string | null>(null);
	const draggedRef = useRef<string | null>(null);
	const droppedRef = useRef(false);
	const [orderFailed, setOrderFailed] = useState(false);

	const projects = arrange(data ?? [], order);

	function showOrder(next: string[]) {
		orderRef.current = next;
		setOrder(next);
	}

	function startDrag(event: DragEvent<HTMLDivElement>, id: string) {
		/* A drag begun inside the rename field would carry the tile off instead
		   of selecting the text being edited. */
		if (event.target instanceof HTMLInputElement) {
			event.preventDefault();
			return;
		}

		draggedRef.current = id;
		droppedRef.current = false;
		setDragging(id);
		/* Seeded from what is on screen, so a preview built on top of it can never
		   disagree with the grid the drag started from. */
		showOrder(projects.map((project) => project.id));
		event.dataTransfer.effectAllowed = "move";
		/* Firefox starts no drag at all unless the drag carries something. */
		event.dataTransfer.setData("text/plain", id);
	}

	/* Hovering a tile moves the dragged one into its place, so the grid shows the
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

		setOrderFailed(false);
		try {
			const body: ReorderProjectsBody = { ids };
			await apiFetch<Project[]>("/api/projects/order", {
				method: "PUT",
				body: JSON.stringify(body),
			});
			refetch();
		} catch {
			/* Back to the order the server still holds. A grid showing an order
			   that was never saved is worse than one that did not move. */
			showOrder([]);
			setOrderFailed(true);
		}
	}

	function endDrag() {
		draggedRef.current = null;
		setDragging(null);
		/* Let go outside the grid, or cancelled with Escape: put the preview back. */
		if (!droppedRef.current) showOrder([]);
	}

	return (
		<>
			<TopBar title="Rogers" />

			<main className="mx-auto max-w-3xl px-4 py-8">
				{loading && data === null && <TileSkeleton />}

				<div
					className="grid grid-cols-2 gap-3 sm:grid-cols-3"
					onDragOver={(event) => {
						/* Without this the grid is not a drop target and no drop fires. */
						if (draggedRef.current !== null) event.preventDefault();
					}}
					onDrop={() => void drop()}
				>
					{projects.map((project) => (
						<div
							key={project.id}
							draggable
							onDragStart={(event) => startDrag(event, project.id)}
							onDragEnter={() => dragOnto(project.id)}
							onDragEnd={endDrag}
							className={dragging === project.id ? "opacity-50" : undefined}
						>
							<ProjectTile project={project} onChanged={refetch} />
						</div>
					))}

					{/* Last, so a new project appears where the eye already is. */}
					{!loading && <NewProjectTile onCreated={refetch} />}
				</div>

				{!loading && data?.length === 0 && (
					<p className="mt-6 text-faint">
						No projects yet. The tile above makes the first one.
					</p>
				)}
			</main>

			<Toast
				message={
					error !== null
						? `Could not load your projects. ${error}`
						: orderFailed
							? "Could not save the new order."
							: null
				}
			/>
		</>
	);
}

/**
 * The tile that makes a project.
 *
 * It turns into its own name field rather than opening a dialog, so making a
 * project is one click and one line of typing, in the place the new tile will
 * appear.
 */
function NewProjectTile({ onCreated }: { onCreated: () => void }) {
	const [naming, setNaming] = useState(false);
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const [failed, setFailed] = useState(false);

	async function create() {
		const trimmed = name.trim();
		if (trimmed === "") {
			cancel();
			return;
		}

		setSaving(true);
		setFailed(false);
		try {
			/* The id is made here so a retry after a lost answer is recognised as
			   the same project rather than making a second one. */
			const body: CreateProjectBody = { id: crypto.randomUUID(), name: trimmed };
			await apiFetch<Project>("/api/projects", {
				method: "POST",
				body: JSON.stringify(body),
			});
			setName("");
			setNaming(false);
			onCreated();
		} catch {
			/* The typed name stays on screen. Losing it to a failed request would
			   be the small version of the thing this project promises never to do. */
			setFailed(true);
		} finally {
			setSaving(false);
		}
	}

	function cancel() {
		setNaming(false);
		setName("");
		setFailed(false);
	}

	if (!naming) {
		return (
			<button
				type="button"
				onClick={() => setNaming(true)}
				aria-label="New project"
				className="flex aspect-4/3 items-center justify-center rounded-card border border-dashed border-border text-2xl text-muted hover:border-accent hover:text-accent"
			>
				+
			</button>
		);
	}

	return (
		<div className="flex aspect-4/3 flex-col justify-between rounded-card border border-accent bg-surface p-4">
			<input
				autoFocus
				value={name}
				disabled={saving}
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") void create();
					if (event.key === "Escape") cancel();
				}}
				/* Naming a project in Hebrew should not put the caret on the wrong
				   side, so the field follows what is typed into it. */
				dir="auto"
				placeholder="Project name"
				aria-label="Project name"
				className="w-full bg-transparent text-text outline-none placeholder:text-faint"
			/>

			<div className="flex items-center justify-between text-sm">
				<span className="text-faint">
					{failed ? "Could not save. Try again." : "Enter to create"}
				</span>
				<button
					type="button"
					onClick={cancel}
					className="rounded-card px-2 py-1 text-muted hover:bg-surface-hover hover:text-text"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}
