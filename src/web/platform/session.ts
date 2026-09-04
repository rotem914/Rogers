/* What happens when the Cloudflare Access session runs out.
 *
 * Access sits in front of the whole hostname. When the session expires it stops
 * answering the API with data and answers with its login page instead, or with
 * a redirect to it. A fetch that expects JSON and receives a login page throws
 * on parse, so without this file an expired session looks like the app
 * breaking, and whatever was being typed is lost.
 *
 * The rule this protects is the first project invariant: text already typed is
 * never lost. So the order is park first, reload second. */

const DRAFT_PREFIX = "rogers.draft.";

/**
 * Stash text where a reload cannot take it.
 *
 * sessionStorage, not localStorage: this is a rescue for one tab across one
 * reload, and it should not outlive the tab. Every call is guarded because a
 * browser with site data blocked throws on access rather than returning null.
 */
export function parkDraft(key: string, value: string): void {
	try {
		window.sessionStorage.setItem(DRAFT_PREFIX + key, value);
	} catch {
		// Storage blocked or full. Nothing to do: the reload still has to happen,
		// and a rescue that cannot be written must not stop it.
	}
}

/** Read a parked draft and remove it, so it is restored exactly once. */
export function takeParkedDraft(key: string): string | null {
	try {
		const value = window.sessionStorage.getItem(DRAFT_PREFIX + key);
		if (value !== null) window.sessionStorage.removeItem(DRAFT_PREFIX + key);
		return value;
	} catch {
		return null;
	}
}

type Flush = () => void;
const flushes = new Set<Flush>();

/**
 * Register something that holds unsaved text.
 *
 * The editor calls this and parks its own content when asked. Returns the
 * unregister function, so a component can drop its callback when it unmounts.
 */
export function onSessionExpired(flush: Flush): () => void {
	flushes.add(flush);
	return () => {
		flushes.delete(flush);
	};
}

let expiring = false;

/**
 * The session is gone: rescue what is on screen, then reload.
 *
 * Reloading is what shows the login, because Access intercepts the page request
 * itself. Several requests can fail at once, so this runs its body only once.
 */
export function expireSession(): void {
	if (expiring) return;
	expiring = true;

	for (const flush of flushes) {
		try {
			flush();
		} catch {
			// One editor failing to park must not stop the others, or the reload.
		}
	}

	window.location.reload();
}

/** Test seam: lets a check run the detection twice without reloading twice. */
export function resetExpiryGuardForTests(): void {
	expiring = false;
}
