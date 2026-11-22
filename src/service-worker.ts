/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { base, build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const SHELL = `shell-${version}`; // replaced on every deploy
// shortcut: media is cache-first and never refreshed; rename this when videos/model change.
const MEDIA = 'media-v1';

const isMedia = (path: string) =>
	path.startsWith(`${base}/videos/`) || path.startsWith(`${base}/spoter/`) || path.endsWith('.wasm');

// The 400 videos (~52 MB), the ONNX model and the ORT wasm (~51 MB) are cached on first use, not up front.
// shortcut: MediaPipe's wasm and models come from CDNs (cross-origin), so camera practice needs a network.
const SHELL_ASSETS = [...build, ...files, ...prerendered].filter((path) => !isMedia(path));

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== MEDIA).map((key) => caches.delete(key))))
			.then(() => sw.clients.claim())
	);
});

/** <video> asks for byte ranges; slice the cached full file into a 206. */
async function ranged(request: Request, full: Response): Promise<Response> {
	const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '');
	if (!match) return full;
	const blob = await full.blob();
	const start = match[1] ? Number(match[1]) : 0;
	const end = match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
	return new Response(blob.slice(start, end + 1), {
		status: 206,
		headers: {
			'Content-Type': full.headers.get('Content-Type') ?? 'video/mp4',
			'Content-Range': `bytes ${start}-${end}/${blob.size}`
		}
	});
}

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(MEDIA);
	let full = await cache.match(request.url);
	if (!full) {
		full = await fetch(request.url); // always the whole file, so it can be cached
		if (!full.ok) return full;
		await cache.put(request.url, full.clone());
	}
	return ranged(request, full);
}

async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(SHELL);
	try {
		const response = await fetch(request);
		if (response.ok) void cache.put(request, response.clone());
		return response;
	} catch (error) {
		const cached = await cache.match(request);
		if (cached) return cached;
		throw error;
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== sw.location.origin) return;

	if (isMedia(url.pathname)) event.respondWith(cacheFirst(request));
	else if (request.mode === 'navigate') event.respondWith(networkFirst(request));
	else if (SHELL_ASSETS.includes(url.pathname)) {
		// Hashed build files never change, so the precache is always right.
		event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
	}
});
