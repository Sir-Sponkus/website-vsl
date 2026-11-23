<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import * as ort from 'onnxruntime-web/webgpu';
import { PoseLandmarker, HandLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { classifyFrames } from '$lib/sign-recognition/pipeline';
import type { CapturedFrame } from '$lib/sign-recognition/pipeline';
import { framesFromResults } from '$lib/sign-recognition/frameCapture';
import { createSigningDetector, STOP_MS, trimIdleTail } from '$lib/sign-recognition/signingDetector';
import { loadModels, monotonicTimestamp, peekLastTimestamp } from '$lib/sign-recognition/models';
import { i18n, msg } from '$lib/i18n/i18n.svelte';
import type { Msg } from '$lib/i18n/i18n.svelte';

const NUM_CLASSES = 400;

interface PredictionItem {
  label: string;
  confidence: number;
  percentage: string;
}

const appState = $state({
	input: 'camera', // 'camera' or 'video'
	// Stored as a message key (or a raw label string) so it follows language changes.
	prediction: msg('dash') as Msg | string,
	topPredictions: [] as PredictionItem[],
	isLoading: false,
	modelsLoading: true,
	setupError: null as Msg | null,
	videoFile: null as string | null,
	isDetecting: false,
	auto: false, // camera only: start/stop recording when signing is detected
	countdown: 0
});

const MIN_SIGN_MS = 400; // auto mode: shorter signs (excluding the idle tail) are silently dropped
const detector = createSigningDetector();

let videoElement: HTMLVideoElement | null = null;
let sharedSession: ort.InferenceSession | null = null;
// Only set when the user uploads a custom model; owned (and released) by this page.
let customSession: ort.InferenceSession | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let rawFrameBuffer: CapturedFrame[] = [];
let animFrameId: number | null = null;
let cameraStream: MediaStream | null = null;
let videoObjectUrl: string | null = null;
let canvasElement: HTMLCanvasElement | null = null;
let canvasCtx: CanvasRenderingContext2D | null = null;
let drawingUtils: DrawingUtils | null = null;
let labels = $state<string[]>([]);
const CAPTURE_INTERVAL_MS = 1000 / 30;
const MAX_RECORD_DURATION_MS = 10000;
let lastCaptureTime = 0;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
let recordingStartTime = 0;

let timestampOffset = 0;

const activeSession = () => customSession ?? sharedSession;

async function toggleDetection() {
	// Currently recording -> stop and analyze
	if (appState.isDetecting) {
		appState.isDetecting = false;
		if (appState.input === 'video' && videoElement) {
			videoElement.pause();
		}
		appState.prediction = msg('analyzingSign');
		await runInferenceForWindow();
		rawFrameBuffer.length = 0;
		detector.reset(); // go back to listening for the next sign
		return;
	}


	if (appState.countdown > 0) {
		cancelCountdown();
		return;
	}


	if (appState.input === 'camera') {
		if (appState.auto) beginRecording(); // manual start still works in auto mode
		else startCountdown();
	} else {
		beginRecording();
		if (videoElement) await videoElement.play();
	}
}

function startCountdown() {
	appState.countdown = 3;
	appState.prediction = msg('startingIn', appState.countdown);

	countdownTimer = setInterval(() => {
		appState.countdown -= 1;
		if (appState.countdown <= 0) {
			clearInterval(countdownTimer!);
			countdownTimer = null;
			appState.countdown = 0;
			beginRecording();
		} else {
			appState.prediction = msg('startingIn', appState.countdown);
		}
	}, 1000);
}

function cancelCountdown() {
	if (countdownTimer) {
		clearInterval(countdownTimer);
		countdownTimer = null;
	}
	appState.countdown = 0;
	appState.prediction = msg('dash');
}

function setAuto(on: boolean) {
	appState.auto = on;
	detector.reset();
	if (on) cancelCountdown();
}

// Auto mode: end of a sign. Too-short sequences (hand flickers) go back to listening silently.
async function finishAutoRecording() {
	const recordedMs = performance.now() - recordingStartTime;
	if (recordedMs - STOP_MS < MIN_SIGN_MS) {
		appState.isDetecting = false;
		rawFrameBuffer.length = 0;
		appState.prediction = msg('dash');
		detector.reset();
		return;
	}
	rawFrameBuffer = trimIdleTail(rawFrameBuffer, recordedMs);
	await toggleDetection();
}

function beginRecording() {
	rawFrameBuffer.length = 0;
	lastCaptureTime = 0;
	recordingStartTime = performance.now();
	appState.isDetecting = true;
	appState.prediction = msg('recordingGesture');
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

// Timestamps are shared with the other page through models.ts so they stay strictly
// increasing for the shared landmarker instances. For uploaded videos we keep the
// spacing of the video clock by shifting it with an offset.
function getVideoTimestamp(videoCurrentTimeSec: number): number {
	const base = Math.round(videoCurrentTimeSec * 1000);
	const last = peekLastTimestamp();

	if (base + timestampOffset <= last) {
		timestampOffset = last + 16 - base;
	}

	return monotonicTimestamp(base + timestampOffset);
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
				const timestamp =
					appState.input === 'camera'
						? monotonicTimestamp(performance.now())
						: getVideoTimestamp(videoElement.currentTime);

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
							i18n.t.recordingRemaining(remainingSec),
							16,
							16,
							{ font: 'bold 20px monospace', color: '#ff4444' }
						);

						if (elapsed >= MAX_RECORD_DURATION_MS) {
							await toggleDetection(); // stops + runs inference, same as pressing Stop
						}
					}
				}

				// Auto mode: hand motion drives start/stop.
				if (
					appState.auto &&
					appState.input === 'camera' &&
					appState.countdown === 0 &&
					!appState.isLoading
				) {
					const ev = detector.update(handRes.landmarks ?? [], performance.now());
					if (ev === 'start' && !appState.isDetecting) beginRecording();
					else if (ev === 'stop' && appState.isDetecting) await finishAutoRecording();
				}

				// Collect keypoints when recording
				if (appState.isDetecting) {
					const now = performance.now();
					if (now - lastCaptureTime >= CAPTURE_INTERVAL_MS) {
						lastCaptureTime = now;
						rawFrameBuffer.push(framesFromResults(poseRes, handRes));
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

async function runInferenceForWindow() {
	const session = activeSession();
	if (!session || rawFrameBuffer.length < 10) {
		appState.prediction = msg('sequenceTooShort');
		return;
	}

	appState.isLoading = true;
	try {
		if (labels.length && labels.length !== NUM_CLASSES) {
			console.warn(`labels.json has ${labels.length} entries, model expects ${NUM_CLASSES}.`);
		}

		const ranked = await classifyFrames(session, rawFrameBuffer, labels);
		const topPredictions = ranked.slice(0, 5).map((item) => ({
			label: item.label,
			confidence: item.confidence,
			percentage: (item.confidence * 100).toFixed(1) + '%'
		}));
		appState.topPredictions = topPredictions;
		appState.prediction = topPredictions[0]?.label ?? msg('unknown');
	} catch (err) {
		console.error('Inference error:', err);
		appState.prediction = msg('errorAnalyzing');
	} finally {
		appState.isLoading = false;
	}
}


onMount(async () => {
	try {
		const models = await loadModels();
		poseLandmarker = models.poseLandmarker;
		handLandmarker = models.handLandmarker;
		sharedSession = models.session;
		labels = models.labels;
		appState.modelsLoading = false;

		await startCamera();
		startDetectionLoop();
	} catch (err) {
		console.error('Setup error:', err);
		appState.setupError = msg('recognitionSetupFailed');
		appState.modelsLoading = false;
	}
});

async function disposeCustomSession() {
	if (!customSession) return;
	try {
		await customSession.release();
	} catch (err) {
		console.error('Error releasing session:', err);
	}
	customSession = null;
}

onDestroy(() => {
	if (animFrameId) cancelAnimationFrame(animFrameId);
	if (countdownTimer) clearInterval(countdownTimer);
	// The shared session belongs to models.ts and stays alive for the next page.
	disposeCustomSession().catch((err) => console.error('Session dispose error:', err));
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
	timestampOffset = 0;
	appState.isDetecting = false;
	cancelCountdown();
	detector.reset();

	if (appState.input === 'camera') {
		await startCamera();
	} else {
		stopCamera();
		if (videoElement) {
			videoElement.srcObject = null;
			videoElement.src = '';
		}
		appState.videoFile = null;
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
	appState.prediction = msg('dash');
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


// Override model and labels
async function handleModelUpload(event: Event) {
	const input = event.target as HTMLInputElement | null;
	const file = input?.files?.[0];
	if (!file) return;

	appState.isLoading = true;
	try {
		const arrayBuffer = await file.arrayBuffer();

		await disposeCustomSession();
		customSession = await ort.InferenceSession.create(arrayBuffer, {
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
						{i18n.t.videoStatus} <strong>{appState.videoFile ?? i18n.t.noVideoSelected}</strong>
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

			{#if appState.modelsLoading}
				<div class="loading" role="status">{i18n.t.loadingModels}</div>
			{/if}

			{#if appState.setupError}
				<div class="alert">{i18n.render(appState.setupError)}</div>
			{/if}

			{#if appState.input === 'camera'}
				<div class="auto-row">
					<button
						type="button"
						class="auto-toggle"
						aria-pressed={appState.auto}
						onclick={() => setAuto(!appState.auto)}
					>
						<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
						{i18n.t.autoDetect}
					</button>
					{#if appState.auto && !appState.modelsLoading && !appState.setupError && !appState.isLoading && appState.countdown === 0}
						<span class="muted">
							{appState.isDetecting ? i18n.t.autoSigning : i18n.t.autoWaiting}
						</span>
					{/if}
				</div>
			{/if}

			<div class="controls-row">
				<div class="detected-box">
					{i18n.t.detectedSign} <strong>{i18n.render(appState.prediction)}</strong>
				</div>

				<button
					type="button"
					class="primary-button"
					class:active={appState.isDetecting}
					disabled={appState.modelsLoading || !!appState.setupError}
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
	grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
	gap: 20px;
}

@media (max-width: 800px) {
	.page {
		padding: 20px 14px;
	}

	.shell {
		grid-template-columns: minmax(0, 1fr);
	}

	.panel {
		padding: 14px;
	}

	.primary-button {
		width: 100%;
	}
}

.loading {
	margin-bottom: 12px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--panel-alt);
	border: 1px solid var(--panel-border);
	color: var(--text-muted);
}

.alert {
	margin-bottom: 12px;
	padding: 10px 12px;
	border-radius: 10px;
	background: var(--danger-soft);
	border: 1px solid var(--danger-border);
	color: var(--danger-text);
}

.primary-button:disabled {
	cursor: not-allowed;
	opacity: 0.5;
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

.muted {
	color: var(--muted);
}

.auto-row {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 12px;
	align-items: center;
	margin-bottom: 10px;
}

.auto-toggle {
	display: inline-flex;
	gap: 8px;
	align-items: center;
	padding: 8px 14px;
	border-radius: 10px;
	border: 1px solid var(--panel-border);
	background: var(--panel-alt);
	color: var(--text);
	font: inherit;
	cursor: pointer;
}

.auto-toggle:hover {
	border-color: var(--primary);
}

.auto-toggle[aria-pressed='true'] {
	background: var(--primary);
	border-color: var(--primary);
	color: var(--primary-ink);
}
</style>