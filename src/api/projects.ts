/* Project routes: list, create, update, archive.
 *
 * Nothing here deletes a row. Removing a project sets archived_at, so a
 * mis-click is recoverable, which is a project invariant.
 *
 * The systematic input checking arrives at plan step 3.5. The guards below are
 * only what these endpoints need to not corrupt anything. */

import { Hono } from "hono";
import type {
	ApiErrorBody,
	CreateProjectBody,
	Project,
	ReorderProjectsBody,
	UpdateProjectBody,
} from "../shared/types";
import { errorBody, isUsableId, readJson } from "./http";
import { toProject, type ProjectListRow } from "./rows";

export const projects = new Hono<{ Bindings: Env }>();

/* One column list, so a project answers the same shape from every route. The
   note count is a subquery rather than a second round trip, and it counts live
   notes only. */
const COLUMNS = `
	p.id, p.name, p.color, p.main_tab_name, p.created_at, p.updated_at, p.archived_at,
	(SELECT count(*) FROM notes n
	  WHERE n.project_id = p.id AND n.archived_at IS NULL) AS note_count
`;

/* Dragged order first, then creation order for whatever has never been dragged.
   `position IS NULL` is 0 or 1 in SQLite, so projects that carry a position sort
   ahead of the ones that do not, and a database nobody has ever reordered keeps
   the exact order it had before this column existed. */
const LIST_SQL = `SELECT ${COLUMNS} FROM projects p
	 WHERE p.archived_at IS NULL
	 ORDER BY p.position IS NULL, p.position ASC, p.created_at ASC`;

/* Deliberately finds archived projects too. Each route decides what to do with
   one, which is not the same answer for a rename as for a repeated archive. */
const ONE_SQL = `SELECT ${COLUMNS} FROM projects p WHERE p.id = ?`;

projects.get("/", async (c) => {
	const { results } = await c.env.DB.prepare(LIST_SQL).all<ProjectListRow>();
	return c.json<Project[]>(results.map(toProject));
});

projects.post("/", async (c) => {
	const body = await readJson<CreateProjectBody>(c.req.raw);

	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (name === "") {
		return c.json<ApiErrorBody>({ error: "A project needs a name." }, 400);
	}

	/* The browser may send its own id so the tile can appear before the answer
	   comes back. That makes the id untrusted input which ends up in an address,
	   so it is checked rather than trusted. Anything it did not send, the Worker
	   decides: the id and both timestamps, so one clock writes every date. */
	let id: string;
	if (body !== null && "id" in body && body.id !== undefined) {
		if (!isUsableId(body.id)) {
			return c.json(errorBody("That project id is not usable."), 400);
		}
		id = body.id;
	} else {
		id = crypto.randomUUID();
	}
	const now = new Date().toISOString();

	/* Creating the same id twice answers with what is already there instead of
	   failing. The browser makes the id before it sends, so a request that was
	   sent, applied, and then lost on the way back would otherwise turn a
	   successful create into an error on retry. */
	const inserted = await c.env.DB.prepare(
		`INSERT INTO projects (id, name, color, created_at, updated_at, archived_at)
		 VALUES (?, ?, NULL, ?, ?, NULL)
		 ON CONFLICT (id) DO NOTHING`,
	)
		.bind(id, name, now, now)
		.run();

	if (inserted.meta.changes === 0) {
		return c.json<Project>(toProject(await reread(c.env.DB, id)));
	}

	return c.json<Project>(
		{
			id,
			name,
			color: null,
			noteCount: 0,
			mainTabName: null,
			createdAt: now,
			updatedAt: now,
		},
		201,
	);
});

/* The order Home shows, written in one go.
 *
 * Ahead of the :id routes on purpose. Nothing matches both today, since this is
 * the only PUT here, but a project called "order" is one route away from being
 * unreachable and this costs nothing.
 *
 * Positions are written for every id in the list, not just the moved one, so
 * the stored order and the order on screen are the same fact rather than two
 * that have to agree. */
projects.put("/order", async (c) => {
	const body = await readJson<ReorderProjectsBody>(c.req.raw);
	const ids = body === null ? undefined : body.ids;

	if (!Array.isArray(ids) || !ids.every(isUsableId)) {
		return c.json(errorBody("An order is a list of project ids."), 400);
	}

	/* A repeated id would give one project two positions and leave another with
	   none, which is a half-applied order rather than a wrong one. */
	if (new Set(ids).size !== ids.length) {
		return c.json(errorBody("That order names a project twice."), 400);
	}

	if (ids.length > 0) {
		const now = new Date().toISOString();
		const statement = c.env.DB.prepare(
			`UPDATE projects SET position = ?, updated_at = ?
			 WHERE id = ? AND archived_at IS NULL`,
		);

		/* One batch, so a connection lost halfway cannot leave the grid holding
		   part of the old order and part of the new one. An id the list names but
		   the database does not have simply changes nothing: the order is a view
		   of what the browser had on screen, and a stale entry in it is not a
		   reason to refuse the rest. */
		await c.env.DB.batch(ids.map((id, index) => statement.bind(index, now, id)));
	}

	const { results } = await c.env.DB.prepare(LIST_SQL).all<ProjectListRow>();
	return c.json<Project[]>(results.map(toProject));
});

projects.patch("/:id", async (c) => {
	const id = c.req.param("id");
	const existing = await c.env.DB.prepare(ONE_SQL)
		.bind(id)
		.first<ProjectListRow>();

	/* An archived project is not renameable: nothing in the app can reach one,
	   so a rename arriving for it means the client is working from a stale list. */
	if (existing === null || existing.archived_at !== null) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const body = await readJson<UpdateProjectBody>(c.req.raw);

	/* Only the fields the request actually carries are written. Assigning every
	   column would let a rename blank the colour, which is the shape of an edit
	   quietly destroying a value nobody asked it to touch. `in` is the test, not
	   a check against undefined: an explicit null clears the colour and must
	   still count as present. */
	const assignments: string[] = [];
	const values: unknown[] = [];

	if (body !== null && "name" in body) {
		const name = typeof body.name === "string" ? body.name.trim() : "";
		if (name === "") {
			return c.json<ApiErrorBody>({ error: "A project needs a name." }, 400);
		}
		assignments.push("name = ?");
		values.push(name);
	}

	if (body !== null && "color" in body) {
		const color = body.color;
		if (color !== null && typeof color !== "string") {
			return c.json<ApiErrorBody>(
				{ error: "Colour must be text, or null to clear it." },
				400,
			);
		}
		assignments.push("color = ?");
		values.push(color);
	}

	/* The first tab's name. It has no tab row of its own, so renaming it is a
	   change to the project. An empty name is refused rather than stored, the
	   same as the project's own; null puts it back to "Main". */
	if (body !== null && "mainTabName" in body) {
		const mainTabName = body.mainTabName;
		if (mainTabName !== null && typeof mainTabName !== "string") {
			return c.json<ApiErrorBody>(
				{ error: "That name must be text, or null to clear it." },
				400,
			);
		}
		const trimmed = mainTabName === null ? null : mainTabName.trim();
		if (trimmed === "") {
			return c.json<ApiErrorBody>({ error: "A tab needs a name." }, 400);
		}
		assignments.push("main_tab_name = ?");
		values.push(trimmed);
	}

	/* A request that names nothing changes nothing, and answers with the project
	   as it stands rather than an error. */
	if (assignments.length === 0) {
		return c.json<Project>(toProject(existing));
	}

	const now = new Date().toISOString();
	assignments.push("updated_at = ?");
	values.push(now);

	await c.env.DB.prepare(
		`UPDATE projects SET ${assignments.join(", ")} WHERE id = ?`,
	)
		.bind(...values, id)
		.run();

	return c.json<Project>(toProject(await reread(c.env.DB, id)));
});

projects.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const existing = await c.env.DB.prepare(ONE_SQL)
		.bind(id)
		.first<ProjectListRow>();

	if (existing === null) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	/* Already archived: say so calmly. A double click, or a retry after a lost
	   answer, must not look like a failure for work that succeeded. */
	if (existing.archived_at !== null) {
		return c.json<Project>(toProject(existing));
	}

	const now = new Date().toISOString();
	await c.env.DB.prepare(
		`UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ?`,
	)
		.bind(now, now, id)
		.run();

	/* The project's notes are left alone on purpose. They are unreachable while
	   the project is archived, and still whole if it comes back. */
	return c.json<Project>(toProject(await reread(c.env.DB, id)));
});

/** Read a project back after writing it. Throwing here answers a JSON 500. */
async function reread(db: D1Database, id: string): Promise<ProjectListRow> {
	const row = await db.prepare(ONE_SQL).bind(id).first<ProjectListRow>();
	if (row === null) {
		throw new Error(`Project ${id} could not be read back after writing.`);
	}
	return row;
}
