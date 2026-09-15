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

/**
 * The most a keepalive request may carry. The fetch spec refuses a keepalive
 * body past 64 KiB outright, so a bigger patch goes out as a plain request
 * instead and relies on being parked rather than on outliving the page.
 */
const KEEPALIVE_LIMIT = 60 * 1024;

const DRAFT_KEY = (noteId: string) => `note:${noteId}`;

export class NoteSaver {
	private pending: UpdateNoteBody = {};
	/** The patch that is out right now, so a park can rescue it too. */
	private sent: UpdateNoteBody | null = null;
	private inFlight = false;
	/** A page-leaving flush arrived mid-save: the follow-up goes out keepalive. */
	private leaveAfter = false;
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
	 *
	 * `leaving` is for the page going away under the request, pagehide: the
	 * save is sent keepalive so the browser finishes it after unload. Only
	 * then, because keepalive caps the body at 64 KiB and a long note would
	 * fail every blur and every back arrow with it.
	 */
	async flush(leaving = false): Promise<boolean> {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (!this.hasUnsaved()) return true;

		const done = new Promise<void>((resolve) => this.drained.push(resolve));
		void this.send(leaving);
		await done;

		if (Object.keys(this.pending).length > 0) {
			this.park();
			return false;
		}
		return true;
	}

	/**
	 * Park whatever has not been confirmed saved, for a reload the page cannot
	 * avoid. The patch out on the wire counts too: an unload cancels it, and a
	 * rescue that parks only the queue behind it would lose exactly the text
	 * typed just before the page went.
	 */
	park(): void {
		const unsaved = { ...this.sent, ...this.pending };
		if (Object.keys(unsaved).length === 0) return;
		parkDraft(DRAFT_KEY(this.noteId), JSON.stringify(unsaved));
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

	private async send(leaving = false): Promise<void> {
		if (this.inFlight) {
			/* A page-leaving flush during a save: the save that follows it, with
			   whatever was typed meanwhile, must go out keepalive as well. */
			if (leaving) this.leaveAfter = true;
			return;
		}
		if (Object.keys(this.pending).length === 0) {
			this.settle();
			return;
		}
		leaving = leaving || this.leaveAfter;
		this.leaveAfter = false;

		/* Take the pending patch off the queue before awaiting anything, so
		   keystrokes that land during the request start a fresh patch instead of
		   mutating the one being sent. */
		const patch = this.pending;
		this.pending = {};
		this.sent = patch;
		this.inFlight = true;
		this.onStatus("saving");

		try {
			await this.ready;
			const body = JSON.stringify(patch);
			await apiFetch<Note>(`/api/notes/${this.noteId}`, {
				method: "PATCH",
				body,
				/* A flush on the way out of the page must survive the page going
				   away. keepalive lets the browser finish it after unload, but
				   refuses a body past its cap, so a long note is sent plain and
				   trusts the park instead. */
				keepalive: leaving && new TextEncoder().encode(body).byteLength <= KEEPALIVE_LIMIT,
			});
			this.sent = null;
			this.inFlight = false;
			if (Object.keys(this.pending).length > 0) {
				/* Typing continued during the save: go again at once, no settle. */
				void this.send(leaving);
			} else {
				this.onStatus("saved");
				this.settle();
			}
		} catch {
			this.sent = null;
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
