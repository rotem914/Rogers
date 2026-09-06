/* The Worker. Everything under /api is answered here; every other address is
 * served the app shell by the assets binding, which is what makes a note
 * address load directly. */

import { Hono } from "hono";
import type { ApiErrorBody, Health } from "../shared/types";
import { projects } from "./projects";
import { notes, projectNotes } from "./notes";
import { projectTabs } from "./tabs";
import { images } from "./images";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json<Health>({ ok: true, service: "rogers" }));

app.route("/api/projects", projects);
app.route("/api/projects/:projectId/notes", projectNotes);
app.route("/api/projects/:projectId/tabs", projectTabs);
app.route("/api/notes", notes);
app.route("/api", images);

/* Every failure answers JSON, without exception.
 *
 * This is not tidiness. The app treats a non-JSON answer under /api as proof
 * that Cloudflare Access has served its login page instead of the Worker, and
 * responds by reloading into the login. So a crash that answered plain text
 * would sign the user out rather than show an error, and the cause would be
 * invisible. The shape is the contract; onError is what guarantees it even for
 * a failure nobody predicted.
 *
 * The message is deliberately generic: the detail goes to the Worker log,
 * where observability is on, not to the browser. */
app.onError((error, c) => {
	console.error("Unhandled error", error);
	return c.json<ApiErrorBody>({ error: "Something went wrong." }, 500);
});

/* An unknown address under /api answers JSON too, for the same reason. */
app.notFound((c) =>
	c.json<ApiErrorBody>({ error: "That address does not exist." }, 404),
);

export default app;
