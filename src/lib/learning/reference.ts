import { asset } from '$app/paths';
import { averageMetrics } from '$lib/learning/geometricFeedback';
import type { PracticeMetrics } from '$lib/learning/geometricFeedback';
import { detectFrame } from '$lib/sign-recognition/frameCapture';
import { loadModels, monotonicTimestamp } from '$lib/sign-recognition/models';
import type { CapturedFrame } from '$lib/sign-recognition/pipeline';

export type Reference = {
	frames: CapturedFrame[];
	durationMs: number;
	/** width / height of the video, needed to draw the landmarks undistorted. */
	aspect: number;
	metrics: PracticeMetrics | null;
};

const SAMPLES = 30; // ~15 fps for the ~2 s clips
const cache = new Map<string, Promise<Reference | null>>();

function seek(video: HTMLVideoElement, time: number) {
	return new Promise<void>((resolve, reject) => {
		video.onseeked = () => resolve();
		video.onerror = () => reject(new Error('reference video error'));
		video.currentTime = time;
	});
}

async function analyse(videoPath: string): Promise<Reference | null> {
	try {
		const { poseLandmarker, handLandmarker } = await loadModels();
		const video = document.createElement('video');
		video.muted = true;
		video.preload = 'auto';
		video.src = asset(videoPath);
		await new Promise<void>((resolve, reject) => {
			video.onloadeddata = () => resolve();
			video.onerror = () => reject(new Error('reference video failed to load'));
		});

		const frames: CapturedFrame[] = [];
		for (let i = 0; i < SAMPLES; i += 1) {
			await seek(video, ((i + 0.5) / SAMPLES) * video.duration);
			// Shared landmarkers: timestamps must come from the same monotonic source as the camera.
			frames.push(detectFrame(video, poseLandmarker, handLandmarker, monotonicTimestamp(performance.now())));
		}

		const aspect = video.videoWidth / video.videoHeight || 1;
		return { frames, durationMs: video.duration * 1000, aspect, metrics: averageMetrics(frames, aspect) };
	} catch (error) {
		console.warn('Reference analysis failed, using visibility-only feedback', error);
		return null;
	}
}

/** Cached per word. Resolves to null on failure; callers fall back to visibility-only scoring. */
export function referenceFor(label: string, videoPath: string): Promise<Reference | null> {
	let entry = cache.get(label);
	if (!entry) {
		entry = analyse(videoPath);
		cache.set(label, entry);
		// A failure isn't cached, so it can be retried.
		void entry.then((r) => r ?? cache.delete(label));
	}
	return entry;
}
