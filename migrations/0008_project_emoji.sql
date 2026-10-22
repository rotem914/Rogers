-- Rogers, eighth migration: a project can wear an emoji beside its name.
--
-- Additive, like every migration here. One nullable column, no default, and no
-- existing row is read or rewritten.
--
-- `projects.emoji` is the emoji's code points in lowercase hex, joined by
-- hyphens, the way every emoji set names its files: `1f4dd` for the memo.
-- Null means no emoji, which is what every project that existed before this
-- migration reads as, so no tile changes until one is picked.

ALTER TABLE projects ADD COLUMN emoji TEXT;
