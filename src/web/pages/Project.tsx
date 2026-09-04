/* One project: the composer on top, then its notes, pinned first.
 *
 * The sections are the whole Keep behaviour: PINNED above OTHERS, with the
 * headers only when something is pinned. The order inside each comes from the
 * Worker, so this file only splits. */

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import type { NotePreview, Project as ProjectType } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { useApi } from "../lib/useApi";
import { TopBar } from "../components/TopBar";
import { NoteRow } from "../components/NoteRow";
import { Composer, type ComposerHandle } from "../components/Composer";
import { RowSkeleton, Toast } from "../components/Feedback";

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
				<main className="mx-auto max-w-2xl px-4 py-6">
					<RowSkeleton />
				</main>
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

			<main className="mx-auto max-w-2xl px-4 py-6">
				<div className="mb-4">
					<Composer ref={composer} projectId={project.id} onClosed={notes.refetch} />
				</div>

				{notes.loading && notes.data === null && <RowSkeleton />}

				{sectioned && (
					<Section label="Pinned" notes={pinned} onChanged={notes.refetch} />
				)}
				<Section
					label={sectioned ? "Others" : null}
					notes={others}
					onChanged={notes.refetch}
				/>

				{!notes.loading && notes.data?.length === 0 && (
					<p className="text-faint">Nothing in this project yet. Start typing above.</p>
				)}
			</main>

			<Toast message={notes.error === null ? null : `Could not load the notes. ${notes.error}`} />
		</>
	);
}

function Section({
	label,
	notes,
	onChanged,
}: {
	label: string | null;
	notes: NotePreview[];
	onChanged: () => void;
}) {
	if (notes.length === 0) return null;
	return (
		<section className="mb-6">
			{label !== null && (
				<h2 className="mb-2 px-1 text-xs font-medium tracking-wider text-faint uppercase">
					{label}
				</h2>
			)}
			<ul className="flex flex-col gap-2">
				{notes.map((note) => (
					<li key={note.id}>
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
				className="bidi block w-full truncate text-left text-lg font-medium"
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
			className={`w-full bg-transparent text-lg font-medium outline-none ${
				failed ? "text-danger" : "text-text"
			}`}
		/>
	);
}
