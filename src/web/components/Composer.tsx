/* The first row of a project: "Take a note…", modelled on Keep.
 *
 * Collapsed it is one line. Clicking it opens title, body, a pin and a Close.
 * A note exists on the server from the first keystroke and is autosaved from
 * then on, so closing the tab mid-sentence loses nothing. Closing the composer
 * with nothing in it discards the draft, which is the only place that knows
 * the difference between an empty note and a note that has not started.
 *
 * Pictures come in by paste, by drop, or through the image button, and are
 * uploaded at once; the note keeps their keys. */

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { CreateNoteBody, Note } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { onSessionExpired } from "../platform/session";
import { NoteSaver, type SaveStatus } from "../lib/autosave";
import { UndoStack, undoShortcut } from "../lib/undo";
import { ACCEPT_ATTRIBUTE, imageFiles, uploadImage } from "../lib/upload";
import { AutoGrowTextarea } from "./AutoGrowTextarea";
import { ImageStrip } from "./ImageStrip";

/** What the page can ask the composer to do: the N shortcut opens it. */
export type ComposerHandle = { open: () => void };

export function Composer({
	ref,
	projectId,
	tabId,
	onClosed,
}: {
	ref?: Ref<ComposerHandle>;
	projectId: string;
	/** The tab the list on screen is, so a new note lands in it. Null is Main. */
	tabId: string | null;
	/** Called after a close that may have changed the list. */
	onClosed: () => void;
}) {
	const [open, setOpen] = useState(false);
	useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [pinned, setPinned] = useState(false);
	const [images, setImages] = useState<string[]>([]);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [uploading, setUploading] = useState(0);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);

	const root = useRef<HTMLDivElement>(null);
	const titleField = useRef<HTMLInputElement>(null);
	const picker = useRef<HTMLInputElement>(null);

	/* The draft's identity. The id is made here, before anything is sent, so a
	   create that is applied and then lost on the way back is recognised as the
	   same note when it is retried, rather than making a second one. */
	const idRef = useRef<string>(crypto.randomUUID());
	const saverRef = useRef<NoteSaver | null>(null);
	const creatingRef = useRef<Promise<void> | null>(null);
	/* Latest values, readable from inside async work without stale closures. */
	const latest = useRef({ title: "", body: "", pinned: false, images: [] as string[] });
	const [undo] = useState(() => new UndoStack({ title: "", body: "", images: [] }));

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
				...(tabId !== null ? { tabId } : {}),
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
				...(latest.current.images.length > 0 ? { images: latest.current.images } : {}),
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
	}, [projectId, tabId]);

	/* `record` is off when the patch comes from the undo stack itself. */
	function change(
		patch: { title?: string; body?: string; pinned?: boolean; images?: string[] },
		record = true,
	) {
		if (patch.images !== undefined) {
			latest.current.images = patch.images;
			setImages(patch.images);
		}
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
		if (record && (patch.title ?? patch.body ?? patch.images) !== undefined) {
			const { title, body, images } = latest.current;
			undo.record(
				{ title, body, images },
				patch.title !== undefined ? "title" : patch.body !== undefined ? "body" : undefined,
			);
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

	/* Undo or redo: only the fields that differ go on screen and out to save. */
	function travel(step: "undo" | "redo") {
		const snapshot = step === "undo" ? undo.undo() : undo.redo();
		if (snapshot === null) return;
		const patch: { title?: string; body?: string; images?: string[] } = {};
		if (snapshot.title !== latest.current.title) patch.title = snapshot.title;
		if (snapshot.body !== latest.current.body) patch.body = snapshot.body;
		if (snapshot.images !== latest.current.images) patch.images = snapshot.images;
		change(patch, false);
	}

	/* Pictures: upload each, append its key, and save through the same path as
	   typing. The picker, a paste and a drop all end up here. */
	async function addFiles(files: File[]) {
		if (files.length === 0) return;
		setOpen(true);
		setUploadError(null);
		for (const file of files) {
			setUploading((n) => n + 1);
			try {
				const key = await uploadImage(file);
				change({ images: [...latest.current.images, key] });
			} catch (cause) {
				setUploadError(cause instanceof Error ? cause.message : "Could not add the image.");
			} finally {
				setUploading((n) => n - 1);
			}
		}
	}

	const reset = useCallback(() => {
		saverRef.current?.dispose();
		saverRef.current = null;
		idRef.current = crypto.randomUUID();
		latest.current = { title: "", body: "", pinned: false, images: [] };
		undo.reset({ title: "", body: "", images: [] });
		setTitle("");
		setBody("");
		setPinned(false);
		setImages([]);
		setUploadError(null);
		setDragging(false);
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
				latest.current.title.trim() === "" &&
				latest.current.body.trim() === "" &&
				latest.current.images.length === 0;
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
			const step = undoShortcut(event);
			if (step !== null) {
				event.preventDefault();
				travel(step);
			}
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

	/* Opening puts the caret in the title. */
	useEffect(() => {
		if (open) titleField.current?.focus();
	}, [open]);

	/* The hidden file input behind both image buttons. */
	const fileInput = (
		<input
			ref={picker}
			type="file"
			accept={ACCEPT_ATTRIBUTE}
			multiple
			hidden
			onChange={(event) => {
				void addFiles([...(event.target.files ?? [])]);
				event.target.value = "";
			}}
		/>
	);

	if (!open) {
		return (
			<div className="flex items-center rounded-[10px] bg-card shadow-raised">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="min-w-0 flex-1 rounded-[10px] px-4 py-3 text-left text-lg text-muted transition-colors duration-[144ms] ease-out hover:bg-card-hover"
				>
					Take a note…
				</button>
				{fileInput}
			</div>
		);
	}

	return (
		<div
			ref={root}
			onPaste={(event) => {
				const files = imageFiles(event.clipboardData);
				if (files.length > 0) {
					event.preventDefault();
					void addFiles(files);
				}
			}}
			onDragOver={(event) => {
				if (event.dataTransfer.types.includes("Files")) {
					event.preventDefault();
					setDragging(true);
				}
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={(event) => {
				event.preventDefault();
				setDragging(false);
				void addFiles(imageFiles(event.dataTransfer));
			}}
			className={`rounded-[10px] border bg-surface shadow-raised ${
				dragging ? "border-accent" : "border-border"
			}`}
		>
			<div className="flex items-start gap-2 px-4 pt-3">
				<input
					ref={titleField}
					value={title}
					dir="auto"
					placeholder="Title"
					aria-label="Title"
					onChange={(event) => change({ title: event.target.value })}
					onKeyDown={(event) => {
						/* Enter in the title finishes the note, the same as clicking away. */
						if (event.key === "Enter") {
							event.preventDefault();
							void close();
						}
					}}
					className="bidi min-w-0 flex-1 bg-transparent text-lg font-medium text-text outline-none placeholder:text-faint"
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
					value={body}
					placeholder="Take a note…"
					aria-label="Note"
					className="text-lg"
					onChange={(event) => change({ body: event.target.value })}
				/>
				{images.length > 0 && (
					<div className="mt-3">
						<ImageStrip
							keys={images}
							onRemove={(key) => change({ images: images.filter((k) => k !== key) })}
						/>
					</div>
				)}
			</div>

			<div className="flex items-center justify-between px-2 pb-2">
				<div className="flex items-center gap-1">
					<button
						type="button"
						aria-label="Add image"
						onClick={() => picker.current?.click()}
						className="rounded-card px-2 py-1 text-muted hover:bg-surface-hover hover:text-text"
					>
						🖼
					</button>
					{fileInput}
					<span className="px-1 text-sm text-faint">
						{uploadError !== null ? (
							<span className="text-danger">{uploadError}</span>
						) : uploading > 0 ? (
							"Uploading"
						) : (
							<>
								{status === "saving" && "Saving"}
								{status === "saved" && "Saved"}
								{status === "error" && <span className="text-danger">Could not save</span>}
							</>
						)}
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
