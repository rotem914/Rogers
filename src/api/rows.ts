/* The database side of the boundary.
 *
 * Row types describe what SQLite actually returns: snake_case, archived_at
 * present, images as a JSON string. Nothing outside this folder imports them.
 *
 * The mappers are the only door between a row and an answer. A route that
 * returns a row directly would leak archived_at and hand the app a JSON string
 * where it expects an array, so routes map, always. */

import type { Note, NotePreview, Project } from "../shared/types";

export type ProjectRow = {
	id: string;
	name: string;
	color: string | null;
	created_at: string;
	updated_at: string;
	archived_at: string | null;
};

/** A project row with its live note count counted in the same query. */
export type ProjectListRow = ProjectRow & { note_count: number };

export type NoteRow = {
	id: string;
	project_id: string;
	title: string;
	body: string;
	/** A JSON array of R2 keys. Always a string here, never an array. */
	images: string;
	pinned_at: string | null;
	created_at: string;
	updated_at: string;
	archived_at: string | null;
};

export function toProject(row: ProjectListRow): Project {
	return {
		id: row.id,
		name: row.name,
		color: row.color,
		noteCount: row.note_count,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function toNote(row: NoteRow): Note {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		body: row.body,
		images: parseImages(row.images),
		pinnedAt: row.pinned_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/**
 * How much of the body a list row carries. The full text is on the note page.
 *
 * Exported because the list query clips with the same number, so the database
 * never hauls out a whole note to have it thrown away here.
 */
export const PREVIEW_LENGTH = 300;

export function toNotePreview(row: NoteRow): NotePreview {
	return {
		id: row.id,
		title: row.title,
		preview: row.body.slice(0, PREVIEW_LENGTH),
		images: parseImages(row.images),
		pinnedAt: row.pinned_at,
	};
}

/**
 * Read the stored images column.
 *
 * Never throws. A column that somehow holds something other than an array of
 * strings costs the note its thumbnails, which is recoverable; throwing here
 * would cost the note its text, which is not.
 */
function parseImages(value: string): string[] {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((key): key is string => typeof key === "string");
	} catch {
		return [];
	}
}
