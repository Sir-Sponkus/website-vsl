<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
	import { buildMetricsFromLandmarks, evaluatePracticeAttempt } from '$lib/learning/geometricFeedback';
    import { classifyFrames } from '$lib/sign-recognition/pipeline';
    import { detectFrame } from '$lib/sign-recognition/frameCapture';
    import * as ort from 'onnxruntime-web/webgpu';
    import { asset } from '$app/paths';
    import { i18n } from '$lib/i18n/i18n.svelte';

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
		dropdownOpen: false,
		status: 'idle' as PracticeStatus,
		countdown: 0,
		cameraReady: false,
		modelReady: false,
		error: '',
		score: 0,
		confidence: 0,
		feedback: String(i18n.t.defaultFeedback),
		resultSummary: '',
		issues: [] as Array<{ title: string; message: string; severity: string }>
	});

	let videoElement: HTMLVideoElement | null = null;
	let wordPickerEl: HTMLDivElement | null = null;
	let handLandmarker: HandLandmarker | null = null;
    let poseLandmarker: PoseLandmarker | null = null;
    let session: ort.InferenceSession | null = null;
    let labels: string[] = [];
	let cameraStream: MediaStream | null = null;
	let animationFrameId: number | null = null;
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
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
		window.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		if (countdownTimer) clearInterval(countdownTimer);
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		window.removeEventListener('click', handleClickOutside);
		stopCamera();
	});

	function handleClickOutside(event: MouseEvent) {
		if (wordPickerEl && !wordPickerEl.contains(event.target as Node)) {
			appState.dropdownOpen = false;
		}
	}

	async function loadWordCatalog() {
        try {
            const [labelsResponse, videosResponse] = await Promise.all([
                fetch(asset('/spoter/labels.json')),
                fetch(asset('/spoter/videos.json'))
            ]);

            if (!labelsResponse.ok) {
                throw new Error(`Failed to load labels: ${labelsResponse.status}`);
            }

            const labels = (await labelsResponse.json()) as string[];

            const videoMap: Record<string, string> = videosResponse.ok
                ? await videosResponse.json()
                : {};

            appState.words = labels.map((label, index) => ({
                id: String(index + 1),
                label,
                videoUrl: videoMap[label] ? videoMap[label] : '',
                difficulty: index % 5 === 0 ? 'hard' : index % 3 === 0 ? 'medium' : 'easy'
            }));

            if (appState.words.length > 0) {
                appState.selectedWord = appState.words[0].label;
            }
        } catch (error) {
            console.error('Word list could not be loaded:', error);
            appState.error = i18n.t.wordListLoadError;
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
                : i18n.t.modelLoadedButOnnxFailed;
        } catch (error) {
            console.error(error);
            appState.error = i18n.t.recognitionSetupFailed;
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
			appState.error = i18n.t.cameraPermissionError;
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
		appState.feedback = i18n.t.recordingFeedback;
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
            appState.feedback = i18n.t.recordLongerError;
            return;
        }

        appState.status = 'analyzing';
        appState.feedback = i18n.t.runningModel;

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
                appState.resultSummary = i18n.t.geometricOnlySummary;
                appState.feedback = i18n.t.geometricOnlyFeedback;
                appState.status = 'success';
                return;
            }

            if (modelMatchesSelectedWord && modelConfidence >= 0.6) {
                appState.resultSummary = i18n.t.correctSignSummary;
                appState.feedback =
                    i18n.t.recognizedFeedback(appState.selectedWord) +
                    geometricResult.feedback.join(' ');
            } else if (modelConfidence >= 0.25) {
                appState.resultSummary = i18n.t.closeSignSummary;
                appState.feedback =
                    i18n.t.closeFeedback(topPrediction?.label ?? i18n.t.anotherSign) +
                    geometricResult.feedback.join(' ');
            } else {
                appState.resultSummary = i18n.t.needsImprovementSummary;
                appState.feedback =
                    i18n.t.notRecognizedFeedback(appState.selectedWord) +
                    geometricResult.feedback.join(' ');
            }

            appState.status = 'success';
        } catch (error) {
            console.error('Practice analysis failed:', error);
            appState.status = 'error';
            appState.feedback = i18n.t.analysisFailed;
        }
    }

	function resetPractice() {
		appState.status = 'idle';
		appState.countdown = 0;
		captureFrames = [];
		appState.score = 0;
		appState.confidence = 0;
		appState.resultSummary = '';
		appState.feedback = i18n.t.defaultFeedback;
		appState.issues = [];
	}

	function handleWordSelect(word: string) {
		appState.selectedWord = word;
		appState.search = '';
		appState.dropdownOpen = false;
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
				<h1>{i18n.t.learnTitle}</h1>
			</div>

			<div class="word-picker" bind:this={wordPickerEl}>
				<label for="word-search">{i18n.t.wordLabel}</label>
				<div class="combobox">
					<input
						id="word-search"
						type="text"
						bind:value={appState.search}
						placeholder={appState.selectedWord || i18n.t.searchPlaceholder}
						onfocus={() => (appState.dropdownOpen = true)}
						oninput={() => (appState.dropdownOpen = true)}
					/>

					{#if appState.dropdownOpen}
						<div class="dropdown">
							{#if filteredWords.length === 0}
								<p class="muted">{i18n.t.noWordsMatch}</p>
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
					{/if}
				</div>
			</div>
		</div>

		<div class="panel">
			<div class="selected-word">
				<span class="label">{i18n.t.currentWord}</span>
				<h2>{appState.selectedWord || i18n.t.pickWord}</h2>
			</div>

			<div class="reference-box">
				{#if selectedWordData()?.videoUrl}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video controls playsinline src={selectedWordData()?.videoUrl}></video>
				{:else}
					<div class="placeholder">
						<p>{i18n.t.noReferenceVideo}</p>
						<p class="muted">
							{i18n.t.noReferenceVideoHint}
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
					{appState.status === 'recording' ? i18n.t.recordingEllipsis : i18n.t.startPractice}
				</button>

				<button
					type="button"
					class="primary"
					disabled={appState.status !== 'recording'}
					onclick={stopAndAnalyze}
				>
					{i18n.t.stopAndCheck}
				</button>

				<button type="button" class="ghost" onclick={resetPractice}>{i18n.t.reset}</button>
			</div>

			{#if appState.status === 'countdown'}
				<div class="countdown">{i18n.t.startingInCountdown(appState.countdown)}</div>
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

					<p class="confidence">{i18n.t.confidenceLabel(Math.round(appState.confidence * 100))}</p>

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

	.word-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 16px;
	}

	.combobox {
		position: relative;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 10px 12px;
		border-radius: 10px;
		background: #ffffff;
        border: 1px solid #dbe6f0;
        color: #0f1c28;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(54, 128, 194, 0.25);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 280px;
		overflow-y: auto;
		padding: 8px;
		border-radius: 12px;
		background: var(--panel);
		border: 1px solid var(--panel-border);
		box-shadow: 0 12px 28px var(--shadow);
	}

	.dropdown button {
        background: var(--panel-alt);
        border: 1px solid var(--panel-border);
        color: var(--text);
        text-align: left;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        transition: border-color 0.15s ease;
    }

    .dropdown button:hover {
        border-color: var(--primary);
    }

    .dropdown button.selected {
        background: var(--amber);
        border-color: var(--amber-2);
        color: var(--ink);
    }

    .dropdown button.selected:hover {
        border-color: var(--amber-2);
    }

    .dropdown p.muted {
        margin: 4px 6px;
    }

    .reference-box,
    .camera-box {
        background: var(--panel-alt);
        border: 1px solid var(--panel-border);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .primary {
        background: var(--primary);
        color: var(--primary-ink);
        transition: background-color 0.15s ease;
    }

    .primary:hover:not(:disabled) {
        background: var(--primary-hover);
    }

    .primary:active:not(:disabled) {
        background: var(--primary-active);
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
		color: var(--primary-hover);
		letter-spacing: 0.04em;
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

	.reference-box video {
		display: block;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.camera-box video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		padding: 24px 16px;
		text-align: center;
		color: var(--text-muted);
	}

	.muted {
		color: var(--text-muted);
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
		color: var(--text-muted);
		border: 1px solid var(--panel-border);
		transition: border-color 0.15s ease, color 0.15s ease;
	}

	button.ghost:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--text);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.countdown {
		margin: 8px 0 14px;
		font-size: 1.15rem;
		color: var(--amber);
		font-weight: 700;
	}

	.alert {
		background: var(--danger-soft);
		color: var(--danger-text);
		border: 1px solid var(--danger-border);
		padding: 10px 12px;
		border-radius: 10px;
		margin-bottom: 12px;
	}

	.result-card {
        background: var(--success-soft);
        border: 1px solid var(--success-border);
        padding: 14px 16px;
        border-radius: 12px;
        margin-bottom: 12px;
    }

    /* Neutral by default — this shows every status message, not just errors,
       so it should read as calm guidance rather than a permanent warning. */
    .feedback {
        background: var(--panel-alt);
        color: var(--text);
        border: 1px solid var(--panel-border);
		padding: 10px 12px;
		border-radius: 10px;
		margin-bottom: 12px;
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
		color: var(--success-text);
	}

	.result-card ul {
		margin: 0;
		padding-left: 18px;
		color: var(--text);
	}

</style>