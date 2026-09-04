/* One project: the list of notes, with the composer at the top.
 * The real screen arrives at plan steps 4.3 to 4.5. */

import { useParams } from "react-router";
import { TopBar } from "../components/TopBar";

export function Project() {
	const { id } = useParams<{ id: string }>();

	return (
		<>
			<TopBar backTo="/" title="Project" />

			<main className="mx-auto max-w-2xl px-4 py-10">
				<p className="text-muted">
					Project <span className="text-text">{id}</span>.
				</p>

				<p className="mt-6 text-faint">
					The note list and the composer arrive at plan steps 4.3 to 4.5.
				</p>
			</main>
		</>
	);
}
