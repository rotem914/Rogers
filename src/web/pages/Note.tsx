/* One note, on its own page.
 *
 * The editor is the source of truth while it is open: what you type is what is
 * on screen, and the server is told about it after typing settles. Nothing the
 * server answers is ever written back into the fields, so an older save can
 * never overwrite newer text. Saves go out one at a time and flush on blur, on
 * the way back, and when the tab is closed.
 *
 * Pictures come in by paste, by drop, or through the image button. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { Note as NoteType, UpdateNoteBody } from "../../shared/types";
import { apiFetch } from "../platform/api-client";
import { onSessionExpired, takeParkedDraft } from "../platform/session";
import { NoteSaver, draftKey, type SaveStatus } from "../lib/autosave";
import { UndoStack, undoShortcut } from "../lib/undo";
import { useApi } from "../lib/useApi";
import { TopBar } from "../components/TopBar";
import { AutoGrowTextarea } from "../components/AutoGrowTextarea";
import { ImageStrip } from "../components/ImageStrip";
import { ACCEPT_ATTRIBUTE, imageFiles, uploadImage } from "../lib/upload";
import { Menu } from "../components/Menu";
import { Toast } from "../components/Feedback";

export function Note() {
	const { id } = useParams<{ id: string }>();
	const note = useApi<NoteType>(id === undefined ? null : `/api/notes/${id}`);

	if (note.loading) {
		return (
			<>
				<TopBar backTo="/" title="" />
				<main className="mx-auto max-w-2xl px-4 py-6" />
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

	/* Where the back arrow goes. Deliberately not browser history: a note opened
	   from a link has none. */
	const backTo = `/p/${note.projectId}`;

	const [title, setTitle] = useState(note.title);
	const [body, setBody] = useState(note.body);
	const [pinned, setPinned] = useState(note.pinnedAt !== null);
	const [images, setImages] = useState<string[]>(note.images);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [uploading, setUploading] = useState(0);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);

	const saver = useRef<NoteSaver | null>(null);
	const picker = useRef<HTMLInputElement>(null);
	const latest = useRef({ title: note.title, body: note.body, images: note.images });
	const [undo] = useState(
		() => new UndoStack({ title: note.title, body: note.body, images: note.images }),
	);

	/* `record` is off when the patch comes from the undo stack itself. */
	function change(patch: UpdateNoteBody, record = true) {
		if (patch.title !== undefined) {
			latest.current.title = patch.title;
			setTitle(patch.title);
		}
		if (patch.body !== undefined) {
			latest.current.body = patch.body;
			setBody(patch.body);
		}
		if (patch.pinned !== undefined) setPinned(patch.pinned);
		if (patch.images !== undefined) {
			latest.current.images = patch.images;
			setImages(patch.images);
		}
		if (record && (patch.title ?? patch.body ?? patch.images) !== undefined) {
			undo.record(
				{ ...latest.current },
				patch.title !== undefined ? "title" : patch.body !== undefined ? "body" : undefined,
			);
		}
		saver.current?.queue(patch);
	}

	/* Undo or redo: only the fields that differ go on screen and out to save. */
	function travel(step: "undo" | "redo") {
		const snapshot = step === "undo" ? undo.undo() : undo.redo();
		if (snapshot === null) return;
		const patch: UpdateNoteBody = {};
		if (snapshot.title !== latest.current.title) patch.title = snapshot.title;
		if (snapshot.body !== latest.current.body) patch.body = snapshot.body;
		if (snapshot.images !== latest.current.images) patch.images = snapshot.images;
		change(patch, false);
	}

	/* Pictures: upload each, append its key, save through the same path as typing. */
	async function addFiles(files: File[]) {
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
	   focus is not inside a menu, which handles its own Escape. Ctrl+Z and
	   Ctrl+Shift+Z step through the note's own undo stack, which covers the
	   pictures too, instead of the browser's per-field one. */
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") void goBack();
			const step = undoShortcut(event);
			if (step !== null) {
				event.preventDefault();
				travel(step);
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	});

	/* Back: save first, discard an empty note, then go. */
	async function goBack() {
		await flush();
		const empty =
			latest.current.title.trim() === "" &&
			latest.current.body.trim() === "" &&
			latest.current.images.length === 0;
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
				if (patch.images !== undefined) {
					latest.current.images = patch.images;
					setImages(patch.images);
				}
				current.queue(patch);
				/* What was parked is the note's real starting point, not a step back. */
				undo.reset({ ...latest.current });
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
				title=""
				trailing={
					<div className="flex items-center gap-2">
						<span className="text-sm text-faint" aria-live="polite">
							{uploadError !== null ? (
								<span className="text-danger">{uploadError}</span>
							) : uploading > 0 ? (
								"Uploading"
							) : (
								<>
									{status === "saving" && "Saving"}
									{status === "saved" && "Saved"}
									{status === "error" && (
										<span className="text-danger">Could not save</span>
									)}
								</>
							)}
						</span>
						<button
							type="button"
							aria-label="Add image"
							onClick={() => picker.current?.click()}
							className="rounded-card px-2 py-1 text-muted hover:bg-surface-hover hover:text-text"
						>
							🖼
						</button>
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

			<main
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
				className={`mx-auto max-w-[1160px] rounded-card border px-4 pt-12 pb-6 ${
					dragging ? "border-accent" : "border-transparent"
				}`}
			>
				{/* The text reads in a narrow column; the pictures keep the full width. */}
				<div className="mx-auto w-full max-w-[720px]">
					<input
						value={title}
						dir="auto"
						placeholder="Title"
						aria-label="Title"
						onChange={(event) => change({ title: event.target.value })}
						onBlur={() => void flush()}
						className="bidi mb-8 block w-full bg-transparent text-[32px] font-medium text-text outline-none placeholder:text-faint"
					/>

					<AutoGrowTextarea
						value={body}
						placeholder="Take a note…"
						aria-label="Note"
						onChange={(event) => change({ body: event.target.value })}
						onBlur={() => void flush()}
						className="min-h-28 text-[18px]"
					/>
				</div>

				{images.length > 0 && (
					<div className="mt-4">
						<ImageStrip
							keys={images}
							onRemove={(key) => change({ images: images.filter((k) => k !== key) })}
							size="lg"
						/>
					</div>
				)}
			</main>
		</>
	);
}
