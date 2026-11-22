import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import * as ort from 'onnxruntime-web/webgpu';
import { asset } from '$app/paths';

// Keep in sync with the installed @mediapipe/tasks-vision version.
const MEDIAPIPE_VERSION = '1.0.0';
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const POSE_MODEL_URL =
	'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL_URL =
	'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type RecognitionModels = {
	poseLandmarker: PoseLandmarker;
	handLandmarker: HandLandmarker;
	/** null when the ONNX model could not be loaded. */
	session: ort.InferenceSession | null;
	labels: string[];
};

let modelsPromise: Promise<RecognitionModels> | null = null;

async function loadSession(): Promise<ort.InferenceSession | null> {
	try {
		return await ort.InferenceSession.create(asset('/spoter/spoter.onnx'), {
			executionProviders: ['wasm']
		});
	} catch (error) {
		console.warn('Unable to load the ONNX model', error);
		return null;
	}
}

export async function loadLabels(): Promise<string[]> {
	try {
		const response = await fetch(asset('/spoter/labels.json'));
		if (!response.ok) return [];
		const parsed = await response.json();
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		console.warn('Unable to load labels', error);
		return [];
	}
}

async function init(): Promise<RecognitionModels> {
	const vision = await FilesetResolver.forVisionTasks(WASM_URL);

	const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
		baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
		runningMode: 'VIDEO',
		numPoses: 1
	});

	const handLandmarker = await HandLandmarker.createFromOptions(vision, {
		baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
		runningMode: 'VIDEO',
		numHands: 2
	});

	const [session, labels] = await Promise.all([loadSession(), loadLabels()]);

	return { poseLandmarker, handLandmarker, session, labels };
}

/**
 * Lazily creates the landmarkers and ONNX session once and shares them between pages.
 * A failed load is not cached, so the next call retries.
 */
export function loadModels(): Promise<RecognitionModels> {
	if (!modelsPromise) {
		modelsPromise = init().catch((error) => {
			modelsPromise = null;
			throw error;
		});
	}
	return modelsPromise;
}

// MediaPipe VIDEO mode requires strictly increasing timestamps for the lifetime of a
// landmarker instance. Since the instances are shared between pages, every caller must
// obtain timestamps from here.
let lastTimestamp = 0;

export function peekLastTimestamp(): number {
	return lastTimestamp;
}

export function monotonicTimestamp(candidateMs: number): number {
	const ts = Math.max(Math.round(candidateMs), lastTimestamp + 1);
	lastTimestamp = ts;
	return ts;
}
