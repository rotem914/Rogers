/* The tabs above a project's list, and the button that makes one.
 *
 * A project starts with no tabs and only the plus. The first click turns the
 * project's own list into a tab called Main and puts "New tab" beside it, with
 * an empty list of its own. Main is never a row on the server and cannot be
 * removed or renamed; removing the last other tab takes the strip away again.
 *
 * Each tab is a link to its own address, so a reload and the back arrow from a
 * note both land on the tab that was open. The open tab's name is a button
 * instead: clicking it turns the name into a field, the same move as the
 * project name in the bar. The remove button sits beside the name, not inside
 * it: a control nested in a link is neither reliably clickable nor announced
 * properly. */

import { useState } from "react";
import { Link } from "react-router";
import type { Tab } from "../../shared/types";

export function TabStrip({
	projectId,
	tabs,
	activeId,
	onAdd,
	onRename,
	onRemove,
}: {
	projectId: string;
	tabs: Tab[];
	/** The open tab, or null for Main. */
	activeId: string | null;
	onAdd: () => void;
	/** Rejects when the name could not be saved, so the field can say so. */
	onRename: (id: string, name: string) => Promise<void>;
	onRemove: (id: string) => void;
}) {
	return (
		<div className="mb-3 flex flex-wrap items-center gap-1">
			{tabs.length > 0 && (
				<>
					<TabChip name="Main" to={`/p/${projectId}`} active={activeId === null} />
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

			<button
				type="button"
				aria-label="Add tab"
				onClick={onAdd}
				className="flex size-8 shrink-0 items-center justify-center rounded-card text-muted hover:bg-surface-hover hover:text-text"
			>
				<svg
					viewBox="0 0 24 24"
					aria-hidden="true"
					className="size-4"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
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
	/** Left out on Main, which cannot be renamed. */
	onRename?: (name: string) => Promise<void>;
	/** Left out on Main, which cannot be removed. */
	onRemove?: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(name);
	const [failed, setFailed] = useState(false);

	const nameClass = `bidi flex h-8 items-center truncate text-sm font-medium ${
		onRemove === undefined ? "px-3" : "pr-1 pl-3"
	}`;

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
			className={`flex h-8 items-center rounded-card ${
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
					className={`bidi h-8 bg-transparent pl-3 text-sm font-medium outline-none ${
						onRemove === undefined ? "pr-3" : "pr-1"
					} ${failed ? "text-danger" : "text-text"}`}
				/>
			) : active && onRename !== undefined ? (
				<button
					type="button"
					aria-label={`Rename ${name}`}
					aria-current="page"
					onClick={startEditing}
					className={nameClass}
				>
					{name}
				</button>
			) : (
				<Link to={to} aria-current={active ? "page" : undefined} className={nameClass}>
					{name}
				</Link>
			)}
			{onRemove !== undefined && (
				<button
					type="button"
					aria-label={`Remove ${name}`}
					onClick={onRemove}
					className="flex size-8 shrink-0 items-center justify-center rounded-card text-muted hover:text-text"
				>
					<svg
						viewBox="0 0 24 24"
						aria-hidden="true"
						className="size-4"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			)}
		</div>
	);
}
