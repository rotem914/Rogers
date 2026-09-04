/* Getting a picture from the clipboard, a drop, or a file picker into a note.
 *
 * A note stores keys, never bytes: the file goes to the upload route, the key
 * comes back, and the key is appended to the note's image list through the
 * same autosave every keystroke uses. */

import type { UploadResult } from "../../shared/types";
import { apiBaseUrl } from "../platform/platform";
import { ApiError, apiFetch } from "../platform/api-client";

const ACCEPTED = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

/** What the file picker and the drop zone accept, in the browser's own words. */
export const ACCEPT_ATTRIBUTE = ACCEPTED.join(",");

/** The picture files in a paste or a drop, in the order they were given. */
export function imageFiles(list: DataTransfer | null): File[] {
	if (list === null) return [];
	return [...list.files].filter((file) => ACCEPTED.includes(file.type));
}

/**
 * Upload one picture and answer its key.
 *
 * Checked here first so a wrong file gets a message at once instead of a round
 * trip; the Worker checks again, because a client check is a courtesy.
 */
export async function uploadImage(file: File): Promise<string> {
	if (!ACCEPTED.includes(file.type)) {
		throw new ApiError(415, "Only PNG, JPEG, GIF, WebP and AVIF images can be added.");
	}
	if (file.size > MAX_BYTES) {
		throw new ApiError(413, "That image is over 10 MB.");
	}
	const result = await apiFetch<UploadResult>("/api/upload", {
		method: "POST",
		headers: { "Content-Type": file.type },
		body: file,
	});
	return result.key;
}

/** Where a stored picture is shown from. Same origin on the web; the live address in a bundle. */
export function imageSrc(key: string): string {
	return `${apiBaseUrl}/api/images/${key}`;
}
