/* One project tile, and the menu that renames, recolours or puts it away.
 *
 * The tile is a div rather than a link with a button inside it, because a
 * control nested in a link is neither reliably clickable nor announced
 * correctly. The link is an overlay that covers the tile, and the menu opens
 * above it, on the right-click. */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { Project, UpdateProjectBody } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { prefetch } from "../lib/useApi";

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

/** The popups' own widths, `w-36` and the seven swatches, so each stays in the tile. */
const MENU_WIDTH = 144;
const COLOUR_WIDTH = 208;

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
	const root = useRef<HTMLDivElement>(null);

	/* Where the right-click landed, measured from the tile's own corner, plus how
	   wide the tile is so a popup can be kept inside it. Same shape as a note row
	   in the list. */
	const [point, setPoint] = useState<{ x: number; y: number; width: number } | null>(null);

	/* Escape closes whatever is open. A click outside closes the popups too, and
	   only them: there is no button left to toggle the menu shut, and renaming
	   keeps its old ways, so a click elsewhere never discards a half-typed name. */
	useEffect(() => {
		if (mode === "view") return;
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setMode("view");
				setName(project.name);
			}
		}
		function onPointerDown(event: PointerEvent) {
			if (mode === "renaming") return;
			if (root.current !== null && !root.current.contains(event.target as Node)) {
				setMode("view");
			}
		}
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onPointerDown);
		};
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

	/** A popup of this width, at the click, never hanging off the tile's edge. */
	function at(width: number) {
		if (point === null) return undefined;
		return {
			left: Math.max(0, Math.min(point.x, point.width - width)),
			top: point.y,
		};
	}

	/* Hovering or focusing the tile asks for the project's tabs and Main's notes
	   ahead of the click, so the project page opens with its list already there. */
	function warm() {
		prefetch(`/api/projects/${project.id}/tabs`);
		prefetch(`/api/projects/${project.id}/notes`);
	}

	return (
		<div
			ref={root}
			onContextMenu={(event) => {
				/* Not while renaming: that field keeps the browser's own menu, so
				   pasting a name still works. */
				if (mode === "renaming") return;
				event.preventDefault();
				const box = event.currentTarget.getBoundingClientRect();
				setPoint({
					x: event.clientX - box.left,
					y: event.clientY - box.top,
					width: box.width,
				});
				setMode("menu");
			}}
			className="group relative flex aspect-4/3 flex-col justify-between rounded-card bg-card p-6 transition-colors duration-[144ms] ease-out hover:bg-card-hover max-[430px]:aspect-auto max-[430px]:h-[144px]"
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
					{/* The overlay link. It is not draggable, because a link drags its
					    own address by default, and this one covers the tile, so it would
					    win over dragging the tile itself on Home. */}
					<Link
						to={`/p/${project.id}`}
						aria-label={project.name}
						draggable={false}
						onPointerEnter={warm}
						onFocus={warm}
						className="absolute inset-0 rounded-card"
					/>
					<span className="bidi pointer-events-none line-clamp-3 text-[24px] font-medium">
						{project.name}
					</span>
				</>
			)}

			<div className="pointer-events-none flex items-end justify-between">
				<span className="text-sm text-muted">{failed ? "Could not save." : ""}</span>
			</div>

			{mode === "menu" && (
				<div
					role="menu"
					aria-label={`Actions for ${project.name}`}
					style={at(MENU_WIDTH)}
					className="absolute z-20 w-36 overflow-hidden rounded-card border border-border bg-surface shadow-raised"
				>
					<MenuItem first onClick={() => setMode("renaming")}>
						Rename
					</MenuItem>
					<MenuItem onClick={() => setMode("colouring")}>Colour</MenuItem>
					<MenuItem onClick={() => void archive()}>Archive</MenuItem>
				</div>
			)}

			{mode === "colouring" && (
				<div
					role="menu"
					aria-label="Project colour"
					style={at(COLOUR_WIDTH)}
					className="absolute z-20 flex gap-2 rounded-card border border-border bg-surface p-2 shadow-raised"
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
	first = false,
}: {
	onClick: () => void;
	children: string;
	/** The one that takes focus when the menu opens. */
	first?: boolean;
}) {
	return (
		<button
			type="button"
			role="menuitem"
			autoFocus={first}
			onClick={onClick}
			className="block w-full px-3 py-2 text-left text-sm text-text hover:bg-surface-hover"
		>
			{children}
		</button>
	);
}
