-- Rogers, seventh migration: a tab can show a checkbox on every one of its rows.
--
-- Additive, like every migration here. Two nullable columns, no default, and no
-- existing row is read or rewritten.
--
-- `tabs.checklist` is the tab's own switch, turned on from the tab's right-click
-- menu. Null and 0 both mean off, which is what every tab that existed before
-- this migration reads as, so no list changes shape until the switch is used.
--
-- `notes.checked` is one row's mark. It lives on the note and not on the tab, so
-- turning the switch off and on again finds every mark exactly where it was, and
-- a note that moves between tabs carries its own mark with it. Null and 0 both
-- mean unmarked. Nothing else in the app reads this column: the mark is a mark,
-- it hides nothing and reorders nothing.

ALTER TABLE tabs ADD COLUMN checklist INTEGER;

ALTER TABLE notes ADD COLUMN checked INTEGER;
