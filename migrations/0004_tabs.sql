-- Rogers, fourth migration: tabs inside a project, each with its own list.
--
-- Additive, like every migration here. One new table and one nullable column
-- on notes, no default, and no existing row is read or rewritten.
--
-- The first tab, "Main", is never a row. It is the project's own list, the one
-- every note has always been in, so a project with no tab rows shows no tabs
-- at all and reads exactly as it did before this migration. A note whose
-- tab_id is null is in Main. Removing a tab archives it and leaves its notes
-- pointing at it; the list query then shows them in Main again, so nothing a
-- mis-click removed is ever out of reach, and clearing archived_at on the tab
-- row puts every one of them back where it was.

CREATE TABLE tabs (
	-- A uuid made in the browser, so a new tab can appear at once.
	id          TEXT PRIMARY KEY,
	project_id  TEXT NOT NULL REFERENCES projects(id),
	name        TEXT NOT NULL,
	-- ISO 8601 strings, written by the Worker, the one clock.
	created_at  TEXT NOT NULL,
	updated_at  TEXT NOT NULL,
	-- Null means live. A timestamp means removed, which is what remove does.
	archived_at TEXT
);

CREATE INDEX tabs_by_project
	ON tabs (project_id, archived_at, created_at);

ALTER TABLE notes ADD COLUMN tab_id TEXT REFERENCES tabs(id);
