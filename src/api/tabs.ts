/* Tab routes that hang off a project: list its tabs, add one, remove one.
 *
 * "Main" is never a row. It is the project's own list, the one every note has
 * always been in, so a project answers an empty list here until the first tab
 * is added, and the page shows no tabs at all. Removing a tab archives it; its
 * notes keep pointing at it and the list query shows them in Main again, so a
 * mis-click never puts a note out of reach. */

import { Hono } from "hono";
import type { ApiErrorBody, CreateTabBody, Tab, UpdateTabBody } from "../shared/types";
import { errorBody, isUsableId, readJson } from "./http";
import { projectIsLive } from "./notes";
import { toTab, type TabRow } from "./rows";

export const projectTabs = new Hono<{ Bindings: Env }>();

/** What a tab is called when it is made, until it is renamed. */
const DEFAULT_NAME = "New tab";

/* In the order they were made. There is no dragging here yet. */
const LIST_SQL = `
	SELECT * FROM tabs
	 WHERE project_id = ? AND archived_at IS NULL
	 ORDER BY created_at ASC
`;

/* Deliberately finds archived tabs too, so a repeated remove answers calmly. */
const ONE_SQL = `SELECT * FROM tabs WHERE id = ?`;

projectTabs.get("/", async (c) => {
	const projectId = c.req.param("projectId");
	if (projectId === undefined || !(await projectIsLive(c.env.DB, projectId))) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const { results } = await c.env.DB.prepare(LIST_SQL).bind(projectId).all<TabRow>();
	return c.json<Tab[]>(results.map(toTab));
});

projectTabs.post("/", async (c) => {
	const projectId = c.req.param("projectId");
	if (projectId === undefined || !(await projectIsLive(c.env.DB, projectId))) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const body = await readJson<CreateTabBody>(c.req.raw);

	/* An empty name is not an error, it is the default. */
	const trimmed = typeof body?.name === "string" ? body.name.trim() : "";
	const name = trimmed === "" ? DEFAULT_NAME : trimmed;

	/* A browser-made id ends up in an address, so it is checked, not trusted. */
	let id: string;
	if (body !== null && "id" in body && body.id !== undefined) {
		if (!isUsableId(body.id)) {
			return c.json(errorBody("That tab id is not usable."), 400);
		}
		id = body.id;
	} else {
		id = crypto.randomUUID();
	}
	const now = new Date().toISOString();

	/* Creating the same id twice answers with the tab that is already there, so
	   a request applied and then lost on the way back is not an error on retry. */
	const inserted = await c.env.DB.prepare(
		`INSERT INTO tabs (id, project_id, name, created_at, updated_at, archived_at)
		 VALUES (?, ?, ?, ?, ?, NULL)
		 ON CONFLICT (id) DO NOTHING`,
	)
		.bind(id, projectId, name, now, now)
		.run();

	if (inserted.meta.changes === 0) {
		const existing = await rereadTab(c.env.DB, id);
		/* The same id in a different project is a collision, not a retry. */
		if (existing.project_id !== projectId) {
			return c.json(errorBody("That tab id is already in use."), 409);
		}
		return c.json<Tab>(toTab(existing));
	}

	return c.json<Tab>({ id, projectId, name, createdAt: now, updatedAt: now }, 201);
});

projectTabs.patch("/:id", async (c) => {
	const projectId = c.req.param("projectId");
	const id = c.req.param("id");
	if (projectId === undefined || !(await projectIsLive(c.env.DB, projectId))) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const existing = await c.env.DB.prepare(ONE_SQL).bind(id).first<TabRow>();
	if (existing === null || existing.project_id !== projectId) {
		return c.json<ApiErrorBody>({ error: "No such tab." }, 404);
	}

	const body = await readJson<UpdateTabBody>(c.req.raw);

	/* A removed tab can only be brought back, never renamed: nothing on screen
	   can reach one, so a rename arriving for it means the strip is working from
	   a stale list. Undo is the one thing that reaches a removed tab. */
	const restoring = body !== null && body.archived === false;
	if (existing.archived_at !== null && !restoring) {
		return c.json<ApiErrorBody>({ error: "No such tab." }, 404);
	}

	/* Only the fields the request carries are written, and `in` is the test.
	   Assigning every column would let a rename resurrect a removed tab, or a
	   restore rename it back to something older. */
	const assignments: string[] = [];
	const values: unknown[] = [];

	if (body !== null && "name" in body) {
		const name = typeof body.name === "string" ? body.name.trim() : "";
		if (name === "") {
			return c.json<ApiErrorBody>({ error: "A tab needs a name." }, 400);
		}
		assignments.push("name = ?");
		values.push(name);
	}

	if (body !== null && "archived" in body) {
		if (typeof body.archived !== "boolean") {
			return c.json<ApiErrorBody>({ error: "Archived must be true or false." }, 400);
		}
		/* Removing again, or restoring what is already live, changes nothing. */
		if (body.archived && existing.archived_at === null) {
			assignments.push("archived_at = ?");
			values.push(new Date().toISOString());
		} else if (!body.archived && existing.archived_at !== null) {
			/* The notes were never rewritten, so they come back with it. */
			assignments.push("archived_at = NULL");
		}
	}

	/* A request that names nothing changes nothing, and answers with the tab as
	   it stands rather than an error. */
	if (assignments.length === 0) {
		return c.json<Tab>(toTab(existing));
	}

	const now = new Date().toISOString();
	assignments.push("updated_at = ?");
	values.push(now);

	await c.env.DB.prepare(`UPDATE tabs SET ${assignments.join(", ")} WHERE id = ?`)
		.bind(...values, id)
		.run();

	return c.json<Tab>(toTab(await rereadTab(c.env.DB, id)));
});

projectTabs.delete("/:id", async (c) => {
	const projectId = c.req.param("projectId");
	const id = c.req.param("id");
	if (projectId === undefined || !(await projectIsLive(c.env.DB, projectId))) {
		return c.json<ApiErrorBody>({ error: "No such project." }, 404);
	}

	const existing = await c.env.DB.prepare(ONE_SQL).bind(id).first<TabRow>();

	/* A tab from another project is not this project's to remove. */
	if (existing === null || existing.project_id !== projectId) {
		return c.json<ApiErrorBody>({ error: "No such tab." }, 404);
	}

	/* Already removed: answer calmly, so a double click or a retry after a lost
	   answer does not look like a failure for work that succeeded. */
	if (existing.archived_at !== null) {
		return c.json<Tab>(toTab(existing));
	}

	const now = new Date().toISOString();
	await c.env.DB.prepare(
		`UPDATE tabs SET archived_at = ?, updated_at = ? WHERE id = ?`,
	)
		.bind(now, now, id)
		.run();

	/* The notes keep their tab_id on purpose. Nothing is rewritten, so clearing
	   archived_at on this row brings the tab back with every note still in it.
	   Until then the notes list shows them in Main. */
	return c.json<Tab>(toTab(await rereadTab(c.env.DB, id)));
});

/** Read a tab back after writing it. Throwing here answers a JSON 500. */
async function rereadTab(db: D1Database, id: string): Promise<TabRow> {
	const row = await db.prepare(ONE_SQL).bind(id).first<TabRow>();
	if (row === null) {
		throw new Error(`Tab ${id} could not be read back after writing.`);
	}
	return row;
}
