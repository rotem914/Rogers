/* Reading data from the API inside a screen.
 *
 * Deliberately small. PLAN.md chose plain fetch over a query library, so this
 * is the whole data layer for reads: it refetches when the screen mounts or its
 * path changes, and it exposes the three states a screen has to render. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "../platform/api-client";

export type ApiState<T> = {
	data: T | null;
	/** True until the first answer arrives; a refetch keeps the old data visible. */
	loading: boolean;
	error: string | null;
	refetch: () => void;
};

export type ApiOptions = {
	/**
	 * Show the last answer this path gave, at once, while a fresh one is fetched.
	 *
	 * For lists only. A screen that edits what it reads must not opt in: the
	 * note editor seeds itself from the first answer and never from a later one,
	 * so a remembered copy there would be typed over and then saved, which is
	 * exactly the overwrite the project forbids.
	 */
	remember?: boolean;
};

/* The last answer per path. Navigating between screens unmounts and remounts
   them, so without this every visit starts blank and waits a round trip for
   something it showed a moment ago.

   It is mirrored into the browser's local storage, so a reload, a new tab, a
   restarted browser, or the trip through the login when the session expires,
   all paint the same way. Rotem chose local over session storage on 2026-09-07
   knowing the cost: the titles and previews stay on the machine until Rogers
   overwrites them, logged out or not. Bump the version whenever a list's shape
   changes, so an old copy is never handed to a screen expecting the new one. */
const STORAGE_KEY = "rogers.lists.v2";
const remembered = readStored();

function readStored(): Map<string, unknown> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null) return new Map();
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		return new Map(Object.entries(parsed));
	} catch {
		/* No storage, or an unreadable copy: start empty, the network fills it. */
		return new Map();
	}
}

/* How many lists are kept. A path is moved to the end each time it answers, so
   what falls off the front is the list visited longest ago; without a ceiling
   every project and tab ever opened would stay on the machine until the storage
   quota refused the next write, silently, and remembering would stop for good. */
const REMEMBER_LIMIT = 40;

function persist(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(remembered)));
	} catch {
		/* Full or forbidden storage costs the next reload one round trip, no more. */
	}
}

function store(path: string, answer: unknown): void {
	remembered.delete(path);
	remembered.set(path, answer);
	while (remembered.size > REMEMBER_LIMIT) {
		const oldest = remembered.keys().next().value;
		if (oldest === undefined) break;
		remembered.delete(oldest);
	}
	persist();
}

/* A path that answered 404 is gone, an archived project or a removed tab, and
   its remembered list must not paint again on the next visit to that address. */
function forget(path: string): void {
	if (!remembered.delete(path)) return;
	persist();
}

function recall<T>(path: string | null, remember: boolean): T | null {
	if (!remember || path === null) return null;
	return (remembered.get(path) as T | undefined) ?? null;
}

/* Prefetches under way, so a tile hovered twice asks once. */
const prefetching = new Set<string>();

/**
 * Fetch `path` ahead of the screen that will read it with `remember`, so that
 * screen's first paint has the list already. Skipped when the answer is known
 * or already on its way; the screen refreshes it on open anyway. A failure is
 * dropped in silence, because the screen will ask again and say so itself.
 */
export function prefetch(path: string): void {
	if (remembered.has(path) || prefetching.has(path)) return;
	prefetching.add(path);
	apiFetch<unknown>(path)
		.then((result) => store(path, result))
		.catch(() => {})
		.finally(() => prefetching.delete(path));
}

/**
 * Fetch `path` and keep it in state.
 *
 * Pass null to hold off, for a screen whose address is not known yet.
 */
export function useApi<T>(path: string | null, options: ApiOptions = {}): ApiState<T> {
	const remember = options.remember === true;
	const [data, setData] = useState<T | null>(() => recall<T>(path, remember));
	const [loading, setLoading] = useState(path !== null && data === null);
	const [error, setError] = useState<string | null>(null);

	/* Every run gets a number, and only the newest one is allowed to write to
	   state. Without this, a slow first request can land after a fast second one
	   and put stale data on screen, which is the read-side version of the save
	   race the project forbids. */
	const runRef = useRef(0);

	const load = useCallback(() => {
		if (path === null) {
			setData(null);
			setLoading(false);
			setError(null);
			return;
		}

		const run = ++runRef.current;
		setError(null);

		/* A remembered answer goes on screen first; the fetch below replaces it. */
		const known = recall<T>(path, remember);
		if (known !== null) {
			setData(known);
			setLoading(false);
		} else {
			setLoading(true);
		}

		apiFetch<T>(path)
			.then((result) => {
				if (run !== runRef.current) return;
				if (remember) store(path, result);
				setData(result);
				setLoading(false);
			})
			.catch((cause: unknown) => {
				if (run !== runRef.current) return;
				if (cause instanceof ApiError && cause.status === 404) forget(path);
				setError(cause instanceof Error ? cause.message : "Something broke.");
				setLoading(false);
			});
	}, [path, remember]);

	/* The synchronous state writes in `load` are the remembered answer going on
	   screen before the fetch, one render, on purpose: an effect that only set
	   loading and waited would paint the screen blank for a frame first. */
	// eslint-disable-next-line react-hooks/set-state-in-effect
	useEffect(load, [load]);

	return { data, loading, error, refetch: load };
}
