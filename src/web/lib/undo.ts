/* Undo and redo for what a note holds: its title, its body and its pictures.
 *
 * One stack per open editor. Every edit is recorded as the snapshot it
 * produced, and a run of typing in one field is folded into a single step, so
 * undo takes back a burst of keystrokes rather than one letter. A picture
 * added or removed is always its own step.
 *
 * Undo and redo hand back the snapshot to show. The caller puts it on screen
 * and queues it for saving exactly the way typing is, so an undone edit is
 * saved like any other and the first invariant holds: nothing typed is lost,
 * and no older save overwrites it. */

export type Snapshot = { title: string; body: string; images: string[] };
export type TextField = "title" | "body";

/** Keystrokes closer together than this, in the same field, are one step. */
const FOLD_MS = 1000;
/** Steps kept. Older ones fall off the bottom. */
const LIMIT = 200;

export class UndoStack {
	private past: Snapshot[] = [];
	private future: Snapshot[] = [];
	private present: Snapshot;
	private lastText: { field: TextField; at: number } | null = null;

	constructor(initial: Snapshot) {
		this.present = initial;
	}

	/** The editor was filled from outside, not by an edit: start over from here. */
	reset(snapshot: Snapshot): void {
		this.past = [];
		this.future = [];
		this.present = snapshot;
		this.lastText = null;
	}

	/** An edit by the person. `field` names the text field when it was typing. */
	record(next: Snapshot, field?: TextField): void {
		const now = Date.now();
		const folds =
			field !== undefined &&
			this.lastText !== null &&
			this.lastText.field === field &&
			now - this.lastText.at < FOLD_MS;
		if (!folds) {
			this.past.push(this.present);
			if (this.past.length > LIMIT) this.past.shift();
		}
		this.present = next;
		this.future = [];
		this.lastText = field === undefined ? null : { field, at: now };
	}

	undo(): Snapshot | null {
		const previous = this.past.pop();
		if (previous === undefined) return null;
		this.future.push(this.present);
		this.present = previous;
		this.lastText = null;
		return previous;
	}

	redo(): Snapshot | null {
		const next = this.future.pop();
		if (next === undefined) return null;
		this.past.push(this.present);
		this.present = next;
		this.lastText = null;
		return next;
	}
}

/** Which step a key press asks for, if any. Ctrl on Windows, Cmd on a Mac.
 *  The physical key is checked first, so a Hebrew layout works the same; the
 *  key name is the fallback for anything that sends no code. */
export function undoShortcut(event: KeyboardEvent): "undo" | "redo" | null {
	if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
	const key = event.code === "" ? event.key.toLowerCase() : event.code;
	if (key === "KeyZ" || key === "z") return event.shiftKey ? "redo" : "undo";
	if ((key === "KeyY" || key === "y") && !event.shiftKey) return "redo";
	return null;
}

/* ------------------------------------------------------------------- tabs
 *
 * A project's tabs undo differently from a note. There is no snapshot to put
 * back on screen: adding, removing and renaming are three actions, each with
 * an opposite, and taking one back means asking the Worker to do the opposite.
 * So this keeps the actions themselves, and the page turns one into a request.
 *
 * A step is taken off the stack only once it actually went through, so a
 * failed undo leaves the history alone and Ctrl+Z tries the same step again. */

export type TabAction =
	| { kind: "add"; id: string }
	| { kind: "remove"; id: string }
	/** A null id is the first tab, which has no row and is renamed on the project. */
	| { kind: "rename"; id: string | null; from: string; to: string };

export class TabHistory {
	private past: TabAction[] = [];
	private future: TabAction[] = [];

	/** An action by the person. It clears the redo trail, as an edit does. */
	record(action: TabAction): void {
		this.past.push(action);
		if (this.past.length > LIMIT) this.past.shift();
		this.future = [];
	}

	/** What Ctrl+Z would take back, without taking it back yet. */
	nextUndo(): TabAction | null {
		return this.past.length === 0 ? null : this.past[this.past.length - 1];
	}

	nextRedo(): TabAction | null {
		return this.future.length === 0 ? null : this.future[this.future.length - 1];
	}

	/** Called once that undo really happened. */
	commitUndo(): void {
		const action = this.past.pop();
		if (action !== undefined) this.future.push(action);
	}

	commitRedo(): void {
		const action = this.future.pop();
		if (action !== undefined) this.past.push(action);
	}
}
