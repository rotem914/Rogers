/* The first row of a project: "Take a note…", modelled on Keep.
 *
 * Collapsed it is one line. Clicking it opens title, body, a pin and a Close.
 * A note exists on the server from the first keystroke and is autosaved from
 * then on, so closing the tab mid-sentence loses nothing. Closing the composer
 * with nothing in it discards the draft, which is the only place that knows
 * the difference between an empty note and a note that has not started.
 *
 * The image button in the bar and in the toolbar arrive at plan step 5.4. */

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { CreateNoteBody, Note } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { onSessionExpired } from "../platform/session";
import { NoteSaver, type SaveStatus } from "../lib/autosave";
import { AutoGrowTextarea } from "./AutoGrowTextarea";

/** What the page can ask the composer to do: the N shortcut opens it. */
export type ComposerHandle = { open: () => void };

export function Composer({
	ref,
	projectId,
	onClosed,
}: {
	ref?: Ref<ComposerHandle>;
	projectId: string;
	/** Called after a close that may have changed the list. */
	onClosed: () => void;
}) {
	const [open, setOpen] = useState(false);
	useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [pinned, setPinned] = useState(false);
	const [status, setStatus] = useState<SaveStatus>("idle");

	const root = useRef<HTMLDivElement>(null);
	const bodyField = useRef<HTMLTextAreaElement>(null);

	/* The draft's identity. The id is made here, before anything is sent, so a
	   create that is applied and then lost on the way back is recognised as the
	   same note when it is retried, rather than making a second one. */
	const idRef = useRef<string>(crypto.randomUUID());
	const saverRef = useRef<NoteSaver | null>(null);
	const creatingRef = useRef<Promise<void> | null>(null);
	/* Latest values, readable from inside async work without stale closures. */
	const latest = useRef({ title: "", body: "", pinned: false });

	/* Create the note on the server once, then sync whatever was typed while
	   the request was out. Returns the saver, or null while creation is still
	   in progress or has failed; either way the text is safe in local state. */
	const ensureCreated = useCallback(async (): Promise<NoteSaver | null> => {
		if (saverRef.current !== null) return saverRef.current;
		if (creatingRef.current !== null) {
			await creatingRef.current;
			return saverRef.current;
		}

		const request = (async () => {
			const created: CreateNoteBody = {
				id: idRef.current,
				title: latest.current.title,
				body: latest.current.body,
			};
			await apiFetch<Note>(`/api/projects/${projectId}/notes`, {
				method: "POST",
				body: JSON.stringify(created),
			});
			const saver = new NoteSaver(idRef.current, setStatus);
			saverRef.current = saver;
			/* Everything typed during creation, sent as one patch. */
			saver.queue({
				title: latest.current.title,
				body: latest.current.body,
				...(latest.current.pinned ? { pinned: true } : {}),
			});
		})();

		creatingRef.current = request;
		try {
			await request;
		} catch {
			/* The text stays on screen; the next keystroke retries the create with
			   the same id. */
			setStatus("error");
		} finally {
			creatingRef.current = null;
		}
		return saverRef.current;
	}, [projectId]);

	function change(patch: { title?: string; body?: string; pinned?: boolean }) {
		if (patch.title !== undefined) {
			latest.current.title = patch.title;
			setTitle(patch.title);
		}
		if (patch.body !== undefined) {
			latest.current.body = patch.body;
			setBody(patch.body);
		}
		if (patch.pinned !== undefined) {
			latest.current.pinned = patch.pinned;
			setPinned(patch.pinned);
		}

		const saver = saverRef.current;
		if (saver !== null) {
			saver.queue(patch);
		} else {
			/* First change, or a retry after a failed create. The sync inside
			   ensureCreated picks up this value, so it is not queued twice. */
			void ensureCreated();
		}
	}

	const reset = useCallback(() => {
		saverRef.current?.dispose();
		saverRef.current = null;
		idRef.current = crypto.randomUUID();
		latest.current = { title: "", body: "", pinned: false };
		setTitle("");
		setBody("");
		setPinned(false);
		setStatus("idle");
		setOpen(false);
	}, []);

	/* Close: save what is pending, discard an empty draft, tell the list. */
	const close = useCallback(async () => {
		if (creatingRef.current !== null) await creatingRef.current;
		const saver = saverRef.current;
		if (saver !== null) {
			await saver.flush();
			const empty =
				latest.current.title.trim() === "" && latest.current.body.trim() === "";
			if (empty) {
				try {
					await apiFetch<Note>(`/api/notes/${idRef.current}`, { method: "DELETE" });
				} catch {
					/* An empty draft that could not be discarded is invisible anyway. */
				}
			}
		}
		reset();
		onClosed();
	}, [onClosed, reset]);

	/* Delete from the toolbar: put the draft away and close. */
	const discard = useCallback(async () => {
		if (creatingRef.current !== null) await creatingRef.current;
		if (saverRef.current !== null) {
			try {
				await apiFetch<Note>(`/api/notes/${idRef.current}`, { method: "DELETE" });
			} catch {
				/* Leaving a stray draft behind is recoverable; losing text is not. */
			}
		}
		reset();
		onClosed();
	}, [onClosed, reset]);

	/* Click outside, and Escape, both close. Registered only while open. */
	useEffect(() => {
		if (!open) return;
		function onPointerDown(event: PointerEvent) {
			if (root.current !== null && !root.current.contains(event.target as Node)) {
				void close();
			}
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") void close();
		}
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open, close]);

	/* If the login expires mid-sentence, park the text before the reload. */
	useEffect(() => onSessionExpired(() => saverRef.current?.park()), []);

	/* Opening puts the caret in the body, the way Keep does. */
	useEffect(() => {
		if (open) bodyField.current?.focus();
	}, [open]);

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="block w-full rounded-card border border-border bg-surface px-4 py-3 text-left text-muted shadow-raised hover:bg-surface-hover"
			>
				Take a note…
			</button>
		);
	}

	return (
		<div
			ref={root}
			className="rounded-card border border-border bg-surface shadow-raised"
		>
			<div className="flex items-start gap-2 px-4 pt-3">
				<input
					value={title}
					dir="auto"
					placeholder="Title"
					aria-label="Title"
					onChange={(event) => change({ title: event.target.value })}
					className="bidi min-w-0 flex-1 bg-transparent font-medium text-text outline-none placeholder:text-faint"
				/>
				<button
					type="button"
					aria-label={pinned ? "Unpin" : "Pin"}
					aria-pressed={pinned}
					onClick={() => change({ pinned: !pinned })}
					className={`rounded-card px-2 py-1 hover:bg-surface-hover ${
						pinned ? "text-accent" : "text-muted"
					}`}
				>
					{pinned ? "★" : "☆"}
				</button>
			</div>

			<div className="px-4 py-2">
				<AutoGrowTextarea
					ref={bodyField}
					value={body}
					placeholder="Take a note…"
					aria-label="Note"
					onChange={(event) => change({ body: event.target.value })}
				/>
			</div>

			<div className="flex items-center justify-between px-2 pb-2">
				<div className="flex items-center gap-1">
					<button
						type="button"
						aria-label="Delete"
						onClick={() => void discard()}
						className="rounded-card px-2 py-1 text-muted hover:bg-surface-hover hover:text-danger"
					>
						🗑
					</button>
					<span className="px-1 text-sm text-faint">
						{status === "saving" && "Saving"}
						{status === "saved" && "Saved"}
						{status === "error" && <span className="text-danger">Could not save</span>}
					</span>
				</div>
				<button
					type="button"
					onClick={() => void close()}
					className="rounded-card px-3 py-1 text-sm font-medium text-text hover:bg-surface-hover"
				>
					Close
				</button>
			</div>
		</div>
	);
}
