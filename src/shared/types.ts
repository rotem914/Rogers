/* The contract between the Worker and the app.
 *
 * These describe what travels over the wire, not what sits in the database.
 * The two are deliberately different:
 *
 * - the wire is camelCase, the table is snake_case;
 * - `archived_at` never appears here, because an archived row is never sent,
 *   so a screen cannot accidentally show one;
 * - `images` is a real array here and a JSON string in the column;
 * - reading reports state (`pinnedAt`, a timestamp), writing expresses intent
 *   (`pinned`, a boolean). Asking to pin is not the same fact as knowing when
 *   something was pinned, and collapsing the two is how a redundant flag drifts
 *   away from the column that actually orders the list.
 *
 * The mapping between row and wire lives in the Worker, in one place, so the
 * table shape stops at the API boundary. */

export type Health = {
	ok: true;
	service: "rogers";
};

/* ---------------------------------------------------------------- reading */

/** A project tile on Home. */
export type Project = {
	id: string;
	name: string;
	/** Optional accent. Null means the default surface. */
	color: string | null;
	/** Live notes inside it, so the tile can say "12 notes" without a second call. */
	noteCount: number;
	/**
	 * What the first tab is called. Null means it has never been renamed and
	 * reads as "Main". It has no tab row, so its name lives on the project.
	 */
	mainTabName: string | null;
	createdAt: string;
	updatedAt: string;
};

/**
 * A tab inside a project, with a list of its own.
 *
 * "Main" is never sent: it is the project's own list, the one every note has
 * always been in, so a project with no tabs has none of these at all.
 */
export type Tab = {
	id: string;
	projectId: string;
	name: string;
	/** True once "Add checklist" was used on this tab: every row draws a box. */
	checklist: boolean;
	createdAt: string;
	updatedAt: string;
};

/** One row in a project's list. Carries only what the row draws. */
export type NotePreview = {
	id: string;
	title: string;
	/** The body, clipped by the Worker. The full text comes from the note page. */
	preview: string;
	/** R2 keys, in note order, for the row's thumbnails. */
	images: string[];
	/** Null means unpinned. Sorting is done by the Worker; this splits the sections. */
	pinnedAt: string | null;
	/** The row's own mark, drawn only while its tab has a checklist. */
	checked: boolean;
};

/** One note, on its own page. */
export type Note = {
	id: string;
	projectId: string;
	/** The tab the note is in. Null means Main, the project's own list. */
	tabId: string | null;
	title: string;
	body: string;
	images: string[];
	pinnedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

/* ---------------------------------------------------------------- writing */

/** The id is optional so the browser can make one and render the note at once. */
export type CreateProjectBody = {
	id?: string;
	name: string;
};

/** Every field optional: a rename sends a name, a recolour sends a colour. */
export type UpdateProjectBody = {
	name?: string;
	/** Null clears the accent back to the default surface. */
	color?: string | null;
	/** Renames the first tab. Null puts it back to "Main". */
	mainTabName?: string | null;
};

/**
 * The whole list of project ids, in the order Home should show them.
 *
 * The whole list rather than the one that moved: a position only means
 * something next to its neighbours, so sending a single id would leave the
 * Worker guessing what the rest of the grid looks like.
 */
export type ReorderProjectsBody = {
	ids: string[];
};

export type CreateNoteBody = {
	id?: string;
	title?: string;
	body?: string;
	/** The tab to put it in. Left out, the note goes in Main. */
	tabId?: string;
};

/** The id is optional for the same reason as a note's. The name defaults to "New tab". */
export type CreateTabBody = {
	id?: string;
	name?: string;
};

/**
 * A rename, or a removal taken back.
 *
 * Main has no row, so it cannot be renamed. `archived: false` is how undo
 * brings a removed tab back, with every note that was in it.
 */
export type UpdateTabBody = {
	name?: string;
	archived?: boolean;
	/** True gives every row in this tab a checkbox, false takes it away. */
	checklist?: boolean;
};

/**
 * The whole list of tab ids, in the order the strip should show them.
 *
 * The whole list rather than the one that moved, for the same reason a
 * project's order sends all of them: a position only means something next to
 * its neighbours. Main is never in it, since it has no row to keep one in and
 * stays the first chip.
 */
export type ReorderTabsBody = {
	ids: string[];
};

export type UpdateNoteBody = {
	title?: string;
	body?: string;
	/** The whole array, in order. A partial list would lose images. */
	images?: string[];
	/** True pins it now, false unpins it. The Worker writes the timestamp. */
	pinned?: boolean;
	/** The checklist mark. It changes nothing else about the note. */
	checked?: boolean;
};

/**
 * One section of a project's list, in the order it should show.
 *
 * A section at a time, not the whole page: pinned notes and the rest are two
 * orders, and a row dragged across the line between them would be asking to be
 * pinned, which is a different request.
 */
export type ReorderNotesBody = {
	ids: string[];
};

/* ---------------------------------------------------------------- images */

/** What an upload answers with. The key is what a note stores. */
export type UploadResult = {
	key: string;
};

/** The pictures that still have no small copy for lists. */
export type MissingThumbs = { keys: string[] };

/* ---------------------------------------------------------------- failure */

/** Every failed request answers in this shape, so the client reads one field. */
export type ApiErrorBody = {
	error: string;
};
