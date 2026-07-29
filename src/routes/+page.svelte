<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as ort from 'onnxruntime-web/webgpu';
  import {
    PoseLandmarker,
    HandLandmarker,
    FilesetResolver
  } from '@mediapipe/tasks-vision';

  
  const TARGET_FRAMES = 60;
  const POSE_KEEP = 25;
  const HAND_JOINTS = 21;
  const NUM_JOINTS = 67; // 25 Pose + 21 Left Hand + 21 Right Hand
  const RAW_DIMS = 3;     // x, y, z

  
  const appState = $state({
    input: 'camera', // 'camera' or 'video'
    modelName: 'No model loaded',
    prediction: '—',
    isLoading: false,
    videoFile: 'No video selected'
  });

  // DOM element bindings & internal references
  let videoElement: HTMLVideoElement | null = null;
  let session: ort.InferenceSession | null = null;
  let poseLandmarker: PoseLandmarker | null = null;
  let handLandmarker: HandLandmarker | null = null;
  let rawFrameBuffer: number[][][] = []; // Dynamic length: Array of [67][3] // 67
  let animFrameId: number | null = null;
  let cameraStream: MediaStream | null = null;
  let videoObjectUrl: string | null = null;

  // ============================================================================
  // MATH & PREPROCESSING UTILITIES (PYTHON PARITY)
  // ============================================================================

  // Helper: 1D Linear Interpolation (equivalent to np.interp)
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
        while (idx < n - 1 && oldX[idx + 1] < x) {
          idx++;
        }
        const x0 = oldX[idx], x1 = oldX[idx + 1];
        const y0 = oldY[idx], y1 = oldY[idx + 1];
        result[i] = y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return result;
  }

  // Helper: Median calculation
  function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Linear Resampling to TARGET_FRAMES (resample_linear)
  function resampleLinear(framesSeq: number[][][], targetLen = TARGET_FRAMES): number[][][] {
    const n = framesSeq.length;
    if (n === 0) return [];
    if (n === 1) {
      return new Array(targetLen).fill(framesSeq[0]);
    }

    const oldIdx = Array.from({ length: n }, (_, i) => i / (n - 1));
    const newIdx = Array.from({ length: targetLen }, (_, i) => i / (targetLen - 1));

    const resampled: number[][][] = Array.from({ length: targetLen }, () =>
      Array.from({ length: NUM_JOINTS }, () => [0, 0, 0])
    );

    for (let j = 0; j < NUM_JOINTS; j++) {
      for (let d = 0; d < RAW_DIMS; d++) {
        const oldY = framesSeq.map((frame) => frame[j][d]);
        const newY = interp1d(newIdx, oldIdx, oldY);
        for (let t = 0; t < targetLen; t++) {
          resampled[t][j][d] = newY[t];
        }
      }
    }
    return resampled;
  }

  // Full Preprocessing Pipeline (tien_xu_ly)
  function preprocessKeypoints(rawBuffer: number[][][]): Float32Array {
    // 0. Resample time steps to exactly 60 frames
    const kp = resampleLinear(rawBuffer, TARGET_FRAMES); // [60][67][3]

    // Track valid detections (sum(abs(xyz)) > 1e-6)
    const validMask: boolean[][] = Array.from({ length: TARGET_FRAMES }, (_, t) =>
      Array.from({ length: NUM_JOINTS }, (_, j) => {
        const [x, y, z] = kp[t][j];
        return Math.abs(x) + Math.abs(y) + Math.abs(z) > 1e-6;
      })
    );

    const timeIndices = Array.from({ length: TARGET_FRAMES }, (_, i) => i);

    // 1. Interpolate missing keypoints across time
    for (let j = 0; j < NUM_JOINTS; j++) {
      const validTimes: number[] = [];
      for (let t = 0; t < TARGET_FRAMES; t++) {
        if (validMask[t][j]) validTimes.push(t);
      }

      if (validTimes.length > 0 && validTimes.length < TARGET_FRAMES) {
        for (let d = 0; d < RAW_DIMS; d++) {
          const oldY = validTimes.map((t) => kp[t][j][d]);
          const interpolated = interp1d(timeIndices, validTimes, oldY);
          for (let t = 0; t < TARGET_FRAMES; t++) {
            kp[t][j][d] = interpolated[t];
          }
        }
      }
    }

    // 2. Shoulder normalization (Landmarks 11 and 12)
    const validShoulderTimes: number[] = [];
    const centers: number[][] = [];
    const widths: number[] = [];

    for (let t = 0; t < TARGET_FRAMES; t++) {
      if (validMask[t][11] && validMask[t][12]) {
        validShoulderTimes.push(t);
        const p11 = kp[t][11];
        const p12 = kp[t][12];

        const cx = (p11[0] + p12[0]) / 2;
        const cy = (p11[1] + p12[1]) / 2;
        const cz = (p11[2] + p12[2]) / 2;
        centers.push([cx, cy, cz]);

        const dx = p11[0] - p12[0];
        const dy = p11[1] - p12[1];
        const dz = p11[2] - p12[2];
        widths.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
    }

    let medianCenter = [0, 0, 0];
    let medianWidth = 1.0;

    if (validShoulderTimes.length > 0) {
      medianCenter = [
        median(centers.map((c) => c[0])),
        median(centers.map((c) => c[1])),
        median(centers.map((c) => c[2]))
      ];
      medianWidth = Math.max(median(widths), 1e-3);
    }

    // Normalize and drop Z coordinate -> Output [60, 67, 2]
    // 67
    const flatOutput = new Float32Array(TARGET_FRAMES * NUM_JOINTS * 2);
    let idx = 0;

    for (let t = 0; t < TARGET_FRAMES; t++) {
      for (let j = 0; j < NUM_JOINTS; j++) {
        const xNorm = (kp[t][j][0] - medianCenter[0]) / medianWidth;
        const yNorm = (kp[t][j][1] - medianCenter[1]) / medianWidth;

        flatOutput[idx++] = xNorm;
        flatOutput[idx++] = yNorm;
      }
    }

    return flatOutput;
  }

  //Pipeline

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

    videoObjectUrl = URL.createObjectURL(file);
    appState.videoFile = file.name;

    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.src = videoObjectUrl;
      videoElement.loop = true;
      videoElement.play();
    }
  }

  // Continuous frame collection loop
  function startDetectionLoop() {
    const processFrame = async () => {
      if (
        videoElement &&
        poseLandmarker &&
        handLandmarker &&
        videoElement.readyState >= 2 &&
        !videoElement.paused
      ) {
        const timestamp =
          appState.input === 'camera' ? performance.now() : videoElement.currentTime * 1000;

        const poseRes = poseLandmarker.detectForVideo(videoElement, timestamp);
        const handRes = handLandmarker.detectForVideo(videoElement, timestamp);

        // 1. Extract Pose (25 joints)
        let posePoints: number[][];
        if (poseRes.landmarks && poseRes.landmarks.length > 0) {
          posePoints = poseRes.landmarks[0]
            .slice(0, POSE_KEEP)
            .map((pt) => [pt.x, pt.y, pt.z]);
        } else {
          posePoints = new Array(POSE_KEEP).fill(0).map(() => [0, 0, 0]);
        }

        // 2. Extract Hands (Left: 21, Right: 21)
        let leftHandPoints: number[][] = new Array(HAND_JOINTS).fill(0).map(() => [0, 0, 0]);
        let rightHandPoints: number[][] = new Array(HAND_JOINTS).fill(0).map(() => [0, 0, 0]);

        if (handRes.landmarks && handRes.handedness) {
          for (let h = 0; h < handRes.handedness.length; h++) {
            const label = handRes.handedness[h][0]?.categoryName;
            const pts = handRes.landmarks[h].map((pt) => [pt.x, pt.y, pt.z]);
            if (label === 'Left') leftHandPoints = pts;
            else if (label === 'Right') rightHandPoints = pts;
          }
        }

        // Concatenate frame keypoints -> [67][3]
        const currentFrame = [...posePoints, ...leftHandPoints, ...rightHandPoints];
        rawFrameBuffer.push(currentFrame);

        // Maintain rolling window buffer (up to 90 raw frames before resampling)
        if (rawFrameBuffer.length > 90) {
          rawFrameBuffer.shift();
        }

        // Run local model inference if session exists and we have enough frames
        if (rawFrameBuffer.length >= 10 && session) {
          await runInference();
        }
      }

      animFrameId = requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  async function runInference() {
    if (!session || rawFrameBuffer.length === 0) return;

    try {
      // Execute Python-equivalent preprocessing
      const processedData = preprocessKeypoints(rawFrameBuffer);

      // Create ONNX Tensor with shape [1, 60, 67, 2] (or [1, 60, 134])
      const inputTensor = new ort.Tensor('float32', processedData, [1, TARGET_FRAMES, NUM_JOINTS, 2]);

      const outputs = await session.run({ input: inputTensor });
      const outputData = outputs.output.data as Float32Array;

      // ArgMax calculation
      let predictedClass = 0;
      let maxVal = -Infinity;
      for (let i = 0; i < outputData.length; i++) {
        if (outputData[i] > maxVal) {
          maxVal = outputData[i];
          predictedClass = i;
        }
      }

      appState.prediction = `Class ${predictedClass}`;
    } catch (err) {
      console.error('Inference error:', err);
    }
  }

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

      appState.modelName = file.name;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Failed to load ONNX model: ${errorMessage}`);
    } finally {
      appState.isLoading = false;
    }
  }
</script>

<main>
  <h2>Sign Language Recognizer</h2>

  <div class="card">
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
        <label for="video-input"><strong>Upload Video File (.mp4, .webm):</strong></label>
        <input 
          id="video-input" 
          type="file" 
          accept="video/*" 
          onchange={handleVideoUpload} 
        />
        <p class="status">Selected Video: <strong>{appState.videoFile}</strong></p>
      </div>
    {/if}
  </div>

  <div class="card">
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

  <div class="video-container">
    <video 
      bind:this={videoElement} 
      autoplay 
      playsinline 
      muted
      controls={appState.input === 'video'}
      class:mirrored={appState.input === 'camera'}
    ></video>
    
    <div class="overlay">
      Detected Sign: <strong>{appState.prediction}</strong>
    </div>
  </div>
</main>

<style>
  main {
    padding: 20px;
    font-family: sans-serif;
    max-width: 680px;
  }
  .card {
    margin-bottom: 15px;
    padding: 14px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: #fcfcfc;
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
    color: white;
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
    width: 640px;
    height: 480px;
    background-color: #000;
    border-radius: 8px;
    overflow: hidden;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  video.mirrored {
    transform: scaleX(-1);
  }
  .overlay {
    position: absolute;
    bottom: 15px;
    left: 15px;
    padding: 10px 18px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    border-radius: 6px;
    font-size: 1.2em;
    z-index: 10;
  }
</style>