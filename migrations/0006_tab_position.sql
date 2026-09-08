-- Rogers, fourth migration: where a tab sits in its project's strip.
--
-- Additive, like every migration here. One nullable column, no default, and no
-- existing row is read or rewritten.
--
-- Null means "never dragged", and null sorts LAST here, the same way the
-- projects column works: a tab made after the strip has been arranged by hand
-- lands at the end, beside the plus that made it, instead of appearing in the
-- middle of an order somebody chose.
ALTER TABLE tabs ADD COLUMN position INTEGER;
