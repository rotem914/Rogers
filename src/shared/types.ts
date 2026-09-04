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
};

/** One note, on its own page. */
export type Note = {
	id: string;
	projectId: string;
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
};

export type UpdateNoteBody = {
	title?: string;
	body?: string;
	/** The whole array, in order. A partial list would lose images. */
	images?: string[];
	/** True pins it now, false unpins it. The Worker writes the timestamp. */
	pinned?: boolean;
};

/* ---------------------------------------------------------------- images */

/** What an upload answers with. The key is what a note stores. */
export type UploadResult = {
	key: string;
};

/* ---------------------------------------------------------------- failure */

/** Every failed request answers in this shape, so the client reads one field. */
export type ApiErrorBody = {
	error: string;
};
