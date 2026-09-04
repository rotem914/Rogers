/* Home. The grid of project tiles arrives at plan step 4.1.
 *
 * Until then it reads the health route, which is not decoration: it exercises
 * the whole path, screen to hook to API client to Worker, so a break in any of
 * them is visible on the first screen instead of at step 4.1. */

import type { Health } from "../../shared/types";
import { useApi } from "../lib/useApi";
import { TopBar } from "../components/TopBar";

export function Home() {
	const { data, loading, error } = useApi<Health>("/api/health");

	return (
		<>
			<TopBar title="Rogers" />

			<main className="mx-auto max-w-2xl px-4 py-10">
				<p className="text-muted">
					{loading && "Loading."}
					{error !== null && `The API did not answer: ${error}`}
					{data !== null && `The API answered: ${data.service} is up.`}
				</p>

				<p className="mt-6 text-faint">
					Projects arrive at plan step 4.1.
				</p>
			</main>
		</>
	);
}
