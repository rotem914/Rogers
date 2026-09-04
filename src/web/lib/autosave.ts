/* Saving a note while it is being typed.
 *
 * This is the client half of the first project invariant: text already typed
 * is never lost or overwritten by an older save. Three rules make it hold, and
 * each has a line in this file:
 *
 * 1. At most one save per note is in flight. A second one is never started
 *    while the first is still out, so two answers can never arrive in the
 *    wrong order.
 * 2. Everything typed while a save is out is coalesced into one pending patch,
 *    latest value per field, and sent the moment the previous save returns.
 * 3. A save answer is never written back into the editor. The editor is the
 *    source of truth for what is on screen; the server is only told about it.
 *
 * When a save fails the patch stays pending and is retried on the next change
 * or flush, and a flush that still fails parks the text in sessionStorage so
 * leaving the page cannot lose it. */

import { apiFetch } from "../platform/api-client";
import { parkDraft } from "../platform/session";
import type { Note, UpdateNoteBody } from "../../shared/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** How long typing has to pause before a save goes out. */
const SETTLE_MS = 600;

const DRAFT_KEY = (noteId: string) => `note:${noteId}`;

export class NoteSaver {
	private pending: UpdateNoteBody = {};
	private inFlight = false;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private drained: (() => void)[] = [];
	private stopped = false;

	constructor(
		private readonly noteId: string,
		private readonly onStatus: (status: SaveStatus) => void,
		/**
		 * Resolves once the note exists on the server. The composer creates a
		 * note on the first keystroke, and keystrokes keep coming while that
		 * request is out; they queue here and go out as one patch afterwards.
		 */
		private readonly ready: Promise<void> = Promise.resolve(),
	) {}

	/** Record a change. It goes out after typing settles, or after the current save. */
	queue(patch: UpdateNoteBody): void {
		if (this.stopped) return;
		Object.assign(this.pending, patch);
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = setTimeout(() => void this.send(), SETTLE_MS);
	}

	/** True while something typed has not reached the server yet. */
	hasUnsaved(): boolean {
		return this.inFlight || Object.keys(this.pending).length > 0;
	}

	/**
	 * Send everything now and resolve when the note is fully saved.
	 *
	 * Used on blur, on Close, and on the way back. If the save fails, the text
	 * is parked so the caller can leave the page without losing it.
	 */
	async flush(): Promise<boolean> {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (!this.hasUnsaved()) return true;

		const done = new Promise<void>((resolve) => this.drained.push(resolve));
		void this.send(true);
		await done;

		if (Object.keys(this.pending).length > 0) {
			this.park();
			return false;
		}
		return true;
	}

	/** Park whatever has not been saved, for a reload the page cannot avoid. */
	park(): void {
		if (Object.keys(this.pending).length === 0) return;
		parkDraft(DRAFT_KEY(this.noteId), JSON.stringify(this.pending));
	}

	/**
	 * Stop accepting changes; the editor is going away.
	 *
	 * Anything still unsaved is parked, never dropped. This also covers React's
	 * development mode, which mounts an editor twice: the first saver is disposed
	 * before it could send, and the second one picks the parked text up.
	 */
	dispose(): void {
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.park();
		this.stopped = true;
	}

	private async send(final = false): Promise<void> {
		if (this.inFlight) return;
		if (Object.keys(this.pending).length === 0) {
			this.settle();
			return;
		}

		/* Take the pending patch off the queue before awaiting anything, so
		   keystrokes that land during the request start a fresh patch instead of
		   mutating the one being sent. */
		const patch = this.pending;
		this.pending = {};
		this.inFlight = true;
		this.onStatus("saving");

		try {
			await this.ready;
			await apiFetch<Note>(`/api/notes/${this.noteId}`, {
				method: "PATCH",
				body: JSON.stringify(patch),
				/* A flush on the way out of the page must survive the page going
				   away. keepalive lets the browser finish it after unload. */
				keepalive: final,
			});
			this.inFlight = false;
			if (Object.keys(this.pending).length > 0) {
				/* Typing continued during the save: go again at once, no settle. */
				void this.send(final);
			} else {
				this.onStatus("saved");
				this.settle();
			}
		} catch {
			this.inFlight = false;
			/* Put the failed fields back under anything typed since. Newer text
			   wins, which is the invariant seen from the failure side. */
			this.pending = { ...patch, ...this.pending };
			this.onStatus("error");
			this.settle();
		}
	}

	private settle(): void {
		const waiting = this.drained;
		this.drained = [];
		for (const resolve of waiting) resolve();
	}
}

/** The key under which a note's unsaved text is parked; the editor restores it. */
export function draftKey(noteId: string): string {
	return DRAFT_KEY(noteId);
}
