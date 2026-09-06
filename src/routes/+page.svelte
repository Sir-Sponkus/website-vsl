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

/* =========================
   NOTEBOOK-ALIGNED CONSTANTS
   ========================= */
const TARGET_FRAMES = 60;
const POSE_KEEP = 33;          // was 25
const HAND_JOINTS = 21;
const NUM_JOINTS = 75;         // 33 + 21 + 21
const RAW_DIMS = 2;            // x,y only for notebook-style model input
const USE_6CH = false;         // true if your ONNX expects [1,60,75,6], false for [1,60,75,2]

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

// DOM / runtime
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


const JOINT_PARENT_75: number[] = (() => {
	const p = Array.from({ length: 75 }, (_, i) => i);

	const poseParent: Record<number, number> = {
		11: 11, 12: 11, 0: 11,
		13: 11, 15: 13, 17: 15, 19: 15, 21: 15,
		14: 12, 16: 14, 18: 16, 20: 16, 22: 16,
		23: 11, 24: 12, 25: 23, 26: 24, 27: 25, 28: 26,
		29: 27, 30: 28, 31: 29, 32: 30,
		1: 0, 2: 1, 3: 2, 4: 0, 5: 4, 6: 5, 7: 3, 8: 6, 9: 0, 10: 0
	};
	for (const [k, v] of Object.entries(poseParent)) p[+k] = v;

	// MediaPipe hand chain parents (21)
	const handParent = [0, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 0, 17, 18, 19];

	// left hand 33..53, root linked to left wrist pose(15)
	for (let i = 0; i < 21; i++) p[33 + i] = (i === 0) ? 15 : 33 + handParent[i];
	// right hand 54..74, root linked to right wrist pose(16)
	for (let i = 0; i < 21; i++) p[54 + i] = (i === 0) ? 16 : 54 + handParent[i];

	return p;
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


function interp1d(newX: number[], oldX: number[], oldY: number[]): number[] {
	const n = oldX.length;
	const result: number[] = new Array(newX.length);
	if (n === 0) return new Array(newX.length).fill(0);
	if (n === 1) return new Array(newX.length).fill(oldY[0]);

	for (let i = 0; i < newX.length; i++) {
		const x = newX[i];
		if (x <= oldX[0]) {
		result[i] = oldY[0];
		} else if (x >= oldX[n - 1]) {
		result[i] = oldY[n - 1];
		} else {
		let idx = 0;
		while (idx < n - 1 && oldX[idx + 1] < x) idx++;
		const x0 = oldX[idx], x1 = oldX[idx + 1];
		const y0 = oldY[idx], y1 = oldY[idx + 1];
		result[i] = y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
		}
	}
	return result;
}

function resampleLinear(framesSeq: number[][][], targetLen = TARGET_FRAMES): number[][][] {
	const n = framesSeq.length;
	if (n === 0) return [];
	if (n === 1) return Array.from({ length: targetLen }, () => framesSeq[0].map(([x, y]) => [x, y]));

	const oldIdx = Array.from({ length: n }, (_, i) => i / (n - 1));
	const newIdx = Array.from({ length: targetLen }, (_, i) => i / (targetLen - 1));

	const resampled: number[][][] = Array.from({ length: targetLen }, () =>
		Array.from({ length: NUM_JOINTS }, () => [0, 0])
	);

	for (let j = 0; j < NUM_JOINTS; j++) {
		for (let d = 0; d < RAW_DIMS; d++) {
		const oldY = framesSeq.map((frame) => frame[j][d]);
		const newY = interp1d(newIdx, oldIdx, oldY);
		for (let t = 0; t < targetLen; t++) resampled[t][j][d] = newY[t];
		}
	}
	return resampled;
}


function preprocessKeypointsXY(rawBuffer: number[][][]): number[][][] {
	const kp = resampleLinear(rawBuffer, TARGET_FRAMES); // [60][75][2]

	for (let t = 0; t < TARGET_FRAMES; t++) {
		const l = kp[t][11]; // left shoulder
		const r = kp[t][12]; // right shoulder

		const cx = (l[0] + r[0]) / 2;
		const cy = (l[1] + r[1]) / 2;
		const dx = l[0] - r[0];
		const dy = l[1] - r[1];
		const width = Math.max(Math.hypot(dx, dy), 1e-5);

		for (let j = 0; j < NUM_JOINTS; j++) {
		const x = kp[t][j][0];
		const y = kp[t][j][1];
		const valid = Math.abs(x) + Math.abs(y) > 1e-6;

		if (!valid) {
			kp[t][j][0] = 0;
			kp[t][j][1] = 0;
		} else {
			kp[t][j][0] = (x - cx) / width;
			kp[t][j][1] = (y - cy) / width;
		}
		}
	}

	return kp;
}

/* =========================
   Build 2ch and 6ch tensors
   ========================= */
function build2ChTensor(kpXY: number[][][]): Float32Array {
	// shape [1,60,75,2]
	const flat = new Float32Array(1 * TARGET_FRAMES * NUM_JOINTS * 2);
	let idx = 0;
	for (let t = 0; t < TARGET_FRAMES; t++) {
		for (let j = 0; j < NUM_JOINTS; j++) {
		flat[idx++] = kpXY[t][j][0];
		flat[idx++] = kpXY[t][j][1];
		}
	}
	return flat;
}

function build6ChTensor(kpXY: number[][][]): Float32Array {
	// channels: [x,y,bx,by,mx,my], shape [1,60,75,6]
	const flat = new Float32Array(1 * TARGET_FRAMES * NUM_JOINTS * 6);
	let idx = 0;

	for (let t = 0; t < TARGET_FRAMES; t++) {
		for (let j = 0; j < NUM_JOINTS; j++) {
		const x = kpXY[t][j][0];
		const y = kpXY[t][j][1];

		const p = JOINT_PARENT_75[j];
		const px = kpXY[t][p][0];
		const py = kpXY[t][p][1];
		const bx = x - px;
		const by = y - py;

		let mx = 0, my = 0;
		if (t < TARGET_FRAMES - 1) {
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

/* =========================
   Lifecycle
   ========================= */
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

        // canvas init
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

          // draw pose
          if (poseRes.landmarks) {
            for (const landmark of poseRes.landmarks) {
              drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
              drawingUtils.drawLandmarks(landmark, { radius: 3, color: '#FF0000' });
            }
          }

          // draw hands
          	if (handRes.landmarks) {
				for (const landmarks of handRes.landmarks) {
				drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 });
				drawingUtils.drawLandmarks(landmarks, { radius: 2, color: '#0000FF' });
				}
          }

          canvasCtx.restore();
        }

        // extract keypoints while recording
        if (appState.isDetecting) {
          // Pose 33
          let posePoints: number[][];
          if (poseRes.landmarks && poseRes.landmarks.length > 0) {
            posePoints = poseRes.landmarks[0]
              .slice(0, POSE_KEEP)
              .map((pt) => [pt.x, pt.y]); // xy only
          } else {
            posePoints = Array.from({ length: POSE_KEEP }, () => [0, 0]);
          }

          // Hands 21 + 21
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


// Softmax here
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

function validateModelInputShape(
	session: ort.InferenceSession,
  	use6ch: boolean
): { ok: boolean; message: string } {
  	const expected = use6ch
    	? [1, TARGET_FRAMES, NUM_JOINTS, 6]
    	: [1, TARGET_FRAMES, NUM_JOINTS, 2];

	const inputName = session.inputNames?.[0];
	if (!inputName) {
		return { ok: false, message: 'Model has no input tensor.' };
	}

  const meta = session.inputMetadata?.[inputName];
  const actualDims = meta?.dimensions; // usually (string|number)[]
  const actualType = meta?.type ?? 'unknown';

  if (!actualDims || actualDims.length !== 4) {
    return {
      ok: false,
      message:
        `Expected 4D input ${JSON.stringify(expected)}, ` +
        `but model input "${inputName}" is ${formatTensorShape(actualDims)} (type: ${actualType}).`
    };
  }

	// Check T, K, C strictly; allow batch dynamic
	const batchOk = isDimCompatible(actualDims[0], expected[0]) || typeof actualDims[0] === 'string' || actualDims[0] === -1;
	const tOk = isDimCompatible(actualDims[1], expected[1]);
	const kOk = isDimCompatible(actualDims[2], expected[2]);
	const cOk = isDimCompatible(actualDims[3], expected[3]);

	const ok = batchOk && tOk && kOk && cOk;

	if (!ok) {
		return {
		ok: false,
		message:
			`Input shape mismatch for "${inputName}". ` +
			`Model expects ${formatTensorShape(actualDims)} (type: ${actualType}), ` +
			`but app is producing ${JSON.stringify(expected)} with USE_6CH=${use6ch}.`
		};
	}

	return {
		ok: true,
		message:
		`Model input OK: "${inputName}" ${formatTensorShape(actualDims)} (type: ${actualType}).`
	};
}

/* =========================
   Inference
   ========================= */
async function runInferenceForWindow() {
	if (!session || rawFrameBuffer.length < 10) {
		appState.prediction = 'Sequence too short';
		return;
	}

	appState.isLoading = true;
	try {
		const kpXY = preprocessKeypointsXY(rawFrameBuffer); // [60][75][2]

		let inputTensor: ort.Tensor;
		if (USE_6CH) {
		const data6 = build6ChTensor(kpXY);
		inputTensor = new ort.Tensor('float32', data6, [1, TARGET_FRAMES, NUM_JOINTS, 6]);
		} else {
		const data2 = build2ChTensor(kpXY);
		inputTensor = new ort.Tensor('float32', data2, [1, TARGET_FRAMES, NUM_JOINTS, 2]);
		}

		// If your ONNX input name isn't "input", replace this with session.inputNames[0]
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

/* =========================
   Upload handlers
   ========================= */
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

		// Validate expected input shape against current app preprocessing config
		const check = validateModelInputShape(session, USE_6CH);
		if (!check.ok) {
		console.error(check.message);
		alert(
			`Loaded model "${file.name}" but it is not compatible.\n\n${check.message}\n\n` +
			`Tip: export ONNX with input [1, ${TARGET_FRAMES}, ${NUM_JOINTS}, ${USE_6CH ? 6 : 2}]`
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
<h1>Sign Language Detection</h1>

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