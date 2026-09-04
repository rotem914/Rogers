/* The service worker, and it does exactly one thing: when the network is down
 * and the app is opened, it shows a dark offline page instead of the browser's
 * error screen.
 *
 * It caches nothing else on purpose. Every page and every API answer sits
 * behind Cloudflare Access, and a cache that kept a login page under an API
 * address would serve it back later as if it were data. So: one file, the
 * offline page, fetched at install, and used only when a navigation fails. */

const CACHE = "rogers-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.add(new Request(OFFLINE, { credentials: "same-origin" })))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	/* Only page loads. API calls, pictures and scripts go straight through,
	   and fail the honest way if the network is gone. */
	if (event.request.mode !== "navigate") return;

	event.respondWith(
		fetch(event.request).catch(() => caches.match(OFFLINE)),
	);
});
