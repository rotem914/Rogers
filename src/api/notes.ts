/* Note routes that hang off a project: list the notes in it, add one.
 *
 * The single-note routes live in the second half of this file. */

import { Hono } from "hono";
import type {
	ApiErrorBody,
	CreateNoteBody,
	Note,
	NotePreview,
	UpdateNoteBody,
} from "../shared/types";
import { errorBody, isUsableId, readJson } from "./http";
import { PREVIEW_LENGTH, toNote, toNotePreview, type NoteRow } from "./rows";

export const projectNotes = new Hono<{ Bindings: Env }>();

/* The list the project page draws.
 *
 * The order is the whole Keep behaviour in one clause. Pinned notes carry a
 * timestamp and unpinned ones carry null; SQLite sorts nulls last under DESC,
 * so pinned rise to the top by themselves, most recently pinned first, and the
 * rest follow newest first. No CASE, no second query, and the
 * notes_by_project index serves both the filter and the order.
 *
 * The body is clipped in SQL as well as in the mapper. The mapper is the
 * guarantee; the SQL is so a project full of long notes does not haul every
 * word out of the database to throw it away. Clipping twice is harmless. */
const LIST_SQL = `
	SELECT id, project_id, title,
	       substr(body, 1, ${PREVIEW_LENGTH}) AS body,
	       images, pinned_at, created_at, updated_at, archived_at
	  FROM notes
	 WHERE project_id = ? AND archived_at IS NULL
	 ORDER BY pinned_at DESC, created_at DESC
`;

projectNotes.get("/", async (c) => {
	/* The id comes from the address this router is mounted under. TypeScript
	   cannot prove a mount-path parameter is present, and neither should we:
	   an address with no id is simply not a project. */
	const projectId = c.req.param("projectId");
	if (projectId === undefined || !(await projectIsLive(c.env.DB, projectId))) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const { results } = await c.env.DB.prepare(LIST_SQL)
		.bind(projectId)
		.all<NoteRow>();
	return c.json<NotePreview[]>(results.map(toNotePreview));
});

projectNotes.post("/", async (c) => {
	const projectId = c.req.param("projectId");
	if (projectId === undefined || !(await projectIsLive(c.env.DB, projectId))) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const body = await readJson<CreateNoteBody>(c.req.raw);

	/* Both fields may be empty. A note is created the moment typing starts, and
	   at that point usually only one of the two has anything in it. An entirely
	   empty note is legal here and is discarded by the composer when it closes,
	   which is the only place that knows the difference between a draft and a
	   note. */
	const title = typeof body?.title === "string" ? body.title : "";
	const text = typeof body?.body === "string" ? body.body : "";

	/* A browser-made id is untrusted input that ends up in an address, so it is
	   checked rather than trusted. */
	let id: string;
	if (body !== null && "id" in body && body.id !== undefined) {
		if (!isUsableId(body.id)) {
			return c.json(errorBody("That note id is not usable."), 400);
		}
		id = body.id;
	} else {
		id = crypto.randomUUID();
	}
	const now = new Date().toISOString();

	/* Creating the same id twice answers with the note that is already there, so
	   a request that was applied and then lost on the way back does not turn into
	   an error when the composer retries it. */
	const inserted = await c.env.DB.prepare(
		`INSERT INTO notes
		   (id, project_id, title, body, images, pinned_at, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, '[]', NULL, ?, ?, NULL)
		 ON CONFLICT (id) DO NOTHING`,
	)
		.bind(id, projectId, title, text, now, now)
		.run();

	if (inserted.meta.changes === 0) {
		const existing = await rereadNote(c.env.DB, id);
		/* The same id already in a different project is a real collision, not a
		   retry. Answering with that note would hand one project's note to
		   another, so this refuses instead. */
		if (existing.project_id !== projectId) {
			return c.json(errorBody("That note id is already in use."), 409);
		}
		return c.json<Note>(toNote(existing));
	}

	return c.json<Note>(
		{
			id,
			projectId,
			title,
			body: text,
			images: [],
			pinnedAt: null,
			createdAt: now,
			updatedAt: now,
		},
		201,
	);
});

/**
 * Does this project exist and is it still live?
 *
 * Archived counts as absent. Notes inside an archived project are left whole in
 * the database, but nothing can reach them until the project comes back, so the
 * honest answer to a request for them is that there is no such project.
 */
async function projectIsLive(db: D1Database, id: string): Promise<boolean> {
	const row = await db
		.prepare(`SELECT 1 AS ok FROM projects WHERE id = ? AND archived_at IS NULL`)
		.bind(id)
		.first<{ ok: number }>();
	return row !== null;
}

/* Re-exported so plan step 3.4 can build on the same mapping. */
export { toNote };

/* ------------------------------------------------------------------ one note
 *
 * A note by its own address. This is what the note page reads and what autosave
 * writes, so the first project invariant lives here: text already typed is never
 * lost or overwritten. */

export const notes = new Hono<{ Bindings: Env }>();

const ONE_SQL = `SELECT * FROM notes WHERE id = ?`;

notes.get("/:id", async (c) => {
	const row = await c.env.DB.prepare(ONE_SQL)
		.bind(c.req.param("id"))
		.first<NoteRow>();

	if (row === null || row.archived_at !== null) {
		return c.json<ApiErrorBody>({ error: "No such note." }, 404);
	}
	return c.json<Note>(toNote(row));
});

notes.patch("/:id", async (c) => {
	const id = c.req.param("id");
	const existing = await c.env.DB.prepare(ONE_SQL).bind(id).first<NoteRow>();

	if (existing === null || existing.archived_at !== null) {
		return c.json<ApiErrorBody>({ error: "No such note." }, 404);
	}

	const body = await readJson<UpdateNoteBody>(c.req.raw);

	/* Only the fields the request carries are written, and `in` is the test, not
	   a comparison against undefined. This is the invariant in code: a save that
	   assigned every column would let a title-only autosave blank the body the
	   moment the two are sent separately, which is the exact way a notes app
	   eats a note while reporting success. */
	const assignments: string[] = [];
	const values: unknown[] = [];

	if (body !== null && "title" in body) {
		if (typeof body.title !== "string") {
			return c.json<ApiErrorBody>({ error: "Title must be text." }, 400);
		}
		assignments.push("title = ?");
		values.push(body.title);
	}

	if (body !== null && "body" in body) {
		if (typeof body.body !== "string") {
			return c.json<ApiErrorBody>({ error: "Body must be text." }, 400);
		}
		assignments.push("body = ?");
		values.push(body.body);
	}

	if (body !== null && "images" in body) {
		const images = body.images;
		if (
			!Array.isArray(images) ||
			!images.every((key) => typeof key === "string")
		) {
			return c.json<ApiErrorBody>(
				{ error: "Images must be a list of keys." },
				400,
			);
		}
		/* The whole list, in order. A partial list would silently drop pictures. */
		assignments.push("images = ?");
		values.push(JSON.stringify(images));
	}

	if (body !== null && "pinned" in body) {
		if (typeof body.pinned !== "boolean") {
			return c.json<ApiErrorBody>({ error: "Pinned must be true or false." }, 400);
		}
		/* Pinning an already pinned note leaves its timestamp alone. Rewriting it
		   would jump the note to the top of the pinned section for a click that
		   changed nothing. */
		if (body.pinned && existing.pinned_at === null) {
			assignments.push("pinned_at = ?");
			values.push(new Date().toISOString());
		} else if (!body.pinned && existing.pinned_at !== null) {
			assignments.push("pinned_at = NULL");
		}
	}

	if (assignments.length === 0) {
		return c.json<Note>(toNote(existing));
	}

	const now = new Date().toISOString();
	assignments.push("updated_at = ?");
	values.push(now);

	await c.env.DB.prepare(`UPDATE notes SET ${assignments.join(", ")} WHERE id = ?`)
		.bind(...values, id)
		.run();

	return c.json<Note>(toNote(await rereadNote(c.env.DB, id)));
});

notes.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const existing = await c.env.DB.prepare(ONE_SQL).bind(id).first<NoteRow>();

	if (existing === null) {
		return c.json<ApiErrorBody>({ error: "No such note." }, 404);
	}

	/* Already archived: answer calmly, so a double click or a retry after a lost
	   answer does not look like a failure for work that succeeded. */
	if (existing.archived_at !== null) {
		return c.json<Note>(toNote(existing));
	}

	const now = new Date().toISOString();
	await c.env.DB.prepare(
		`UPDATE notes SET archived_at = ?, updated_at = ? WHERE id = ?`,
	)
		.bind(now, now, id)
		.run();

	/* The images stay in R2. A note that comes back must come back whole. */
	return c.json<Note>(toNote(await rereadNote(c.env.DB, id)));
});

/** Read a note back after writing it. Throwing here answers a JSON 500. */
async function rereadNote(db: D1Database, id: string): Promise<NoteRow> {
	const row = await db.prepare(ONE_SQL).bind(id).first<NoteRow>();
	if (row === null) {
		throw new Error(`Note ${id} could not be read back after writing.`);
	}
	return row;
}
