/* Reading data from the API inside a screen.
 *
 * Deliberately small. PLAN.md chose plain fetch over a query library, so this
 * is the whole data layer for reads: it refetches when the screen mounts or its
 * path changes, and it exposes the three states a screen has to render. */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../platform/api-client";

export type ApiState<T> = {
	data: T | null;
	/** True until the first answer arrives; a refetch keeps the old data visible. */
	loading: boolean;
	error: string | null;
	refetch: () => void;
};

/**
 * Fetch `path` and keep it in state.
 *
 * Pass null to hold off, for a screen whose address is not known yet.
 */
export function useApi<T>(path: string | null): ApiState<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(path !== null);
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
		setLoading(true);
		setError(null);

		apiFetch<T>(path)
			.then((result) => {
				if (run !== runRef.current) return;
				setData(result);
				setLoading(false);
			})
			.catch((cause: unknown) => {
				if (run !== runRef.current) return;
				setError(cause instanceof Error ? cause.message : "Something broke.");
				setLoading(false);
			});
	}, [path]);

	useEffect(load, [load]);

	return { data, loading, error, refetch: load };
}
