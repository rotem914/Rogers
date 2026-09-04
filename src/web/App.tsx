/* The three addresses Rogers has.
 *
 * Home is the project grid, /p/:id is one project's list of notes, /n/:id is
 * one note on its own page. Each is a real address, so a note can be opened
 * directly, reloaded, or kept in a tab.
 *
 * The router type is a platform decision, not a preference: real paths need a
 * server that answers every address with the app shell, which the Worker does.
 * A bundled desktop build loads from a file and only hash addresses survive a
 * reload there, so plan step 8 flips this by changing platform.ts alone. */

import { BrowserRouter, HashRouter, Link, Route, Routes } from "react-router";
import { usePathRouting } from "./platform/platform";
import { Home } from "./pages/Home";
import { Project } from "./pages/Project";
import { Note } from "./pages/Note";

const Router = usePathRouting ? BrowserRouter : HashRouter;

function App() {
	return (
		<Router>
			<div className="min-h-screen bg-bg text-text">
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/p/:id" element={<Project />} />
					<Route path="/n/:id" element={<Note />} />
					<Route path="*" element={<NotFound />} />
				</Routes>
			</div>
		</Router>
	);
}

/* An address that matches nothing. The Worker returns the app shell for every
 * path, so a typo lands here rather than on a server error page. */
function NotFound() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-10">
			<p className="text-muted">That address does not exist.</p>
			<Link className="mt-6 inline-block text-accent hover:underline" to="/">
				Back to Rogers
			</Link>
		</main>
	);
}

export default App;
