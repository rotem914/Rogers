/* One project: the composer on top, then its notes, pinned first.
 *
 * The sections are the whole Keep behaviour: PINNED above OTHERS, with the
 * headers only when something is pinned. The order inside each comes from the
 * Worker; this file splits the two and lets each one be dragged into a new
 * order of its own. */

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useParams, useSearchParams } from "react-router";
import type {
	CreateTabBody,
	NotePreview,
	Project as ProjectType,
	ReorderNotesBody,
	Tab,
	UpdateProjectBody,
	UpdateTabBody,
} from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { prefetch, useApi } from "../lib/useApi";
import { arrange, moved } from "../lib/reorder";
import { TabHistory, undoShortcut } from "../lib/undo";
import { TopBar } from "../components/TopBar";
import { NoteRow } from "../components/NoteRow";
import { Composer, type ComposerHandle } from "../components/Composer";
import { TabStrip } from "../components/TabStrip";
import { Toast } from "../components/Feedback";

export function Project() {
	const { id } = useParams<{ id: string }>();

	/* There is no endpoint for one project, so the name comes from the list.
	   It is a small payload, and it also answers the question a direct link
	   raises: a project that is not in the list is either gone or archived. */
	const projects = useApi<ProjectType[]>("/api/projects", { remember: true });
	const project = projects.data?.find((candidate) => candidate.id === id) ?? null;

	/* The tabs, and which one the address names. None means Main, the project's
	   own list. A tab the address names but the list does not have is Main too:
	   it was removed, or the link is stale. */
	const tabs = useApi<Tab[]>(id === undefined ? null : `/api/projects/${id}/tabs`, {
		remember: true,
	});
	const [searchParams, setSearchParams] = useSearchParams();
	const requestedTab = searchParams.get("tab");
	const tabId = tabs.data?.find((tab) => tab.id === requestedTab)?.id ?? null;

	/* When the address names a tab, the notes wait for the first answer about
	   the tabs, so that address never shows Main's notes for a frame first. An
	   address that names none is Main whatever the tabs say, so its notes are
	   asked for at once, beside the tabs instead of after them. A refetch of the
	   tabs keeps the old list, so it does not blank the notes; a failed tabs
	   call falls through to Main. */
	const tabsPending = requestedTab !== null && tabs.data === null && tabs.error === null;
	const notes = useApi<NotePreview[]>(
		id === undefined || tabsPending
			? null
			: `/api/projects/${id}/notes${tabId === null ? "" : `?tab=${tabId}`}`,
		{ remember: true },
	);

	const composer = useRef<ComposerHandle>(null);
	const [orderFailed, setOrderFailed] = useState(false);
	const [tabFailed, setTabFailed] = useState<string | null>(null);

	/* Which list is on screen. The read hook keeps the old list while a new
	   address loads, which is right for a refetch of the same tab and wrong for
	   a switch: the last tab's notes would sit under the new tab's name until
	   the answer came. So the list a switch started from is remembered and
	   hidden until a fresh answer replaces it. Set during render on purpose:
	   an effect runs after the commit that changed the tab, too late to hide
	   anything. A failed answer keeps the old list hidden and shows the toast. */
	const [left, setLeft] = useState<{ tab: string | null; list: NotePreview[] | null }>({
		tab: tabId,
		list: null,
	});
	if (left.tab !== tabId) setLeft({ tab: tabId, list: notes.data });
	const shown = notes.data === left.list ? null : notes.data;

	/* The other tabs' lists are fetched as soon as the tabs are known, so the
	   first switch to any of them paints at once. A list already remembered is
	   not asked for again; the switch itself refreshes it. */
	useEffect(() => {
		if (id === undefined || tabs.data === null) return;
		if (tabId !== null) prefetch(`/api/projects/${id}/notes`);
		for (const tab of tabs.data) {
			if (tab.id !== tabId) prefetch(`/api/projects/${id}/notes?tab=${tab.id}`);
		}
	}, [id, tabs.data, tabId]);

	/* A tab just made is opened only once the refetched list knows it, so the
	   address never names a tab the page cannot yet show. */
	const pendingTab = useRef<string | null>(null);
	useEffect(() => {
		const pending = pendingTab.current;
		if (pending !== null && tabs.data?.some((tab) => tab.id === pending)) {
			pendingTab.current = null;
			setSearchParams({ tab: pending });
		}
	}, [tabs.data, setSearchParams]);

	/* Adding, renaming and removing a tab, each recorded so Ctrl+Z can take it
	   back. They live up here, above the early returns below, because the undo
	   listener is registered up here too and must never reach for something the
	   loading render never created. */
	const [tabHistory] = useState(() => new TabHistory());

	async function archiveTab(target: string) {
		await apiFetch<Tab>(`/api/projects/${id}/tabs/${target}`, { method: "DELETE" });
	}

	/* The Worker has no "unremove": a removed tab is restored by clearing the
	   timestamp that removed it, which brings back every note that was in it,
	   because removing never rewrote one. */
	async function restoreTab(target: string) {
		const body: UpdateTabBody = { archived: false };
		await apiFetch<Tab>(`/api/projects/${id}/tabs/${target}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		});
	}

	async function setTabName(target: string, name: string) {
		const body: UpdateTabBody = { name };
		await apiFetch<Tab>(`/api/projects/${id}/tabs/${target}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		});
	}

	/* The first tab has no row of its own, so its name is a field on the
	   project. Everything else about it stays what it has always been: the
	   notes that are in no live tab. */
	async function setMainName(name: string) {
		const body: UpdateProjectBody = { mainTabName: name };
		await apiFetch<ProjectType>(`/api/projects/${id}`, {
			method: "PATCH",
			body: JSON.stringify(body),
		});
	}

	/** What the first tab is called right now. */
	const mainName = project?.mainTabName ?? "Main";

	/* Adding turns the project's own list into "Main" and opens the new tab
	   beside it. The id is made here, like a note's, so a request applied and
	   then lost on the way back is the same tab when it is retried. */
	async function addTab() {
		const body: CreateTabBody = { id: crypto.randomUUID() };
		setTabFailed(null);
		try {
			const tab = await apiFetch<Tab>(`/api/projects/${id}/tabs`, {
				method: "POST",
				body: JSON.stringify(body),
			});
			tabHistory.record({ kind: "add", id: tab.id });
			pendingTab.current = tab.id;
			tabs.refetch();
		} catch {
			setTabFailed("Could not add the tab.");
		}
	}

	/* Renaming: the chip owns the field, this sends the name and refreshes the
	   strip. It throws on failure so the field can say so where it sits. */
	async function renameTab(renamedId: string | null, name: string) {
		const from =
			renamedId === null
				? mainName
				: tabs.data?.find((tab) => tab.id === renamedId)?.name;
		if (renamedId === null) await setMainName(name);
		else await setTabName(renamedId, name);
		if (from !== undefined) {
			tabHistory.record({ kind: "rename", id: renamedId, from, to: name });
		}
		if (renamedId === null) projects.refetch();
		else tabs.refetch();
	}

	/* Removing archives the tab; its notes show in Main from then on. */
	async function removeTab(removedId: string) {
		setTabFailed(null);
		try {
			await archiveTab(removedId);
		} catch {
			setTabFailed("Could not remove the tab.");
			return;
		}
		tabHistory.record({ kind: "remove", id: removedId });
		tabs.refetch();
		/* The removed tab was the open one: back to Main, and the new address is
		   what refetches the list. Otherwise Main may have gained its notes. */
		if (removedId === tabId) setSearchParams({}, { replace: true });
		else notes.refetch();
	}

	/* One step back, or forward. Each action has exactly one opposite, and the
	   step leaves the history only once the Worker agreed, so a failed undo can
	   simply be pressed again. */
	async function travelTabs(step: "undo" | "redo") {
		const action = step === "undo" ? tabHistory.nextUndo() : tabHistory.nextRedo();
		if (action === null) return;
		setTabFailed(null);

		/* Taking back an add removes, and taking back a remove restores; redo is
		   the same pair the other way round. */
		const removing = action.kind !== "rename" && (action.kind === "add") === (step === "undo");

		try {
			if (action.kind === "rename") {
				const name = step === "undo" ? action.from : action.to;
				if (action.id === null) await setMainName(name);
				else await setTabName(action.id, name);
			} else if (removing) {
				await archiveTab(action.id);
			} else {
				await restoreTab(action.id);
			}
		} catch {
			setTabFailed(step === "undo" ? "Could not undo that." : "Could not redo that.");
			return;
		}

		if (step === "undo") tabHistory.commitUndo();
		else tabHistory.commitRedo();

		if (action.kind === "rename" && action.id === null) projects.refetch();
		else tabs.refetch();
		/* A tab that just went away cannot stay the open one. */
		if (removing && action.id === tabId) setSearchParams({}, { replace: true });
		else notes.refetch();
	}

	/* Ctrl+Z and Ctrl+Shift+Z step through the tab actions, but only when the
	   keystroke belongs to the page itself: a field carries its own undo, and
	   the composer keeps its own stack while it is open. */
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			const step = undoShortcut(event);
			if (step === null || id === undefined) return;
			const target = event.target as HTMLElement | null;
			const typing =
				target !== null &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.isContentEditable);
			if (typing) return;
			event.preventDefault();
			void travelTabs(step);
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	});

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

	const pinned = shown?.filter((note) => note.pinnedAt !== null) ?? [];
	const others = shown?.filter((note) => note.pinnedAt === null) ?? [];
	const sectioned = pinned.length > 0;


	return (
		<>
			<TopBar
				backTo="/"
				title={<ProjectName project={project} onRenamed={projects.refetch} />}
				center={
					<TabStrip
						projectId={project.id}
						mainName={mainName}
						tabs={tabs.data ?? []}
						activeId={tabId}
						onAdd={() => void addTab()}
						onRename={renameTab}
						onRemove={(removedId) => void removeTab(removedId)}
					/>
				}
			/>

			<main className="mx-auto max-w-[752px] px-4 pt-14 pb-6">
				<div className="mb-6">
					<Composer
						ref={composer}
						projectId={project.id}
						tabId={tabId}
						onClosed={notes.refetch}
					/>
				</div>

				{sectioned && (
					<Section
						label="Pinned"
						projectId={project.id}
						tabId={tabId}
						notes={pinned}
						onChanged={notes.refetch}
						onOrderFailed={setOrderFailed}
					/>
				)}
				<Section
					label={sectioned ? "Others" : null}
					projectId={project.id}
					tabId={tabId}
					notes={others}
					onChanged={notes.refetch}
					onOrderFailed={setOrderFailed}
				/>

				{!notes.loading && shown?.length === 0 && (
					<p className="text-faint">
						{tabId === null
							? "Nothing in this project yet. Start typing above."
							: "Nothing in this tab yet. Start typing above."}
					</p>
				)}
			</main>

			<Toast
				message={
					notes.error !== null
						? `Could not load the notes. ${notes.error}`
						: tabs.error !== null
							? `Could not load the tabs. ${tabs.error}`
							: tabFailed !== null
								? tabFailed
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
	tabId,
	notes,
	onChanged,
	onOrderFailed,
}: {
	label: string | null;
	projectId: string;
	/** The tab this list is, or null for Main; the saved order answers with it. */
	tabId: string | null;
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
			const scope = tabId === null ? "" : `?tab=${tabId}`;
			await apiFetch<NotePreview[]>(`/api/projects/${projectId}/notes/order${scope}`, {
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
