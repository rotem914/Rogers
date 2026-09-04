/* Pictures: taking one in, handing one back.
 *
 * A note stores keys, never bytes. The browser uploads a file here, gets a key,
 * and writes that key into the note's image list through the normal save. The
 * image itself is served from the bucket by key.
 *
 * Keys are made here, never accepted from the client, so a key is always a
 * uuid plus a known extension and can never be a path into somewhere else. */

import { Hono } from "hono";
import type { UploadResult } from "../shared/types";
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

images.get("/images/:key", async (c) => {
	const key = c.req.param("key");
	if (!KEY.test(key)) {
		return c.json(errorBody("That is not an image key."), 400);
	}

	const object = await c.env.IMAGES.get(key);
	if (object === null) {
		return c.json(errorBody("No such image."), 404);
	}

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
			"Cache-Control": "private, max-age=31536000, immutable",
			ETag: etag,
		},
	});
});
