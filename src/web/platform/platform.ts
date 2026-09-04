/* What the app is running inside.
 *
 * The whole point of this file is that no screen, hook or component ever asks
 * the question. They import these constants, so the same build runs as a
 * website, as an installed PWA, and later inside a Tauri window, with no
 * branching scattered through the app.
 *
 * Plan step 8 is the desktop shell. It changes this file and nothing else. */

export type Platform = "web" | "tauri";

/** Tauri injects this global before any app code runs. */
export const platform: Platform =
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
		? "tauri"
		: "web";

/**
 * Where the API lives.
 *
 * Empty on the web, because the Worker serves the app and the API from one
 * origin, so a relative path is correct and carries the Access cookie by
 * itself. A bundled desktop build has no origin of its own and sets
 * VITE_API_BASE_URL to the live address at build time.
 */
export const apiBaseUrl: string = (
	import.meta.env.VITE_API_BASE_URL ?? ""
).replace(/\/$/, "");

/**
 * Whether addresses can be real paths.
 *
 * The browser and the thin Tauri shell both load the app over http, so real
 * paths work and a note address can be opened directly. A bundled build loads
 * from a file, where only hash addresses survive a reload.
 */
export const usePathRouting: boolean =
	platform === "web" || window.location.protocol.startsWith("http");
