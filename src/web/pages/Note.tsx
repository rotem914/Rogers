/* One note, on its own page: title, body, images, and a way back.
 * The real screen arrives at plan step 4.6.
 *
 * The back arrow points at Home for now. It becomes the note's own project once
 * a note knows which project it belongs to, which is the database at phase 2.
 * It is deliberately not browser history: a note address opened directly, from
 * a link or a reload, has no history to go back to. */

import { useParams } from "react-router";
import { TopBar } from "../components/TopBar";

export function Note() {
	const { id } = useParams<{ id: string }>();

	return (
		<>
			<TopBar backTo="/" title="Note" />

			<main className="mx-auto max-w-2xl px-4 py-10">
				<p className="text-muted">
					Note <span className="text-text">{id}</span>.
				</p>

				<p className="mt-6 text-faint">
					The editor and its autosave arrive at plan step 4.6.
				</p>
			</main>
		</>
	);
}
