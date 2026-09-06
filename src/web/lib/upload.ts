/* Getting a picture from the clipboard, a drop, or a file picker into a note.
 *
 * A note stores keys, never bytes: the file goes to the upload route, the key
 * comes back, and the key is appended to the note's image list through the
 * same autosave every keystroke uses. */

import type { MissingThumbs, UploadResult } from "../../shared/types";
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
	/* The small copy is drawn while the original uploads, and sent right after,
	   before the key is handed back: a list must never ask for the copy before
	   it exists, or the browser would keep the full picture under the small
	   address for a year. A copy that cannot be made or sent is simply absent,
	   and the list gets the original. */
	const thumbnail = makeThumbnail(file);
	const result = await apiFetch<UploadResult>("/api/upload", {
		method: "POST",
		headers: { "Content-Type": file.type },
		body: file,
	});
	const small = await thumbnail;
	if (small !== null) {
		try {
			await putThumbnail(result.key, small);
		} catch {
			/* The original is up and in the note; the row will show that instead. */
		}
	}
	return result.key;
}

/** The shorter side of a list copy, in pixels: a 216px row thumbnail at 2x, with room. */
const THUMB_SHORT_SIDE = 480;
/** And a ceiling on the longer side, so a very tall or wide picture stays small. */
const THUMB_LONG_SIDE = 1600;

/**
 * A small WebP copy of a picture, for lists.
 *
 * A picture already small enough is its own copy, so that every non-GIF has
 * one and the backfill below never asks for it again. Null for a GIF, which
 * may move and would be stopped by a still copy, and for a picture that cannot
 * be drawn here; both then serve the list as the original.
 */
async function makeThumbnail(file: Blob): Promise<Blob | null> {
	if (file.type === "image/gif") return null;
	try {
		const bitmap = await createImageBitmap(file);
		const { width, height } = bitmap;
		const scale = Math.min(
			1,
			THUMB_SHORT_SIDE / Math.min(width, height),
			THUMB_LONG_SIDE / Math.max(width, height),
		);
		if (scale === 1) {
			bitmap.close();
			return file;
		}
		const w = Math.max(1, Math.round(width * scale));
		const h = Math.max(1, Math.round(height * scale));
		const canvas = new OffscreenCanvas(w, h);
		const context = canvas.getContext("2d");
		if (context === null) {
			bitmap.close();
			return null;
		}
		context.drawImage(bitmap, 0, 0, w, h);
		bitmap.close();
		return await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
	} catch {
		return null;
	}
}

/** Where a stored picture is shown from. Same origin on the web; the live address in a bundle. */
export function imageSrc(key: string, size: "full" | "sm" = "full"): string {
	return `${apiBaseUrl}/api/images/${key}${size === "sm" ? "?size=sm" : ""}`;
}

/** Send a picture's small copy; a failure is the caller's to ignore. */
async function putThumbnail(key: string, small: Blob): Promise<void> {
	await apiFetch<UploadResult>(`/api/images/${key}/thumb`, {
		method: "PUT",
		headers: { "Content-Type": small.type },
		body: small,
	});
}

let backfilling = false;

/**
 * Make the small copies the pictures from before 2026-09-07 never had.
 *
 * Runs once per page, a while after the app opens so it never competes with
 * the first paint: asks the Worker which pictures have no copy, then for each
 * one downloads the original, draws the copy here and sends it, one picture
 * at a time. Anything that fails is left for the next visit, and once every
 * picture has its copy the Worker answers an empty list and this costs one
 * request.
 */
export async function backfillThumbnails(): Promise<void> {
	if (backfilling) return;
	backfilling = true;
	try {
		const { keys } = await apiFetch<MissingThumbs>("/api/thumbs/missing");
		for (const key of keys) {
			try {
				/* The bytes themselves, not JSON, so this is the one read that does
				   not go through the API client; a login page in its place is not an
				   image and is dropped by the type check. */
				const response = await fetch(imageSrc(key), { credentials: "include" });
				const type = response.headers.get("content-type") ?? "";
				if (!response.ok || !type.startsWith("image/")) continue;
				const small = await makeThumbnail(await response.blob());
				if (small !== null) await putThumbnail(key, small);
			} catch {
				/* Next visit. */
			}
		}
	} catch {
		/* No list, no work; the lists show the originals as they did before. */
	} finally {
		backfilling = false;
	}
}
