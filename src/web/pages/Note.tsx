/* One note, on its own page.
 *
 * The editor is the source of truth while it is open: what you type is what is
 * on screen, and the server is told about it after typing settles. Nothing the
 * server answers is ever written back into the fields, so an older save can
 * never overwrite newer text. Saves go out one at a time and flush on blur, on
 * the way back, and when the tab is closed.
 *
 * Images arrive at plan step 5.3. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { Note as NoteType, Project, UpdateNoteBody } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { onSessionExpired, takeParkedDraft } from "../platform/session";
import { NoteSaver, draftKey, type SaveStatus } from "../lib/autosave";
import { useApi } from "../lib/useApi";
import { TopBar } from "../components/TopBar";
import { AutoGrowTextarea } from "../components/AutoGrowTextarea";
import { Menu } from "../components/Menu";
import { Skeleton, Toast } from "../components/Feedback";

export function Note() {
	const { id } = useParams<{ id: string }>();
	const note = useApi<NoteType>(id === undefined ? null : `/api/notes/${id}`);

	if (note.loading) {
		return (
			<>
				<TopBar backTo="/" title="" />
				<main className="mx-auto max-w-2xl px-4 py-6">
					<Skeleton lines={5} />
				</main>
			</>
		);
	}

	if (note.data === null || id === undefined) {
		return (
			<>
				<TopBar backTo="/" title="Rogers" />
				<main className="mx-auto max-w-2xl px-4 py-8">
					<p className="text-muted">That note is not here any more.</p>
				</main>
				<Toast message={note.error} />
			</>
		);
	}

	/* Keyed by id so a different note gets a fresh editor, never leftover state. */
	return <Editor key={id} note={note.data} />;
}

function Editor({ note }: { note: NoteType }) {
	const navigate = useNavigate();

	/* The project name for the bar, and the address the back arrow goes to.
	   Deliberately not browser history: a note opened from a link has none. */
	const projects = useApi<Project[]>("/api/projects");
	const project = projects.data?.find((p) => p.id === note.projectId) ?? null;
	const backTo = `/p/${note.projectId}`;

	const [title, setTitle] = useState(note.title);
	const [body, setBody] = useState(note.body);
	const [pinned, setPinned] = useState(note.pinnedAt !== null);
	const [status, setStatus] = useState<SaveStatus>("idle");

	const saver = useRef<NoteSaver | null>(null);
	const latest = useRef({ title: note.title, body: note.body });

	function change(patch: UpdateNoteBody) {
		if (patch.title !== undefined) {
			latest.current.title = patch.title;
			setTitle(patch.title);
		}
		if (patch.body !== undefined) {
			latest.current.body = patch.body;
			setBody(patch.body);
		}
		if (patch.pinned !== undefined) setPinned(patch.pinned);
		saver.current?.queue(patch);
	}

	const flush = useCallback(() => saver.current?.flush(), []);

	/* Pinning is a decision, not typing: it goes out at once. */
	function togglePin() {
		change({ pinned: !pinned });
		void flush();
	}

	/* Archive from the menu: nothing to save any more, put it away and leave. */
	async function archive() {
		saver.current?.dispose();
		try {
			await apiFetch<NoteType>(`/api/notes/${note.id}`, { method: "DELETE" });
		} catch {
			/* It stays; the list will still show it, which is the honest state. */
		}
		void navigate(backTo);
	}

	/* Escape leaves the way the back arrow does, saving first. Only when the
	   focus is not inside a menu, which handles its own Escape. */
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") void goBack();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	});

	/* Back: save first, discard an empty note, then go. */
	async function goBack() {
		await flush();
		const empty =
			latest.current.title.trim() === "" && latest.current.body.trim() === "";
		if (empty) {
			try {
				await apiFetch<NoteType>(`/api/notes/${note.id}`, { method: "DELETE" });
			} catch {
				/* An empty note left behind is invisible; nothing is lost. */
			}
		}
		void navigate(backTo);
	}

	/* The saver lives exactly as long as the mounted editor. It is created here
	   rather than during render because React's development mode runs this
	   effect, its cleanup, and then the effect again; a saver created outside
	   it would be disposed by that first cleanup and never send anything.

	   Text parked by an earlier failed flush or an expired login is restored
	   here too. It is newer than the server's copy by definition, so it goes
	   into the fields and is queued so it gets saved this time.

	   The tab closing and the login expiring are the two ways out that give no
	   chance to click anything; pagehide flushes with keepalive, and an expiring
	   session parks the text for the reload. */
	useEffect(() => {
		const current = new NoteSaver(note.id, setStatus);
		saver.current = current;

		const parked = takeParkedDraft(draftKey(note.id));
		if (parked !== null) {
			try {
				const patch = JSON.parse(parked) as UpdateNoteBody;
				if (patch.title !== undefined) {
					latest.current.title = patch.title;
					setTitle(patch.title);
				}
				if (patch.body !== undefined) {
					latest.current.body = patch.body;
					setBody(patch.body);
				}
				if (patch.pinned !== undefined) setPinned(patch.pinned);
				current.queue(patch);
			} catch {
				/* Unreadable parked text is not restorable; the server copy stands. */
			}
		}

		const onHide = () => void current.flush();
		window.addEventListener("pagehide", onHide);
		const release = onSessionExpired(() => current.park());
		return () => {
			window.removeEventListener("pagehide", onHide);
			release();
			current.dispose();
			if (saver.current === current) saver.current = null;
		};
	}, [note.id]);

	return (
		<>
			<TopBar
				backTo={backTo}
				onBack={() => void goBack()}
				title={project?.name ?? ""}
				trailing={
					<div className="flex items-center gap-2">
						<span className="text-sm text-faint" aria-live="polite">
							{status === "saving" && "Saving"}
							{status === "saved" && "Saved"}
							{status === "error" && (
								<span className="text-danger">Could not save</span>
							)}
						</span>
						<button
							type="button"
							aria-label={pinned ? "Unpin" : "Pin"}
							aria-pressed={pinned}
							onClick={togglePin}
							className={`rounded-card px-2 py-1 hover:bg-surface-hover ${
								pinned ? "text-accent" : "text-muted"
							}`}
						>
							{pinned ? "★" : "☆"}
						</button>
						<Menu
							label="Note actions"
							items={[{ label: "Archive", onSelect: () => void archive(), danger: true }]}
						/>
					</div>
				}
			/>

			<main className="mx-auto max-w-2xl px-4 py-6">
				<input
					value={title}
					dir="auto"
					placeholder="Title"
					aria-label="Title"
					onChange={(event) => change({ title: event.target.value })}
					onBlur={() => void flush()}
					className="bidi mb-3 block w-full bg-transparent text-xl font-medium text-text outline-none placeholder:text-faint"
				/>

				<AutoGrowTextarea
					value={body}
					placeholder="Take a note…"
					aria-label="Note"
					onChange={(event) => change({ body: event.target.value })}
					onBlur={() => void flush()}
					className="min-h-40"
				/>
			</main>
		</>
	);
}
