-- Rogers, first migration: projects and the notes inside them.
--
-- Migrations are additive, always. A later migration adds a column or a table;
-- it never drops one and never rewrites existing rows. That is a project
-- invariant, and it is what makes an upgrade unable to eat notes.
--
-- Nothing here is ever deleted either. Removing a project or a note sets
-- archived_at, so a mis-click stays recoverable.

CREATE TABLE projects (
	-- A uuid made in the browser, so a new project appears instantly and its
	-- address is known before the server has answered.
	id          TEXT PRIMARY KEY,
	name        TEXT NOT NULL,
	-- Optional accent for the tile. Null means the default surface.
	color       TEXT,
	-- ISO 8601 strings, written by the API. No database default on purpose:
	-- one clock writes these, and it is the Worker's.
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL,
	-- Null means live. A timestamp means archived, which is what delete does.
	archived_at TEXT
);

CREATE TABLE notes (
	id          TEXT PRIMARY KEY,
	project_id  TEXT NOT NULL REFERENCES projects(id),
	-- Both default to empty because a note is created the moment typing starts,
	-- often with only one of the two filled in.
	title       TEXT NOT NULL DEFAULT '',
	body        TEXT NOT NULL DEFAULT '',
	-- A JSON array of R2 keys, in the order they appear in the note.
	images      TEXT NOT NULL DEFAULT '[]',
	-- Null means not pinned. A timestamp means pinned, and it also orders the
	-- pinned section by when each note was pinned.
	pinned_at   TEXT,
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL,
	archived_at TEXT
);

-- The one query the project page runs:
--   WHERE project_id = ? AND archived_at IS NULL
--   ORDER BY pinned_at DESC, created_at DESC
--
-- The two leading columns match on equality, and the rest of the index is read
-- backwards to produce both DESC orders. Unpinned notes hold null in pinned_at,
-- and SQLite sorts nulls last under DESC, so pinned notes come first without a
-- second query or a CASE expression.
CREATE INDEX notes_by_project
	ON notes (project_id, archived_at, pinned_at, created_at);
