/* One project tile, and the menu that renames, recolours or puts it away.
 *
 * The tile is a div rather than a link with a button inside it, because a
 * control nested in a link is neither reliably clickable nor announced
 * correctly. The link is an overlay that covers the tile, and the menu button
 * sits above it. */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Project, UpdateProjectBody } from "../../shared/types";
import { apiFetch } from "../platform/api-client";

/** The accents a project can wear. Borders only, so nothing competes with text. */
const COLORS: { label: string; value: string | null }[] = [
	{ label: "None", value: null },
	{ label: "Yellow", value: "#f2c744" },
	{ label: "Orange", value: "#f0a868" },
	{ label: "Red", value: "#f28b82" },
	{ label: "Green", value: "#81c995" },
	{ label: "Blue", value: "#78a9ff" },
	{ label: "Purple", value: "#d3a4f9" },
];

type Mode = "view" | "menu" | "renaming" | "colouring";

export function ProjectTile({
	project,
	onChanged,
}: {
	project: Project;
	onChanged: () => void;
}) {
	const [mode, setMode] = useState<Mode>("view");
	const [name, setName] = useState(project.name);
	const [failed, setFailed] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);

	/* Escape closes whatever is open and puts focus back where it came from, so
	   the keyboard never ends up stranded on a tile with no menu. */
	useEffect(() => {
		if (mode === "view") return;
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setMode("view");
				setName(project.name);
				menuButton.current?.focus();
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [mode, project.name]);

	async function save(patch: UpdateProjectBody) {
		setFailed(false);
		try {
			await apiFetch<Project>(`/api/projects/${project.id}`, {
				method: "PATCH",
				body: JSON.stringify(patch),
			});
			setMode("view");
			onChanged();
		} catch {
			setFailed(true);
		}
	}

	async function archive() {
		setFailed(false);
		try {
			await apiFetch<Project>(`/api/projects/${project.id}`, {
				method: "DELETE",
			});
			setMode("view");
			onChanged();
		} catch {
			setFailed(true);
		}
	}

	const border = project.color !== null ? { borderColor: project.color } : undefined;

	return (
		<div
			className="group relative flex aspect-4/3 flex-col justify-between rounded-card border border-border bg-surface p-4 hover:bg-surface-hover"
			style={border}
		>
			{mode === "renaming" ? (
				<input
					autoFocus
					value={name}
					dir="auto"
					aria-label="Project name"
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && name.trim() !== "") {
							void save({ name: name.trim() });
						}
					}}
					className="w-full bg-transparent font-medium text-text outline-none"
				/>
			) : (
				<>
					{/* The overlay link. It sits under the menu button, which is why the
					    button can still be clicked. It is not draggable, because a link
					    drags its own address by default, and this one covers the tile,
					    so it would win over dragging the tile itself on Home. */}
					<Link
						to={`/p/${project.id}`}
						aria-label={project.name}
						draggable={false}
						className="absolute inset-0 rounded-card"
					/>
					<span className="bidi pointer-events-none line-clamp-3 pr-8 text-[24px] font-medium">
						{project.name}
					</span>
				</>
			)}

			<div className="pointer-events-none flex items-end justify-between">
				<span className="text-sm text-muted">
					{failed
						? "Could not save."
						: project.noteCount === 1
							? "1 note"
							: `${project.noteCount} notes`}
				</span>
			</div>

			{/* Chrome, so it stays top right whatever direction the name runs in. */}
			<button
				ref={menuButton}
				type="button"
				aria-label={`Actions for ${project.name}`}
				aria-expanded={mode === "menu"}
				onClick={() => setMode(mode === "menu" ? "view" : "menu")}
				className="absolute top-2 right-2 z-10 rounded-card px-2 py-1 text-muted opacity-0 hover:bg-surface-hover hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
			>
				⋯
			</button>

			{mode === "menu" && (
				<div
					role="menu"
					className="absolute top-9 right-2 z-20 w-36 overflow-hidden rounded-card border border-border bg-surface shadow-raised"
				>
					<MenuItem onClick={() => setMode("renaming")}>Rename</MenuItem>
					<MenuItem onClick={() => setMode("colouring")}>Colour</MenuItem>
					<MenuItem onClick={() => void archive()}>Archive</MenuItem>
				</div>
			)}

			{mode === "colouring" && (
				<div
					role="menu"
					aria-label="Project colour"
					className="absolute top-9 right-2 z-20 flex gap-2 rounded-card border border-border bg-surface p-2 shadow-raised"
				>
					{COLORS.map((colour) => (
						<button
							key={colour.label}
							type="button"
							role="menuitem"
							aria-label={colour.label}
							onClick={() => void save({ color: colour.value })}
							style={
								colour.value !== null ? { backgroundColor: colour.value } : undefined
							}
							className={`size-5 rounded-pill border ${
								colour.value === null
									? "border-border bg-transparent"
									: "border-transparent"
							}`}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function MenuItem({
	onClick,
	children,
}: {
	onClick: () => void;
	children: string;
}) {
	return (
		<button
			type="button"
			role="menuitem"
			onClick={onClick}
			className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface-hover"
		>
			{children}
		</button>
	);
}
