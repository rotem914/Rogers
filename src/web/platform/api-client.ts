/* The only way the app talks to the Worker.
 *
 * Everything goes through here so that two things are handled once instead of
 * in every screen: where the API lives (platform.ts), and what an expired
 * Access session looks like (session.ts). */

import { apiBaseUrl } from "./platform";
import { expireSession } from "./session";

/** A request that reached the Worker and came back as a real failure. */
export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

/**
 * Did Access answer instead of the Worker?
 *
 * Four shapes, and only the last one is obvious:
 *
 * - an opaque redirect, which is what `redirect: "manual"` turns Access's 302
 *   into, and its status reads as 0;
 * - a redirect status, if the runtime surfaces one directly;
 * - 401 or 403, which Access uses for an expired or refused session;
 * - a 200 whose body is the login page rather than JSON. This is the dangerous
 *   one: it looks like success, and only the content type gives it away.
 *
 * Exported because it is the part worth testing on its own, without reloading
 * the page to find out.
 */
export function isSessionExpired(response: Response): boolean {
	if (response.type === "opaqueredirect") return true;
	if (response.status === 0) return true;
	if (response.status >= 300 && response.status < 400) return true;
	if (response.status === 401 || response.status === 403) return true;

	const contentType = response.headers.get("content-type") ?? "";
	return !contentType.includes("json");
}

/**
 * Call the API and get parsed JSON back.
 *
 * `redirect: "manual"` is what makes the check above possible: without it the
 * browser quietly follows Access's redirect and hands back the login page under
 * the API's own address, which is indistinguishable from a broken endpoint.
 *
 * Throws ApiError for a real failure. Never returns on an expired session: it
 * parks unsaved text and reloads into the login.
 */
export async function apiFetch<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const response = await fetch(apiBaseUrl + path, {
		...init,
		redirect: "manual",
		credentials: "include",
		headers: {
			Accept: "application/json",
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
		},
	});

	if (isSessionExpired(response)) {
		expireSession();
		// The reload is asynchronous, so this promise must never resolve into a
		// caller that would then render an error over a page about to disappear.
		return new Promise<T>(() => {});
	}

	if (!response.ok) {
		throw new ApiError(response.status, await readErrorMessage(response));
	}

	return (await response.json()) as T;
}

/** Prefer the Worker's own message; fall back to the status line. */
async function readErrorMessage(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === "string" && body.error) return body.error;
	} catch {
		// Not JSON, or empty. The status text below is all there is.
	}
	return response.statusText || `Request failed with status ${response.status}`;
}
