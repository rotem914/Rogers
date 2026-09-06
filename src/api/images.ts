/* Pictures: taking one in, handing one back.
 *
 * A note stores keys, never bytes. The browser uploads a file here, gets a key,
 * and writes that key into the note's image list through the normal save. The
 * image itself is served from the bucket by key.
 *
 * Keys are made here, never accepted from the client, so a key is always a
 * uuid plus a known extension and can never be a path into somewhere else.
 *
 * A small copy for lists lives beside each picture under `thumb/<key>`. The
 * browser makes it after the upload and sends it here; a list asks for it with
 * `?size=sm` and gets the original where there is none, so an old picture or a
 * failed copy only costs bandwidth, never a hole. */

import { Hono } from "hono";
import type { MissingThumbs, UploadResult } from "../shared/types";
import { errorBody } from "./http";

export const images = new Hono<{ Bindings: Env }>();

/** The kinds a note can hold, and the extension each one gets. */
const EXTENSIONS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/avif": "avif",
};

/** Ten megabytes. A screenshot is well under one; this is a ceiling, not a target. */
const MAX_BYTES = 10 * 1024 * 1024;

/** What a key made here looks like, and therefore the only shape served back. */
const KEY = /^[0-9a-f-]{36}\.(png|jpg|gif|webp|avif)$/;

images.post("/upload", async (c) => {
	const type = (c.req.header("content-type") ?? "").split(";")[0].trim();
	const extension = EXTENSIONS[type];
	if (extension === undefined) {
		return c.json(errorBody("Only PNG, JPEG, GIF, WebP and AVIF images can be added."), 415);
	}

	/* Refuse by the declared length first, so a huge upload is turned away
	   before it is read, then by the real length, because a header is a claim. */
	const declared = Number(c.req.header("content-length") ?? "0");
	if (declared > MAX_BYTES) {
		return c.json(errorBody("That image is over 10 MB."), 413);
	}
	const bytes = await c.req.arrayBuffer();
	if (bytes.byteLength === 0) {
		return c.json(errorBody("The upload was empty."), 400);
	}
	if (bytes.byteLength > MAX_BYTES) {
		return c.json(errorBody("That image is over 10 MB."), 413);
	}

	const key = `${crypto.randomUUID()}.${extension}`;
	await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType: type } });

	return c.json<UploadResult>({ key }, 201);
});

/**
 * The pictures that have no small copy yet, so the browser can make them.
 *
 * Pictures from before the copies existed, and any whose copy failed to
 * arrive. GIFs are left out: a still copy would stop them, so the list shows
 * the original on purpose and they must not be asked for again and again.
 */
images.get("/thumbs/missing", async (c) => {
	const originals = new Set<string>();
	const copies = new Set<string>();
	let cursor: string | undefined;
	do {
		const page = await c.env.IMAGES.list({ cursor, limit: 1000 });
		for (const object of page.objects) {
			if (object.key.startsWith("thumb/")) copies.add(object.key.slice("thumb/".length));
			else if (KEY.test(object.key) && !object.key.endsWith(".gif")) originals.add(object.key);
		}
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor !== undefined);
	const missing = [...originals].filter((key) => !copies.has(key));
	return c.json<MissingThumbs>({ keys: missing });
});

/** The small copy of a picture, made by the browser once the original is up. */
images.put("/images/:key/thumb", async (c) => {
	const key = c.req.param("key");
	if (!KEY.test(key)) {
		return c.json(errorBody("That is not an image key."), 400);
	}
	const type = (c.req.header("content-type") ?? "").split(";")[0].trim();
	if (EXTENSIONS[type] === undefined) {
		return c.json(errorBody("Only PNG, JPEG, GIF, WebP and AVIF images can be added."), 415);
	}
	/* Only a picture that exists gets a copy, so a stray key writes nothing. */
	if ((await c.env.IMAGES.head(key)) === null) {
		return c.json(errorBody("No such image."), 404);
	}
	const bytes = await c.req.arrayBuffer();
	if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
		return c.json(errorBody("The copy must be between one byte and 10 MB."), 400);
	}
	await c.env.IMAGES.put(`thumb/${key}`, bytes, { httpMetadata: { contentType: type } });
	/* JSON like every route: the API client reads a bodiless answer as a login page. */
	return c.json<UploadResult>({ key }, 201);
});

images.get("/images/:key", async (c) => {
	const key = c.req.param("key");
	if (!KEY.test(key)) {
		return c.json(errorBody("That is not an image key."), 400);
	}

	/* `?size=sm` prefers the small copy and falls back to the original. */
	const small = c.req.query("size") === "sm";
	const copy = small ? await c.env.IMAGES.get(`thumb/${key}`) : null;
	const object = copy ?? (await c.env.IMAGES.get(key));
	if (object === null) {
		return c.json(errorBody("No such image."), 404);
	}
	/* The original standing in for a missing copy is the one answer that may
	   change: once the copy exists this address should serve it, so the browser
	   is told to ask again rather than keep the stand-in for a year. */
	const standIn = small && copy === null;

	/* A key is unique and its bytes never change, so the browser may keep the
	   picture for as long as it likes. `private` because it sits behind a login.
	   The ETag lets a reload cost a header exchange instead of a download. */
	const etag = object.httpEtag;
	if (c.req.header("if-none-match") === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}

	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
			"Content-Length": String(object.size),
			"Cache-Control": standIn ? "private, no-cache" : "private, max-age=31536000, immutable",
			ETag: etag,
		},
	});
});
