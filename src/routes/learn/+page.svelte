<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
	import { buildMetricsFromLandmarks, evaluatePracticeAttempt } from '$lib/learning/geometricFeedback';
    import { classifyFrames } from '$lib/sign-recognition/pipeline';
    import { detectFrame } from '$lib/sign-recognition/frameCapture';
    import * as ort from 'onnxruntime-web/webgpu';
    import { asset, resolve } from '$app/paths';

	type PracticeStatus = 'idle' | 'countdown' | 'recording' | 'analyzing' | 'success' | 'error';

	type WordEntry = {
		id: string;
		label: string;
		videoUrl?: string;
		difficulty?: 'easy' | 'medium' | 'hard';
	};

	const appState = $state({
		words: [] as WordEntry[],
		search: '',
		selectedWord: '',
		status: 'idle' as PracticeStatus,
		countdown: 0,
		cameraReady: false,
		modelReady: false,
		error: '',
		score: 0,
		confidence: 0,
		feedback: 'Select a word, start the camera, and try the sign.',
		resultSummary: '',
		issues: [] as Array<{ title: string; message: string; severity: string }>
	});

	let videoElement: HTMLVideoElement | null = null;
	let handLandmarker: HandLandmarker | null = null;
    let poseLandmarker: PoseLandmarker | null = null;
    let session: ort.InferenceSession | null = null;
    let labels: string[] = [];
	let cameraStream: MediaStream | null = null;
	let animationFrameId: number | null = null;
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let captureFrames: import('$lib/sign-recognition/pipeline').CapturedFrame[] = [];
	let lastCaptureAt = 0;

	const filteredWords = $derived(
		appState.words.filter((word) =>
			word.label.toLowerCase().includes(appState.search.trim().toLowerCase())
		)
	);

	onMount(async () => {
		loadWordCatalog();
		await setupRecognitionPipeline();
		await startCamera();
	});

	onDestroy(() => {
		if (countdownTimer) clearInterval(countdownTimer);
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		stopCamera();
	});

	async function loadWordCatalog() {
        try {
            const response = await fetch(asset('/spoter/labels.json'));

            if (!response.ok) {
                throw new Error(`Failed to load labels: ${response.status}`);
            }

            const labels = (await response.json()) as string[];

            appState.words = labels.map((label, index) => ({
                id: String(index + 1),
                label,
                videoUrl: '',
                difficulty: index % 5 === 0 ? 'hard' : index % 3 === 0 ? 'medium' : 'easy'
            }));

            if (appState.words.length > 0) {
                appState.selectedWord = appState.words[0].label;
            }
        } catch (error) {
            console.error('Word list could not be loaded:', error);
            appState.error = 'The full word list could not be loaded.';
            appState.words = [];
        }
    }

	async function setupRecognitionPipeline() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
            );

            poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numPoses: 1
            });

            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                    delegate: 'GPU'
                },
                runningMode: 'VIDEO',
                numHands: 2
            });

            const modelCandidates = [asset('/spoter/spoter.onnx')];

            for (const modelPath of modelCandidates) {
                try {
                    session = await ort.InferenceSession.create(modelPath, {
                        executionProviders: ['wasm']
                    });
                    break;
                } catch (error) {
                    console.warn(`Unable to load model from ${modelPath}`, error);
                }
            }

            const labelResponse = await fetch(asset('/spoter/labels.json'));
            if (labelResponse.ok) {
                const parsed = await labelResponse.json();

                if (Array.isArray(parsed)) {
                    labels = parsed;
                }
            }

            if (!poseLandmarker || !handLandmarker) {
                throw new Error('Landmarkers did not initialize');
            }

            appState.modelReady = true;
            appState.error = session
                ? ''
                : 'Landmarkers are ready, but the ONNX model could not be loaded.';
        } catch (error) {
            console.error(error);
            appState.error =
                'Recognition setup failed. Check model assets and use a supported browser.';
        }
    }

	async function startCamera() {
		try {
			if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
				throw new Error('Camera API unavailable');
			}

			stopCamera();

			const streamResult = await navigator.mediaDevices.getUserMedia({
				video: { width: 640, height: 480, frameRate: { ideal: 30 } },
				audio: false
			});

			cameraStream = streamResult;

			if (videoElement) {
				videoElement.srcObject = cameraStream;
				videoElement.muted = true;
				videoElement.playsInline = true;
				await videoElement.play();
			}

			appState.cameraReady = true;
			appState.error = '';
			startLoop();
		} catch (error) {
			console.error(error);
			appState.error = 'Camera permission was denied or is unavailable.';
			appState.cameraReady = false;
		}
	}

	function stopCamera() {
		if (cameraStream) {
			cameraStream.getTracks().forEach((track) => track.stop());
			cameraStream = null;
		}
		if (videoElement) {
			videoElement.srcObject = null;
		}
	}

	function startLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        const step = () => {
            if (
                videoElement &&
                poseLandmarker &&
                handLandmarker &&
                appState.status === 'recording'
            ) {
                try {
                    const now = performance.now();

                    if (now - lastCaptureAt >= 1000 / 30) {
                        lastCaptureAt = now;

                        captureFrames.push(
                            detectFrame(
                                videoElement,
                                poseLandmarker,
                                handLandmarker,
                                now
                            )
                        );
                    }
                } catch (error) {
                    console.error('Recognition capture error:', error);
                }
            }

            animationFrameId = requestAnimationFrame(step);
        };

        animationFrameId = requestAnimationFrame(step);
    }

	function startCountdown() {
		if (!appState.selectedWord) return;

		appState.status = 'countdown';
		appState.countdown = 3;

		if (countdownTimer) clearInterval(countdownTimer);

		countdownTimer = setInterval(() => {
			appState.countdown -= 1;

			if (appState.countdown <= 0) {
				clearInterval(countdownTimer!);
				countdownTimer = null;
				beginRecording();
			}
		}, 1000);
	}

	function beginRecording() {
		captureFrames = [];
		lastCaptureAt = 0;
		appState.status = 'recording';
		appState.resultSummary = '';
		appState.issues = [];
		appState.feedback = 'Recording your attempt...';
	}

	function averageMetrics() {
        const metrics = captureFrames
            .map((frame) =>
                buildMetricsFromLandmarks(
                    frame.pose,
                    frame.leftHand,
                    frame.rightHand
                )
            )
            .filter((value): value is NonNullable<typeof value> => value !== null);

        if (metrics.length === 0) {
            return null;
        }

        const average = <K extends keyof ReturnType<typeof buildMetricsFromLandmarks>>(
            key: K
        ) => metrics.reduce((sum, value) => sum + Number(value[key]), 0) / metrics.length;

        return {
            shoulderWidth: average('shoulderWidth'),
            leftHandY: average('leftHandY'),
            rightHandY: average('rightHandY'),
            handGap: average('handGap'),
            leftSpread: average('leftSpread'),
            rightSpread: average('rightSpread'),
            leftOpen: average('leftOpen'),
            rightOpen: average('rightOpen'),
            confidence: average('confidence')
        };
    }

	async function stopAndAnalyze() {
        if (!appState.selectedWord || captureFrames.length < 10) {
            appState.status = 'error';
            appState.feedback =
                'Record a little longer with both hands visible before checking.';
            return;
        }

        appState.status = 'analyzing';
        appState.feedback = 'Running the sign recognition model...';

        try {
            const predictions = session
                ? await classifyFrames(session, captureFrames, labels)
                : [];

            const topPrediction = predictions[0];
            const selectedPrediction = predictions.find(
                (prediction) => prediction.label === appState.selectedWord
            );

            const averaged = averageMetrics();

            if (!averaged) {
                throw new Error('No valid landmark metrics were captured.');
            }

            const geometricResult = evaluatePracticeAttempt(
                averaged,
                appState.selectedWord
            );

            const modelMatchesSelectedWord =
                topPrediction?.label === appState.selectedWord;

            const modelConfidence = selectedPrediction?.confidence ?? 0;

            const score = modelMatchesSelectedWord
                ? Math.round(Math.max(geometricResult.score, modelConfidence * 100))
                : Math.round(
                        Math.min(
                            geometricResult.score,
                            Math.max(0, modelConfidence * 100)
                        )
                    );

            appState.score = score;
            appState.confidence = modelConfidence;
            appState.issues = geometricResult.issues;

            if (!session) {
                appState.resultSummary =
                    'Geometric feedback only — the recognition model is unavailable.';
                appState.feedback =
                    'The model could not be loaded, so this result is only an approximate geometry check.';
                appState.status = 'success';
                return;
            }

            if (modelMatchesSelectedWord && modelConfidence >= 0.6) {
                appState.resultSummary = 'Correct sign detected.';
                appState.feedback =
                    `The model recognized “${appState.selectedWord}”. ` +
                    geometricResult.feedback.join(' ');
            } else if (modelConfidence >= 0.25) {
                appState.resultSummary = 'Close to the selected sign.';
                appState.feedback =
                    `The model was close, but it predicted “${topPrediction?.label ?? 'another sign'}”. ` +
                    geometricResult.feedback.join(' ');
            } else {
                appState.resultSummary = 'Needs improvement.';
                appState.feedback =
                    `The model did not confidently recognize “${appState.selectedWord}”. ` +
                    geometricResult.feedback.join(' ');
            }

            appState.status = 'success';
        } catch (error) {
            console.error('Practice analysis failed:', error);
            appState.status = 'error';
            appState.feedback =
                'The sign could not be analyzed. Try recording again with your full upper body and both hands visible.';
        }
    }

	function resetPractice() {
		appState.status = 'idle';
		appState.countdown = 0;
		captureFrames = [];
		appState.score = 0;
		appState.confidence = 0;
		appState.resultSummary = '';
		appState.feedback = 'Select a word, start the camera, and try the sign.';
		appState.issues = [];
	}

	function handleWordSelect(word: string) {
		appState.selectedWord = word;
		resetPractice();
	}

	function selectedWordData() {
		return appState.words.find((item) => item.label === appState.selectedWord) ?? null;
	}
</script>

<main class="page">
	<section class="shell">
		<div class="panel">
			<div class="header-row">
				<h1>Learn a sign</h1>
			</div>

			<div class="word-picker">
				<label for="word-search">Search word</label>
				<input
					id="word-search"
					type="text"
					bind:value={appState.search}
					placeholder="Type a Vietnamese sign word..."
				/>
			</div>

			<div class="word-list">
				{#if filteredWords.length === 0}
					<p class="muted">No words match your search.</p>
				{:else}
					{#each filteredWords as word (word.label)}
						<button
							type="button"
							class:selected={appState.selectedWord === word.label}
							onclick={() => handleWordSelect(word.label)}
						>
							{word.label}
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<div class="panel">
			<div class="selected-word">
				<span class="label">Current word</span>
				<h2>{appState.selectedWord || 'Pick a word'}</h2>
			</div>

			<div class="reference-box">
				{#if selectedWordData()?.videoUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video controls playsinline src={selectedWordData()?.videoUrl}></video>
				{:else}
					<div class="placeholder">
						<p>No reference video available yet for this word.</p>
						<p class="muted">
							This repo includes the word list but not every video asset. The learning flow still works with live camera feedback.
						</p>
					</div>
				{/if}
			</div>

			<div class="camera-box">
				<video bind:this={videoElement} muted playsinline autoplay></video>
			</div>

			<div class="status-row">
				<button
					type="button"
					class="primary"
					disabled={!appState.modelReady || !appState.cameraReady}
					onclick={startCountdown}
				>
					{appState.status === 'recording' ? 'Recording...' : 'Start practice'}
				</button>

				<button
					type="button"
					class="secondary"
					disabled={appState.status !== 'recording'}
					onclick={stopAndAnalyze}
				>
					Stop and check
				</button>

				<button type="button" class="ghost" onclick={resetPractice}>Reset</button>
			</div>

			{#if appState.status === 'countdown'}
				<div class="countdown">Starting in {appState.countdown}</div>
			{/if}

			{#if appState.error}
				<div class="alert">{appState.error}</div>
			{/if}

			{#if appState.status === 'success'}
				<div class="result-card">
					<div class="score-row">
						<strong>{appState.score}%</strong>
						<span>{appState.resultSummary}</span>
					</div>

					<p class="confidence">Confidence: {Math.round(appState.confidence * 100)}%</p>

					{#if appState.issues.length > 0}
						<ul>
							{#each appState.issues as issue (issue.title + issue.message)}
								<li>
									<strong>{issue.title}:</strong>
									{issue.message}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<div class="feedback">
				{appState.feedback}
			</div>
		</div>
	</section>
</main>

<style>
	:global(body) {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }

	.page {
        min-height: calc(100vh - 72px);
        padding: 32px 20px;
        background: var(--bg);
    }


	.shell {
		max-width: 1200px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
		gap: 20px;
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
		justify-content: space-between;
		align-items: center;
		margin-bottom: 18px;
	}

	.header-row h1 {
		margin: 0;
		font-size: 1.7rem;
	}

	.home-link {
		color: #d8b4fe;
		text-decoration: none;
	}

	.word-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border-radius: 10px;
		background: #ffffff;
        border: 1px solid #e2e8f0;
        color: #111827;
	}

	.word-list button {
        background: var(--panel-alt);
        border: 1px solid var(--panel-border);
        color: var(--text);
    }

    .word-list button.selected {
        background: var(--amber);
        border-color: var(--amber-2);
        color: var(--ink);
    }

    .reference-box,
    .camera-box {
        background: var(--panel-alt);
        border: 1px solid var(--panel-border);
    }

    .primary {
        background: var(--amber);
        color: var(--ink);
    }

    .secondary {
        background: var(--panel-alt);
        color: var(--text);
        border: 1px solid var(--panel-border);
    }


	.selected-word {
		margin-bottom: 16px;
	}

	.selected-word .label {
		display: block;
		font-size: 0.76rem;
		color: #c4b5fd;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 6px;
	}

	.selected-word h2 {
		margin: 0;
		font-size: clamp(1.5rem, 2vw, 2.3rem);
	}


	.reference-box {
		min-height: 160px;
	}

	.camera-box {
		min-height: 240px;
	}

	.reference-box video,
	.camera-box video {
		display: block;
		width: 100%;
	}

	.placeholder {
		padding: 24px 16px;
		text-align: center;
		color: #cbd5e1;
	}

	.muted {
		color: #94a3b8;
	}

	.status-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-bottom: 12px;
	}

	button.primary,
	button.secondary,
	button.ghost {
		border: none;
		border-radius: 10px;
		padding: 10px 14px;
		cursor: pointer;
	}

	button.ghost {
		background: transparent;
		color: #cbd5e1;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.countdown {
		margin: 8px 0 14px;
		font-size: 1.15rem;
		color: #f9a8d4;
		font-weight: 700;
	}

	.alert {
		background: rgba(239, 68, 68, 0.1);
		color: #fecaca;
		border: 1px solid rgba(239, 68, 68, 0.25);
		padding: 10px 12px;
		border-radius: 10px;
		margin-bottom: 12px;
	}

	.result-card {
        background: rgba(57, 123, 16, 0.08);
        border: 1px solid rgba(57, 123, 16, 0.2);
    }

    .feedback {
        background: var(--panel-alt);
        border: 1px solid var(--panel-border);
        color: var(--text);
    }

	.score-row {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 1.1rem;
		margin-bottom: 8px;
	}

	.score-row strong {
		font-size: 1.8rem;
	}

	.confidence {
		margin: 0 0 12px;
		color: #d1fae5;
	}

	.result-card ul {
		margin: 0;
		padding-left: 18px;
		color: #e2e8f0;
	}

</style>