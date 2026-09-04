/* Home: every project as a tile, plus one tile that makes a new one. */

import { useState } from "react";
import type { CreateProjectBody, Project } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { useApi } from "../lib/useApi";
import { TopBar } from "../components/TopBar";
import { ProjectTile } from "../components/ProjectTile";
import { TileSkeleton, Toast } from "../components/Feedback";

export function Home() {
	const { data, loading, error, refetch } = useApi<Project[]>("/api/projects");

	return (
		<>
			<TopBar title="Rogers" />

			<main className="mx-auto max-w-3xl px-4 py-8">
				{loading && data === null && <TileSkeleton />}

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{data?.map((project) => (
						<ProjectTile
							key={project.id}
							project={project}
							onChanged={refetch}
						/>
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

			<Toast message={error === null ? null : `Could not load your projects. ${error}`} />
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
