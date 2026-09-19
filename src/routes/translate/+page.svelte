<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import * as ort from 'onnxruntime-web/webgpu';
import {
  PoseLandmarker,
  HandLandmarker,
  FilesetResolver,
  DrawingUtils
} from '@mediapipe/tasks-vision';
import {goto} from '$app/navigation';
import {asset} from '$app/paths';
import {i18n} from '$lib/i18n/i18n.svelte';


const TARGET_FRAMES = 60;
const POSE_KEEP = 33;
const HAND_JOINTS = 21;
const NUM_JOINTS = 75;
const NUM_CHANNELS = 6;
const NUM_CLASSES = 400;

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
	isDetecting: false,
	countdown: 0
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
const CAPTURE_INTERVAL_MS = 1000 / 30;
const MAX_RECORD_DURATION_MS = 10000;
let lastCaptureTime = 0;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let recordingStartTime = 0;

let timestampOffset = 0;
let lastMediaPipeTimestamp = 0;

function goHome() {
	goto('/');
}


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
	// Currently recording -> stop and analyze
	if (appState.isDetecting) {
		appState.isDetecting = false;
		if (appState.input === 'video' && videoElement) {
			videoElement.pause();
		}
		appState.prediction = i18n.t.analyzingSign;
		await runInferenceForWindow();
		rawFrameBuffer.length = 0;
		return;
	}


	if (appState.countdown > 0) {
		cancelCountdown();
		return;
	}


	if (appState.input === 'camera') {
		startCountdown();
	} else {
		beginRecording();
		if (videoElement) await videoElement.play();
	}
}

function startCountdown() {
	appState.countdown = 3;
	appState.prediction = i18n.t.startingIn(appState.countdown);

	countdownTimer = setInterval(() => {
		appState.countdown -= 1;
		if (appState.countdown <= 0) {
			clearInterval(countdownTimer!);
			countdownTimer = null;
			appState.countdown = 0;
			beginRecording();
		} else {
			appState.prediction = i18n.t.startingIn(appState.countdown);
		}
	}, 1000);
}

function cancelCountdown() {
	if (countdownTimer) {
		clearInterval(countdownTimer);
		countdownTimer = null;
	}
	appState.countdown = 0;
	appState.prediction = i18n.t.dash;
}

function beginRecording() {
	rawFrameBuffer.length = 0;
	lastCaptureTime = 0;
	recordingStartTime = performance.now();
	appState.isDetecting = true;
	appState.prediction = i18n.t.recordingGesture;
	appState.topPredictions = [];
}

function drawOverlayText(
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	text: string,
	x: number,
	y: number,
	opts: { font?: string; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline } = {}
){
	ctx.save();
	ctx.font = opts.font ?? '20px monospace';
	ctx.fillStyle = opts.color ?? '#ffffff';
	ctx.textAlign = opts.align ?? 'left';
	ctx.textBaseline = opts.baseline ?? 'top';

	if (appState.input === 'camera') {
		ctx.translate(canvas.width, 0);
		ctx.scale(-1, 1);
	}

	ctx.fillText(text, x, y);
	ctx.restore();
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


function cleanValue(v: number): number {
	return Number.isFinite(v) ? v : 0.0;
}


function preprocessKeypoints(rawBuffer: number[][][], targetLen = TARGET_FRAMES): number[][][] {
	const T = rawBuffer.length;
	if (T === 0) {
		return Array.from({ length: targetLen }, () =>
			Array.from({ length: NUM_JOINTS }, () => [0, 0])
		);
	}

	
	const cleaned: number[][][] = Array.from({ length: T }, (_, t) =>
		Array.from({ length: NUM_JOINTS }, (_, j) => [
			cleanValue(rawBuffer[t][j][0]),
			cleanValue(rawBuffer[t][j][1])
		])
	);

	
	const normalizedSeq: number[][][] = Array.from({ length: T }, () =>
		Array.from({ length: NUM_JOINTS }, () => [0, 0])
	);

	for (let t = 0; t < T; t++) {
		const l = cleaned[t][11]; // left shoulder (vai_t)
		const r = cleaned[t][12]; // right shoulder (vai_p)

		const cx = (l[0] + r[0]) / 2.0;
		const cy = (l[1] + r[1]) / 2.0;
		const dx = l[0] - r[0];
		const dy = l[1] - r[1];
		const width = Math.max(Math.hypot(dx, dy), 1e-5);

		for (let j = 0; j < NUM_JOINTS; j++) {
			normalizedSeq[t][j][0] = (cleaned[t][j][0] - cx) / width;
			normalizedSeq[t][j][1] = (cleaned[t][j][1] - cy) / width;
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

// Tensor: (B,60,75,6)
function buildTensorData(kpXY: number[][][]): Float32Array {
	const T = TARGET_FRAMES;
	const K = NUM_JOINTS;

	const flat = new Float32Array(T * K * NUM_CHANNELS);
	let idx = 0;

	for (let t = 0; t < T; t++) {
		for (let j = 0; j < K; j++) {
			const x = kpXY[t][j][0];
			const y = kpXY[t][j][1];

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

			flat[idx++] = x;
			flat[idx++] = y;
			flat[idx++] = bx;
			flat[idx++] = by;
			flat[idx++] = mx;
			flat[idx++] = my;
		}
	}

	return flat;
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
					if (appState.countdown > 0 && canvasElement) {
						drawOverlayText(
							canvasCtx,
							canvasElement,
							String(appState.countdown),
							canvasElement.width / 2,
							canvasElement.height / 2,
							{ font: 'bold 96px monospace', color: '#ffffff', align: 'center', baseline: 'middle' }
						);
					}
					if (appState.isDetecting && canvasElement) {
						const elapsed = performance.now() - recordingStartTime;
						const remainingSec = Math.max(0, Math.ceil((MAX_RECORD_DURATION_MS - elapsed) / 1000));
						drawOverlayText(
							canvasCtx,
							canvasElement,
							`REC ${remainingSec}s`,
							16,
							16,
							{ font: 'bold 20px monospace', color: '#ff4444' }
						);

						if (elapsed >= MAX_RECORD_DURATION_MS) {
							await toggleDetection(); // stops + runs inference, same as pressing Stop
						}
					}
				}

				// Extract keypoints when recording
				if (appState.isDetecting) {
					const now = performance.now();
					if (now - lastCaptureTime >= CAPTURE_INTERVAL_MS) {
						lastCaptureTime = now;

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

						const currentFrame = [...posePoints, ...leftHandPoints, ...rightHandPoints];
						rawFrameBuffer.push(currentFrame);
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


async function runInferenceForWindow() {
	if (!session || rawFrameBuffer.length < 10) {
		appState.prediction = i18n.t.sequenceTooShort;
		return;
	}

	appState.isLoading = true;
	try {
		const kpXY = preprocessKeypoints(rawFrameBuffer, TARGET_FRAMES);
		const tensorData = buildTensorData(kpXY);
		const inputTensor = new ort.Tensor('float32', tensorData, [1, TARGET_FRAMES, NUM_JOINTS, NUM_CHANNELS]);

		const inputName = session.inputNames?.[0] ?? 'input';
		const outputName = session.outputNames?.[0] ?? 'output';

		const outputs = await session.run({ [inputName]: inputTensor });
		const outputData = outputs[outputName].data as Float32Array;

		if (labels.length && labels.length !== NUM_CLASSES) {
			console.warn(`labels.json has ${labels.length} entries, model expects ${NUM_CLASSES}.`);
		}

		const topPredictions = getTopKPredictions(outputData, labels, 5);
		appState.topPredictions = topPredictions;
		appState.prediction = topPredictions[0]?.label ?? i18n.t.unknown;
	} catch (err) {
		console.error('Inference error:', err);
		appState.prediction = i18n.t.errorAnalyzing;
	} finally {
		appState.isLoading = false;
	}
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
	if (countdownTimer) clearInterval(countdownTimer);
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
		appState.videoFile = i18n.t.noVideoSelected;
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
	appState.prediction = i18n.t.dash;
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


// Default model and labels
async function loadBundledModel(modelPath = asset('/spoter/spoter.onnx')) {
	appState.isLoading = true;
	try {
		await disposeSession();

		const candidates = [modelPath, asset('/spoter/spoter.onnx')];
		let createdSession: ort.InferenceSession | null = null;
		let lastError: unknown = null;

		for (const candidate of candidates) {
			try {
				createdSession = await ort.InferenceSession.create(candidate, {
					executionProviders: ['wasm']
				});
				console.log(`Loaded ONNX model from: ${candidate}`);
				break;
			} catch (e) {
				lastError = e;
				console.warn(`Failed loading candidate: ${candidate}`, e);
			}
		}

		if (!createdSession) {
			throw new Error(
				`Failed to load ONNX model from ${candidates.join(' or ')}. Last error: ${String(lastError)}`
			);
		}

		session = createdSession;
		appState.modelName = `Bundled: ${modelPath}`;
	} catch (err) {
		console.warn('Bundled model notification:', err);
		appState.modelName = 'No model loaded (Upload custom .onnx model)';
	} finally {
		appState.isLoading = false;
	}
}

async function loadBundledLabels(labelsPath = asset('/spoter/labels.json')) {
	const candidates = [labelsPath, asset('/spoter/labels.json')];
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

		
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		alert(i18n.t.failedModelAlert(errorMessage));
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
			alert(i18n.t.invalidFormatAlert);
			return;
		}

		labels = parsed;
		labelStatus = `${file.name} (${labels.length} words loaded)`;
	} catch (err) {
		alert(i18n.t.failedParseAlert);
		console.error(err);
	}
}
</script>


<main class="page">
	<section class="shell">
		<div class="panel big-one">

			<div class="toggle-group">
				<button
					type="button"
					class="toggle-btn"
					class:active={appState.input === 'camera'}
					onclick={() => handleModeChange('camera')}
				>
					{i18n.t.camera}
				</button>
				<button
					type="button"
					class="toggle-btn"
					class:active={appState.input === 'video'}
					onclick={() => handleModeChange('video')}
				>
					{i18n.t.videoFile}
				</button>
			</div>

			{#if appState.input === 'video'}
				<div class="field">
					<label for="video-input"><strong>{i18n.t.uploadLabel}</strong></label>
					<input
						id="video-input"
						type="file"
						accept="video/*"
						onchange={handleVideoUpload}
					/>
					<p class="status">
						{i18n.t.videoStatus} <strong>{appState.videoFile}</strong>
					</p>
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
				</div>
			</div>

			<div class="controls-row">
				<div class="detected-box">
					{i18n.t.detectedSign} <strong>{appState.prediction}</strong>
				</div>

				<button
					type="button"
					class="primary-button"
					class:active={appState.isDetecting}
					onclick={toggleDetection}
				>
					{appState.isDetecting ? i18n.t.stopDetection : i18n.t.startDetection}
				</button>
			</div>
		</div>

		<div class="panel small-one">
			<div class="header-row">
				<h2>{i18n.t.topPredictions}</h2>
			</div>

			{#if appState.topPredictions.length === 0}
				<p class="muted">{i18n.t.waitingFrames}</p>
			{:else}
				<div class="predictions-wrap">
					<table class="predictions-table">
						<thead>
							<tr>
								<th>{i18n.t.ranking}</th>
								<th>{i18n.t.label}</th>
								<th>{i18n.t.confidence}</th>
							</tr>
						</thead>
						<tbody>
							{#each appState.topPredictions as item, index (item.label)}
								<tr>
									<td>#{index + 1}</td>
									<td>{item.label}</td>
									<td>{item.percentage}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</section>
</main>
<style>
.page {
	min-height: calc(100vh - 72px);
	padding: 32px 20px;
	background: var(--bg);
}

.shell {
	max-width: 1200px;
	margin: 0 auto;
	display: grid;
	grid-template-columns: 2fr 1fr;
	gap: 20px;
}

.big-one,
.small-one {
	display: flex;
	flex-direction: column;
	height: 100%;
	box-sizing: border-box;
}

.panel {
	background: var(--panel);
	border: 1px solid var(--panel-border);
	border-radius: 18px;
	padding: 18px;
	box-shadow: 0 4px 18px var(--shadow);
}

.header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 16px;
}
.header-row h2 {
	margin: 0;
	color: var(--text);
	font-size: 1.5rem;
}


.field {
	margin-bottom: 14px;
}

.field label {
	display: block;
	margin-bottom: 8px;
	color: var(--text);
}

.field input {
	width: 100%;
	box-sizing: border-box;
	padding: 10px 12px;
	border-radius: 10px;
	border: 1px solid var(--panel-border);
	background: var(--panel-alt);
	color: var(--text);
}

.status {
	margin: 8px 0 0;
	color: var(--muted);
}

.toggle-group {
	display: flex;
	gap: 10px;
	margin-bottom: 14px;
}

.toggle-btn {
	flex: 1;
	border: 1px solid var(--panel-border);
	background: var(--primary);
	color: var(--text);
	border-radius: 10px;
	padding: 10px 12px;
	cursor: pointer;
	font-weight: 600;
}

.toggle-btn.active {
	background: var(--primary-active);
	color: var(--ink);
	border-color: var(--amber);
}

.primary.active {
	background: var(--primary-active);
	color: var(--ink);
	border-color: var(--amber);
}

.video-container {
	position: relative;
	width: 100%;
	aspect-ratio: 16 / 9;
	background: #f0ece8;
	border: 1px solid var(--panel-border);
	border-radius: 14px;
	overflow: hidden;
	margin-bottom: 14px;
}

.video-container video,
.canvas-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.canvas-overlay {
	pointer-events: none;
}

.video-container video.mirrored,
.canvas-overlay.mirrored {
	transform: scaleX(-1);
}

.controls-row {
	display: flex;
	gap: 10px;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
}

.detected-box {
	flex: 1;
	min-height: 50px;
	display: flex;
	align-items: center;
	border-radius: 12px;
	border: 1px solid var(--panel-border);
	background: var(--panel-alt);
	padding: 12px 14px;
	color: var(--text);
}

.primary-button {
	border: none;
	border-radius: 12px;
	padding: 12px 18px;
	background: var(--primary);
	color: var(--ink);
	font-weight: 700;
	cursor: pointer;
}

.primary-button.active {
	background: var(--primary);
}

.status-indicator {
	position: absolute;
	top: 12px;
	right: 12px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.12);
	display: flex;
	justify-content: center;
	align-items: center;
}

.status-indicator.active {
	background: rgba(57, 123, 16, 0.2);
}

.status-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: red;
	display: block;
}

.status-indicator.active .status-dot {
	background: green;
}

.predictions-wrap {
	max-height: 420px;
	overflow: auto;
}

.predictions-table {
	width: 100%;
	border-collapse: collapse;
}

.predictions-table th,
.predictions-table td {
	padding: 10px 8px;
	border-bottom: 1px solid var(--panel-border);
	text-align: left;
	color: var(--text);
}

.predictions-table th {
	color: var(--muted);
	font-size: 0.82rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

.meta-card {
	margin-top: 18px;
	padding: 14px;
	border-radius: 12px;
	background: var(--panel-alt);
	border: 1px solid var(--panel-border);
	color: var(--text);
}

.meta-card p {
	margin: 8px 0;
}

.muted {
	color: var(--muted);
}
</style>