-- Rogers, fifth migration: what the first tab is called.
--
-- Additive, like every migration here. One nullable column on projects, no
-- default, and no existing row is read or rewritten.
--
-- "Main" is not a tab row: it is the project's own list, every note that is in
-- no live tab. So its name has nowhere to live except on the project itself.
-- Null means it has never been renamed, and the app shows "Main"; the name is
-- only ever seen when the project actually has tabs.
ALTER TABLE projects ADD COLUMN main_tab_name TEXT;
