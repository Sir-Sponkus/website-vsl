// Detects when a person starts / stops signing from per-frame hand landmarks.
// Signing = at least one hand visible AND its wrist moving. Pure and framework-free.
// Tuned on the reference videos: a still hand measures <= 0.05/s, signing mostly 0.1-0.6/s,
// and starting more than ~0.5 s into a sign costs recognition accuracy.
export const START_MS = 100; // keep moving this long before 'start'
export const STOP_MS = 900; // no motion (or no hands) this long before 'stop'
export const MOVE_SPEED = 0.1; // wrist speed in normalized image units per second
const GAP_MS = 250; // tracking dropouts shorter than this don't break a motion streak
const TAIL_KEEP_MS = 200; // idle time kept at the end of a recording

/** A recording that ended on 'stop' has STOP_MS of idle frames at the end; keep only TAIL_KEEP_MS. */
export function trimIdleTail<T>(frames: T[], recordedMs: number): T[] {
	const drop = Math.round((frames.length * (STOP_MS - TAIL_KEEP_MS)) / recordedMs);
	return frames.slice(0, Math.max(0, frames.length - drop));
}

export type SigningEvent = 'start' | 'stop' | null;
type Point = { x: number; y: number };

export function createSigningDetector() {
	let active = false;
	let movingSince: number | null = null; // start of the current moving streak
	let lastMove = 0;
	let prev: Point[] = [];
	let prevT = 0;

	return {
		get active() {
			return active;
		},
		reset() {
			active = false;
			movingSince = null;
			prev = [];
		},
		// hands: landmark arrays as given by HandLandmarker (index 0 = wrist); t in ms.
		update(hands: Point[][], t: number): SigningEvent {
			const wrists = hands.map((h) => h[0]).filter(Boolean);
			let moving = false;
			if (wrists.length && wrists.length === prev.length && t > prevT) {
				const dt = (t - prevT) / 1000;
				moving = wrists.some((w, i) => Math.hypot(w.x - prev[i].x, w.y - prev[i].y) / dt > MOVE_SPEED);
			}
			prev = wrists;
			prevT = t;

			if (moving) {
				lastMove = t;
				movingSince ??= t;
			} else if (!wrists.length || t - lastMove > GAP_MS) {
				movingSince = null; // streak broken
			}

			if (!active && movingSince !== null && t - movingSince >= START_MS) {
				active = true;
				return 'start';
			}
			if (active && t - lastMove >= STOP_MS) {
				active = false;
				movingSince = null;
				return 'stop';
			}
			return null;
		}
	};
}
