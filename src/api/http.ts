/* Reading requests and answering failures.
 *
 * Every failure in this Worker answers the same JSON shape. That is not a
 * style preference: the app reads a non-JSON answer under /api as proof that
 * Cloudflare Access served its login page, so an answer in any other shape
 * would sign Rotem out instead of showing him what went wrong. BugAtlas row 1
 * is the incident this rule came from. */

import type { ApiErrorBody } from "../shared/types";

/** Parse a JSON body, answering null instead of throwing on junk or nothing. */
export async function readJson<T>(request: Request): Promise<T | null> {
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
}

export function errorBody(message: string): ApiErrorBody {
	return { error: message };
}

/**
 * Is a client-supplied id usable?
 *
 * The browser makes its own ids so a note can appear before the server answers,
 * which means the id is untrusted input that ends up in an address. A uuid is
 * 36 characters; the ceiling here is loose enough not to argue with a client
 * that formats them differently, and tight enough that nothing absurd reaches
 * the database or a URL.
 */
export function isUsableId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value.length <= 64 &&
		/^[A-Za-z0-9_-]+$/.test(value)
	);
}
