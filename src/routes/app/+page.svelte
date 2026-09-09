<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import * as ort from 'onnxruntime-web/webgpu';
import {
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
  DrawingUtils
} from '@mediapipe/tasks-vision';
import "7.css/dist/7.css";


const TARGET_FRAMES = 60;
const POSE_KEEP = 33;
const HAND_JOINTS = 21;
const NUM_JOINTS = 75; 

interface PredictionItem {
  label: string;
  confidence: number;
  percentage: string;
}

const appState = $state({
  input: 'camera', // 'camera' or 'video'
  modelName: 'No model loaded',
  prediction: '—',
  topPredictions: [] as PredictionItem[],
  isLoading: false,
  videoFile: 'No video selected',
  isDetecting: false
});

let videoElement: HTMLVideoElement | null = null;
let session: ort.InferenceSession | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let rawFrameBuffer: number[][][] = []; // Array of [75][2]
let animFrameId: number | null = null;
let cameraStream: MediaStream | null = null;
let videoObjectUrl: string | null = null;
let canvasElement: HTMLCanvasElement | null = null;
let canvasCtx: CanvasRenderingContext2D | null = null;
let drawingUtils: DrawingUtils | null = null;
let labels = $state<string[]>([]);
let labelStatus = $state<string>('No labels loaded (using class numbers)');

let timestampOffset = 0;
let lastMediaPipeTimestamp = 0;


const CHA_XUONG_75: number[] = (() => {
	const cha = Array.from({ length: 75 }, (_, i) => i);

	
	const poseParent: Record<number, number> = {
		11: 11, 12: 11, 0: 11,
		13: 11, 15: 13, 17: 15, 19: 15, 21: 15,
		14: 12, 16: 14, 18: 16, 20: 16, 22: 16,
		23: 11, 24: 12, 25: 23, 26: 24, 27: 25, 28: 26,
		29: 27, 30: 28, 31: 29, 32: 30,
		1: 0, 2: 1, 3: 2, 4: 0, 5: 4, 6: 5, 7: 3, 8: 6, 9: 0, 10: 0
	};
	for (const [k, v] of Object.entries(poseParent)) {
		cha[+k] = v;
	}

	
	const tay = [0, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 0, 17, 18, 19];

	
	for (let i = 0; i < 21; i++) {
		cha[33 + i] = (i === 0) ? 15 : 33 + tay[i];
	}
	
	for (let i = 0; i < 21; i++) {
		cha[54 + i] = (i === 0) ? 16 : 54 + tay[i];
	}

	return cha;
})();

async function toggleDetection() {
	if (!appState.isDetecting) {
		rawFrameBuffer.length = 0;
		appState.isDetecting = true;
		appState.prediction = 'Recording gesture...';
		appState.topPredictions = [];

		if (appState.input === 'video' && videoElement) {
			await videoElement.play();
		}
	} else {
		appState.isDetecting = false;

		if (appState.input === 'video' && videoElement) {
			videoElement.pause();
		}

		appState.prediction = 'Analyzing sign...';
		await runInferenceForWindow();
		rawFrameBuffer.length = 0;
	}
}

function getMonotonicTimestamp(videoCurrentTimeSec: number): number {
	let ts = Math.round((videoCurrentTimeSec * 1000) + timestampOffset);

	if (ts <= lastMediaPipeTimestamp) {
		timestampOffset = (lastMediaPipeTimestamp + 16) - Math.round(videoCurrentTimeSec * 1000);
		ts = Math.round((videoCurrentTimeSec * 1000) + timestampOffset);
	}

	lastMediaPipeTimestamp = ts;
	return ts;
}


function preprocessKeypoints(rawBuffer: number[][][], targetLen = TARGET_FRAMES): number[][][] {
	const T = rawBuffer.length;
	if (T === 0) {
		return Array.from({ length: targetLen }, () =>
			Array.from({ length: NUM_JOINTS }, () => [0, 0])
		);
	}

	
	const normalizedSeq: number[][][] = Array.from({ length: T }, () =>
		Array.from({ length: NUM_JOINTS }, () => [0, 0])
	);

	for (let t = 0; t < T; t++) {
		const l = rawBuffer[t][11]; // left shoulder
		const r = rawBuffer[t][12]; // right shoulder

		const cx = (l[0] + r[0]) / 2.0;
		const cy = (l[1] + r[1]) / 2.0;
		const dx = l[0] - r[0];
		const dy = l[1] - r[1];
		const width = Math.max(Math.hypot(dx, dy), 1e-5);

		for (let j = 0; j < NUM_JOINTS; j++) {
			const rawX = rawBuffer[t][j][0];
			const rawY = rawBuffer[t][j][1];
			const x = Number.isNaN(rawX) ? 0.0 : rawX;
			const y = Number.isNaN(rawY) ? 0.0 : rawY;

			normalizedSeq[t][j][0] = (x - cx) / width;
			normalizedSeq[t][j][1] = (y - cy) / width;
		}
	}

	
	if (T === targetLen) {
		return normalizedSeq;
	}

	const resampled: number[][][] = Array.from({ length: targetLen }, () =>
		Array.from({ length: NUM_JOINTS }, () => [0, 0])
	);

	for (let i = 0; i < targetLen; i++) {
		const idx = Math.floor((i * (T - 1)) / (targetLen - 1));
		const safeIdx = Math.min(Math.max(idx, 0), T - 1);
		for (let j = 0; j < NUM_JOINTS; j++) {
			resampled[i][j][0] = normalizedSeq[safeIdx][j][0];
			resampled[i][j][1] = normalizedSeq[safeIdx][j][1];
		}
	}

	return resampled;
}


function buildTensorData(kpXY: number[][][], numChannels: number, numViews: number): Float32Array {
	const T = TARGET_FRAMES;
	const K = NUM_JOINTS;

	const flatPerView = new Float32Array(T * K * numChannels);
	let idx = 0;

	for (let t = 0; t < T; t++) {
		for (let j = 0; j < K; j++) {
			const x = kpXY[t][j][0];
			const y = kpXY[t][j][1];

			if (numChannels === 2) {
				flatPerView[idx++] = x;
				flatPerView[idx++] = y;
			} else {
			
				const p = CHA_XUONG_75[j];
				const px = kpXY[t][p][0];
				const py = kpXY[t][p][1];
				const bx = x - px;
				const by = y - py;

				let mx = 0;
				let my = 0;
				if (t < T - 1) {
					mx = kpXY[t + 1][j][0] - x;
					my = kpXY[t + 1][j][1] - y;
				}

				flatPerView[idx++] = x;
				flatPerView[idx++] = y;
				flatPerView[idx++] = bx;
				flatPerView[idx++] = by;
				flatPerView[idx++] = mx;
				flatPerView[idx++] = my;
			}
		}
	}

	if (numViews === 1) {
		return flatPerView;
	}

	
	const flatMultiView = new Float32Array(numViews * flatPerView.length);
	for (let v = 0; v < numViews; v++) {
		flatMultiView.set(flatPerView, v * flatPerView.length);
	}
	return flatMultiView;
}

onMount(async () => {
	try {
		const vision = await FilesetResolver.forVisionTasks(
			'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
		);

		poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
				delegate: 'GPU'
			},
			runningMode: 'VIDEO',
			numPoses: 1
		});

		handLandmarker = await HandLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
				delegate: 'GPU'
			},
			runningMode: 'VIDEO',
			numHands: 2
		});

		await Promise.all([
			loadBundledModel(),
			loadBundledLabels()
		]);

		await startCamera();
		startDetectionLoop();
	} catch (err) {
		console.error('Setup error:', err);
	}
});

async function disposeSession() {
	if (!session) return;
	try {
		await session.release();
	} catch (err) {
		console.error('Error releasing session:', err);
	}
	session = null;
}

onDestroy(() => {
	if (animFrameId) cancelAnimationFrame(animFrameId);
	disposeSession().catch((err) => console.error('Session dispose error:', err));
	stopCamera();
	revokeVideoUrl();
});

async function startCamera() {
	stopCamera();
	revokeVideoUrl();

	if (videoElement) {
		videoElement.src = '';
		videoElement.srcObject = null;
	}

	try {
		cameraStream = await navigator.mediaDevices.getUserMedia({
			video: { width: 640, height: 480, frameRate: { ideal: 30 } },
			audio: false
		});
		if (videoElement) {
			videoElement.srcObject = cameraStream;
			await videoElement.play();
		}
	} catch (err) {
		console.error('Camera access error:', err);
	}
}

function stopCamera() {
	if (cameraStream) {
		cameraStream.getTracks().forEach((track) => track.stop());
		cameraStream = null;
	}
}

function revokeVideoUrl() {
	if (videoObjectUrl) {
		URL.revokeObjectURL(videoObjectUrl);
		videoObjectUrl = null;
	}
}

async function handleModeChange(newMode: 'camera' | 'video') {
	if (appState.input === newMode) return;
	appState.input = newMode;
	rawFrameBuffer = [];
	lastMediaPipeTimestamp = 0;
	timestampOffset = 0;
	appState.isDetecting = false;

	if (appState.input === 'camera') {
		await startCamera();
	} else {
		stopCamera();
		if (videoElement) {
			videoElement.srcObject = null;
			videoElement.src = '';
		}
		appState.videoFile = 'No video selected';
	}
}

function handleVideoUpload(event: Event) {
	const input = event.target as HTMLInputElement | null;
	const file = input?.files?.[0];
	if (!file) return;

	stopCamera();
	revokeVideoUrl();

	rawFrameBuffer = [];
	appState.topPredictions = [];
	appState.prediction = '—';
	appState.isDetecting = false;

	if (canvasCtx && canvasElement) {
		canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
	}

	videoObjectUrl = URL.createObjectURL(file);
	appState.videoFile = file.name;

	if (videoElement) {
		videoElement.srcObject = null;
		videoElement.src = videoObjectUrl;
		videoElement.loop = false;
	}
}

function handleVideoEnded() {
	if (appState.isDetecting && appState.input === 'video') {
		toggleDetection();
	}
}

function startDetectionLoop() {
	const processFrame = async () => {
		if (
			videoElement &&
			poseLandmarker &&
			handLandmarker &&
			videoElement.readyState >= 2 &&
			!videoElement.paused
		) {
			try {
				let timestamp: number;

				if (appState.input === 'camera') {
					timestamp = performance.now();
					if (timestamp <= lastMediaPipeTimestamp) timestamp = lastMediaPipeTimestamp + 16;
					lastMediaPipeTimestamp = timestamp;
				} else {
					timestamp = getMonotonicTimestamp(videoElement.currentTime);
				}

				const poseRes = poseLandmarker.detectForVideo(videoElement, timestamp);
				const handRes = handLandmarker.detectForVideo(videoElement, timestamp);

				// Canvas init & rendering
				if (!canvasCtx && canvasElement) {
					canvasCtx = canvasElement.getContext('2d');
					if (canvasCtx) drawingUtils = new DrawingUtils(canvasCtx);
				}

				if (canvasElement && videoElement && canvasCtx && drawingUtils) {
					if (
						canvasElement.width !== videoElement.videoWidth &&
						videoElement.videoWidth > 0
					) {
						canvasElement.width = videoElement.videoWidth;
						canvasElement.height = videoElement.videoHeight;
					}

					canvasCtx.save();
					canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

					// Draw pose skeleton
					if (poseRes.landmarks) {
						for (const landmark of poseRes.landmarks) {
							drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
							drawingUtils.drawLandmarks(landmark, { radius: 3, color: '#FF0000' });
						}
					}

					// Draw hands skeleton
					if (handRes.landmarks) {
						for (const landmarks of handRes.landmarks) {
							drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 });
							drawingUtils.drawLandmarks(landmarks, { radius: 2, color: '#0000FF' });
						}
					}

					canvasCtx.restore();
				}

				// Extract keypoints when recording
				if (appState.isDetecting) {
					// 33 Pose keypoints
					let posePoints: number[][];
					if (poseRes.landmarks && poseRes.landmarks.length > 0) {
						posePoints = poseRes.landmarks[0]
							.slice(0, POSE_KEEP)
							.map((pt) => [pt.x, pt.y]);
					} else {
						posePoints = Array.from({ length: POSE_KEEP }, () => [0, 0]);
					}

					// 21 Left + 21 Right Hand keypoints
					let leftHandPoints: number[][] = Array.from({ length: HAND_JOINTS }, () => [0, 0]);
					let rightHandPoints: number[][] = Array.from({ length: HAND_JOINTS }, () => [0, 0]);

					if (handRes.landmarks && handRes.handedness) {
						for (let h = 0; h < handRes.handedness.length; h++) {
							const label = handRes.handedness[h][0]?.categoryName;
							const pts = handRes.landmarks[h].map((pt) => [pt.x, pt.y]);
							if (label === 'Left') leftHandPoints = pts;
							else if (label === 'Right') rightHandPoints = pts;
						}
					}

					const currentFrame = [...posePoints, ...leftHandPoints, ...rightHandPoints]; // [75][2]
					rawFrameBuffer.push(currentFrame);

					if (rawFrameBuffer.length >= TARGET_FRAMES) {
						await toggleDetection();
					}
				}
			} catch (err) {
				console.error('Error during frame detection:', err);
			}
		}

		animFrameId = requestAnimationFrame(processFrame);
	};

	processFrame();
}

function softmax(logits: Float32Array): number[] {
	let maxVal = -Infinity;
	for (let i = 0; i < logits.length; i++) if (logits[i] > maxVal) maxVal = logits[i];

	const exps = new Float64Array(logits.length);
	let sumExps = 0;
	for (let i = 0; i < logits.length; i++) {
		const expVal = Math.exp(logits[i] - maxVal);
		exps[i] = expVal;
		sumExps += expVal;
	}

	const probs = new Array(logits.length);
	for (let i = 0; i < logits.length; i++) probs[i] = exps[i] / sumExps;
	return probs;
}

function getTopKPredictions(logits: Float32Array, labelsList: string[], k: number = 5) {
	const probabilities = softmax(logits);

	const rankedList = probabilities.map((prob, index) => ({
		label: labelsList[index] ?? `Class ${index}`,
		confidence: prob,
		percentage: (prob * 100).toFixed(1) + '%'
	}));

	rankedList.sort((a, b) => b.confidence - a.confidence);
	return rankedList.slice(0, k);
}

function formatTensorShape(dims: readonly (string | number)[] | undefined): string {
	if (!dims || dims.length === 0) return 'unknown';
	return `[${dims.map((d) => (typeof d === 'number' ? d : String(d))).join(', ')}]`;
}

function isDimCompatible(actual: string | number | undefined, expected: number): boolean {
	if (actual === undefined) return false;
	if (typeof actual === 'string') return true;
	if (actual === -1) return true;
	return actual === expected;
}

interface ModelInputConfig {
	numChannels: number;
	numViews: number;
	shape: number[];
}

function getModelInputConfig(sess: ort.InferenceSession): { ok: boolean; message: string; config?: ModelInputConfig } {
	const inputName = sess.inputNames?.[0];
	if (!inputName) {
		return { ok: false, message: 'Model has no input tensor.' };
	}

	const anySess = sess as any;
	let meta: { name?: string; shape?: (number | string)[]; dimensions?: (number | string)[]; type?: string } | undefined;

	if (Array.isArray(anySess.inputMetadata)) {
		meta = anySess.inputMetadata.find((m: any) => m?.name === inputName) ?? anySess.inputMetadata[0];
	} else if (anySess.inputMetadata && typeof anySess.inputMetadata === 'object') {
		meta = anySess.inputMetadata[inputName] ?? Object.values(anySess.inputMetadata)[0];
	}

	const actualDims = meta?.shape ?? meta?.dimensions;
	const actualType = meta?.type ?? 'unknown';

	if (!actualDims || actualDims.length === 0) {
		console.warn(`Could not determine dimensions for "${inputName}", defaulting to multi-view 6-channel input [1, 3, 60, 450].`);
		return {
			ok: true,
			message: `Defaulting to [1, 3, ${TARGET_FRAMES}, 450] (6-channel, 3-view).`,
			config: { numChannels: 6, numViews: 3, shape: [1, 3, TARGET_FRAMES, 450] }
		};
	}

	// 5D Tensor Shape: SPOTERChung multi-view unflattened [1, 3, 60, 75, C]
	if (actualDims.length === 5) {
		const vOk = isDimCompatible(actualDims[1], 3);
		const tOk = isDimCompatible(actualDims[2], TARGET_FRAMES);
		const kOk = isDimCompatible(actualDims[3], NUM_JOINTS);
		const channels = isDimCompatible(actualDims[4], 6) ? 6 : 2;
		const cOk = isDimCompatible(actualDims[4], channels);

		if (vOk && tOk && kOk && cOk) {
			return {
				ok: true,
				message: `Model input OK: "${inputName}" ${formatTensorShape(actualDims)} (${channels}-channel, 3-view).`,
				config: { numChannels: channels, numViews: 3, shape: [1, 3, TARGET_FRAMES, NUM_JOINTS, channels] }
			};
		}
	}

	// 4D Tensor Shape:
	if (actualDims.length === 4) {
		// Case A: Multi-view with flattened joint features [Batch, Views=3, Frames, Features (450 or 150)]
		// e.g. ['batch_size', 3, 'num_frames', 450] as exported from best.pt
		const isMultiViewFlattened = isDimCompatible(actualDims[1], 3) &&
			(isDimCompatible(actualDims[3], 450) || isDimCompatible(actualDims[3], 150));

		if (isMultiViewFlattened) {
			const channels = isDimCompatible(actualDims[3], 450) ? 6 : 2;
			return {
				ok: true,
				message: `Model input OK: "${inputName}" ${formatTensorShape(actualDims)} (${channels}-channel, 3-view, flattened features).`,
				config: { numChannels: channels, numViews: 3, shape: [1, 3, TARGET_FRAMES, NUM_JOINTS * channels] }
			};
		}

		// Case B: Single-view with unflattened keypoints [Batch, Frames=60, Joints=75, Channels=2 or 6]
		const tOk = isDimCompatible(actualDims[1], TARGET_FRAMES);
		const kOk = isDimCompatible(actualDims[2], NUM_JOINTS);
		const channels = isDimCompatible(actualDims[3], 6) ? 6 : 2;
		const cOk = isDimCompatible(actualDims[3], channels);

		if (tOk && kOk && cOk) {
			return {
				ok: true,
				message: `Model input OK: "${inputName}" ${formatTensorShape(actualDims)} (${channels}-channel, 1-view).`,
				config: { numChannels: channels, numViews: 1, shape: [1, TARGET_FRAMES, NUM_JOINTS, channels] }
			};
		}
	}

	return {
		ok: false,
		message: `Input shape mismatch for "${inputName}". Expected [1, 3, 60, 450], [1, 60, 75, 2/6], or [1, 3, 60, 75, 2/6], but model has ${formatTensorShape(actualDims)} (type: ${actualType}).`
	};
}

async function runInferenceForWindow() {
	if (!session || rawFrameBuffer.length < 10) {
		appState.prediction = 'Sequence too short';
		return;
	}

	appState.isLoading = true;
	try {
		const check = getModelInputConfig(session);
		if (!check.ok || !check.config) {
			console.error(check.message);
			appState.prediction = 'Incompatible model shape';
			return;
		}

		const { numChannels, numViews, shape } = check.config;
		const kpXY = preprocessKeypoints(rawFrameBuffer, TARGET_FRAMES);
		const tensorData = buildTensorData(kpXY, numChannels, numViews);
		const inputTensor = new ort.Tensor('float32', tensorData, shape);

		const inputName = session.inputNames?.[0] ?? 'input';
		const outputName = session.outputNames?.[0] ?? 'output';

		const outputs = await session.run({ [inputName]: inputTensor });
		const outputData = outputs[outputName].data as Float32Array;

		const topPredictions = getTopKPredictions(outputData, labels, 5);
		appState.topPredictions = topPredictions;
		appState.prediction = topPredictions[0]?.label ?? 'Unknown';
	} catch (err) {
		console.error('Inference error:', err);
		appState.prediction = 'Error analyzing sign';
	} finally {
		appState.isLoading = false;
	}
}

// Default model and labels
async function loadBundledModel(modelPath = '/spoter.onnx') {
	appState.isLoading = true;
	try {
		await disposeSession();
		const candidates = [modelPath, '/models/spoter.onnx'];
		let createdSession: ort.InferenceSession | null = null;
		let loadedPath = modelPath;

		for (const candidate of candidates) {
			try {
				createdSession = await ort.InferenceSession.create(candidate, {
					executionProviders: ['webgpu', 'wasm']
				});
				loadedPath = candidate;
				break;
			} catch {
				// try next candidate
			}
		}

		if (!createdSession) {
			throw new Error(`Failed to load ONNX model from ${candidates.join(' or ')}`);
		}

		session = createdSession;
		const check = getModelInputConfig(session);
		if (!check.ok) throw new Error(check.message);

		appState.modelName = `Bundled: ${loadedPath}`;
		console.log(check.message);
	} catch (err) {
		console.warn('Bundled model notification:', err);
		appState.modelName = 'No model loaded (Upload custom .onnx model)';
	} finally {
		appState.isLoading = false;
	}
}

async function loadBundledLabels(labelsPath = '/labels.json') {
	const candidates = [labelsPath, '/models/labels.json'];
	for (const candidate of candidates) {
		try {
			const res = await fetch(candidate);
			if (!res.ok) continue;
			const parsed = await res.json();
			if (Array.isArray(parsed)) {
				labels = parsed;
				labelStatus = `Bundled: ${candidate} (${labels.length} words loaded)`;
				return;
			}
		} catch {
			// try next candidate
		}
	}
	labelStatus = 'No labels loaded (using class numbers)';
}

// Override model and labels
async function handleModelUpload(event: Event) {
	const input = event.target as HTMLInputElement | null;
	const file = input?.files?.[0];
	if (!file) return;

	appState.isLoading = true;
	try {
		const arrayBuffer = await file.arrayBuffer();

		await disposeSession();
		session = await ort.InferenceSession.create(arrayBuffer, {
			executionProviders: ['webgpu', 'wasm']
		});

		const check = getModelInputConfig(session);
		if (!check.ok) {
			console.error(check.message);
			alert(
				`Loaded model "${file.name}" but it is not compatible.\n\n${check.message}\n\n` +
				`Tip: export SPOTER model ONNX with input shape [1, 60, 75, 2], [1, 60, 75, 6], [1, 3, 60, 75, 2], or [1, 3, 60, 75, 6]`
			);
			await disposeSession();
			appState.modelName = 'No model loaded';
			return;
		}

		console.log(check.message);
		appState.modelName = file.name;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		alert(`Failed to load ONNX model: ${errorMessage}`);
	} finally {
		appState.isLoading = false;
	}
}

async function handleLabelsUpload(event: Event) {
	const input = event.target as HTMLInputElement | null;
	const file = input?.files?.[0];
	if (!file) return;

	try {
		const text = await file.text();
		const parsed = JSON.parse(text);

		if (!Array.isArray(parsed)) {
			alert('Invalid format! The JSON file must be an array of strings, e.g. ["hello", "world"]');
			return;
		}

		labels = parsed;
		labelStatus = `${file.name} (${labels.length} words loaded)`;
	} catch (err) {
		alert('Failed to parse JSON file. Please check for valid JSON syntax.');
		console.error(err);
	}
}
</script>

<main>
<h1>Sign Language Detection (FOR TESTING, NOT FINAL PRODUCT)</h1>

<div class="grid">

<div class="column left-col">
	<div class="window">
	<div class="title-bar">
		<div class="title-bar-text">Model Selection</div>
	</div>
	<div class="window-body has-space">
		<label for="model-input"><strong>Select ONNX Model File (.onnx):</strong></label>
		<input 
			id="model-input"
			type="file" 
			accept=".onnx" 
			onchange={handleModelUpload}
			disabled={appState.isLoading} 
		/>
		<p class="status">
			Model Status: <strong>{appState.isLoading ? 'Loading model into memory...' : appState.modelName}</strong>
		</p>
	</div>
</div>


<div class="window">
  	<div class="title-bar">
    	<div class="title-bar-text">Label Selection</div>
  	</div>
  	<div class="window-body has-space">
    <label for="label-input"><strong>Upload Labels File (.json):</strong></label>
	<input 
		id="label-input"
		type="file" 
		accept=".json" 
		onchange={handleLabelsUpload} 
	/>
	<p class="status">
		Label Status: <strong>{labelStatus}</strong>
	</p>
  </div>
</div>
</div>
<div class="column center-col">
<div class="window active">
	<div class="title-bar">
		<div class="title-bar-text">Input Selection</div>
		<div class="title-bar-controls">
		<button aria-label="Minimize"></button>
		<button aria-label="Maximize"></button>
		<button aria-label="Close"></button>
		</div>
	</div>
	<div class="window-body has-space">
		<div class="toggle-group">
		<button 
			class="toggle-btn" 
			class:active={appState.input === 'camera'} 
			onclick={() => handleModeChange('camera')}
		>
			Camera
		</button>
		<button 
			class="toggle-btn" 
			class:active={appState.input === 'video'} 
			onclick={() => handleModeChange('video')}
		>
			Video file (.mp4, .webm)
		</button>
		</div>

		{#if appState.input === 'video'}
		<div class="field">
			<label for="video-input" ><strong>Upload Video File (.mp4, .webm):</strong></label>
			<input 
				id="video-input" 
				type="file" 
				accept="video/*" 
				onchange={handleVideoUpload} 
			/>
			<p class="status">Selected Video: <strong>{appState.videoFile}</strong></p>
		</div>
		{/if}
		<div class="video-container">
			<video 
				bind:this={videoElement}  
				playsinline 
				muted
				controls={appState.input === 'video'}
				class:mirrored={appState.input === 'camera'}
				onended={handleVideoEnded}
			></video>
			
			<canvas 
			bind:this={canvasElement} 
			class="canvas-overlay" 
			class:mirrored={appState.input === 'camera'}
			></canvas>

			<div class="status-indicator" class:active={appState.isDetecting}>
				<span class="status-dot"></span>
				<span class="status-text">{appState.isDetecting ? 'DETECTING' : 'IDLE'}</span>
			</div>

		</div>

		<div class="controls-row">
        <div class="detected-box">
          Detected Sign: <strong>{appState.prediction}</strong>
        </div>
        <button 
          type="button" 
          class="toggle-btn detection-btn" 
          class:active={appState.isDetecting} 
          onclick={toggleDetection}
        >
          {appState.isDetecting ? 'Stop Detection' : 'Start Detection'}
        </button>
      </div>
	</div>
	</div>

</div>
	
<div class="column right-col">
<div class="window active">
  <div class="title-bar">
    <div class="title-bar-text">Predictions Rankings</div>
    <div class="title-bar-controls">
      <button aria-label="Minimize"></button>
      <button aria-label="Maximize"></button>
      <button aria-label="Close"></button>
    </div>
  </div>
  <div class="window-body has-space">
    <h2>Top Predictions</h2>

	{#if appState.topPredictions.length === 0}
		<p>Waiting for frames...</p>
	{:else}
		<table class="has-shadow predictions-table">
		<thead>
				<tr>
					<th>Ranking</th>
					<th>Label</th>
					<th>Confidence</th>
				</tr>
		</thead>
		{#each appState.topPredictions as item, index (item.label)}
			
			
			<tbody>
				<tr>
					<td>#{index + 1}</td>
					<td>{item.label}</td>
					<td>{item.percentage}</td>
				</tr>
			</tbody>
		
		{/each}
		</table>
		
		
	{/if}
  </div>
</div>

</div>

</div>

</main>

<style>


main {
	padding: 20px;
	font-family: sans-serif;
	max-width: 1280px;
	margin: 0 auto;
}

.window-body {
	font-size: 1.5em;
}

.grid {
	display: grid;
	grid-template-columns: 1fr 2fr 1fr;
	gap: 20px;
	align-items: start;
}

.column {
	display: flex;
	flex-direction: column;
	gap: 20px;
	min-width: 0;
}

.toggle-group {
	display: flex;
	gap: 10px;
	margin-bottom: 10px;
}
.toggle-btn {
	flex: 1;
	padding: 10px;
	font-size: 1em;
	border: 1px solid #ccc;
	background: #e0e0e0;
	cursor: pointer;
	border-radius: 6px;
	transition: all 0.2s ease;
}
.toggle-btn.active {
	background: #0070f3;
	color: black;
	border-color: #0050b3;
	font-weight: bold;
}
.field {
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px dashed #ccc;
}
.status {
	margin: 6px 0 0 0;
	font-size: 0.88em;
	color: #444;
}
.video-container {
	position: relative;
	width: 100%;
	height: auto;
	background-color: #000;
	border-radius: 8px;
	overflow: hidden;
}


.video-container video {
	display: block;
	width: 100%;
	height: auto;
	max-height: 70vh;
}

.video-container canvas{
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;	
}

video.mirrored, canvas.mirrored {
	transform: scaleX(-1);
}
.controls-row {
	display: flex;
	gap: 10px;
	margin-top: 10px;
	align-items: stretch;
}

.detected-box {
	flex: 1;
	padding: 10px;
	font-size: 1em;
	border: 1px solid #ccc;
	background: #f8f9fa;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	}


.detection-btn {
  	margin: 0;
}

.detection-btn.active {
	background: #d9534f;
	color: white;
	border-color: #d43f3a;
}

.canvas-overlay {
	z-index: 5;
}

.predictions-table {
	width: 100%;
	border-collapse: collapse;
}

@media (max-width: 900px) {
	.grid {
		grid-template-columns: 1fr;
	}
}

.status-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #f44336;
    border-radius: 20px;
    color: #f44336;
    font-size: 0.8em;
    font-weight: bold;
    letter-spacing: 0.5px;
    backdrop-filter: blur(4px);
    transition: all 0.2s ease;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #f44336;
    box-shadow: 0 0 6px #f44336;
    transition: all 0.2s ease;
}


.status-indicator.active {
    border-color: #4caf50;
    color: #4caf50;
}

.status-indicator.active .status-dot {
    background-color: #4caf50;
    box-shadow: 0 0 8px #4caf50;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.85); }
    100% { opacity: 1; transform: scale(1); }
}
</style>