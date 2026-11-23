<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { DrawingUtils, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
	import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
	import type { InferenceSession } from 'onnxruntime-web/webgpu';
	import { averageMetrics, evaluatePracticeAttempt } from '$lib/learning/geometricFeedback';
	import type { PracticeIssue } from '$lib/learning/geometricFeedback';
	import { classifyFrames } from '$lib/sign-recognition/pipeline';
	import type { CapturedFrame, Prediction } from '$lib/sign-recognition/pipeline';
	import { englishOf, shuffle, similarTo, topicOf, TOPICS, videoPath, posterPath } from '$lib/learning/lessons';
	import { dueWords, loadProgress, LEARNED_SCORE, track } from '$lib/learning/progress';
	import type { Progress } from '$lib/learning/progress';
	import { referenceFor } from '$lib/learning/reference';
	import type { Reference } from '$lib/learning/reference';
	import { detectRaw, framesFromResults } from '$lib/sign-recognition/frameCapture';
	import { createSigningDetector, STOP_MS, trimIdleTail } from '$lib/sign-recognition/signingDetector';
	import { loadLabels, loadModels, monotonicTimestamp } from '$lib/sign-recognition/models';
	import FireBurst from '$lib/components/FireBurst.svelte';
	import { asset } from '$app/paths';
	import { i18n, msg } from '$lib/i18n/i18n.svelte';
	import type { Msg } from '$lib/i18n/i18n.svelte';

	type PracticeStatus = 'idle' | 'countdown' | 'recording' | 'analyzing' | 'success' | 'error';

	type WordEntry = { label: string; index: number };

	const MAX_RECORD_DURATION_MS = 10000;
	const MIN_SIGN_MS = 400; // auto mode: shorter signs (excluding the idle tail) are dropped silently
	const detector = createSigningDetector();

	const appState = $state({
		words: [] as WordEntry[],
		// Ordered words for a topic / review / quiz session; empty when browsing freely.
		queue: [] as string[],
		quiz: false,
		quizStreak: 0, // consecutive recognized signs in ?quiz=1
		progress: { words: {}, days: [] } as Progress,
		top: [] as Prediction[],
		refSpeed: 1,
		refLoop: true,
		refMirror: false,
		search: '',
		selectedWord: '',
		dropdownOpen: false,
		status: 'idle' as PracticeStatus,
		countdown: 0,
		auto: false, // start/stop the attempt when signing is detected
		cameraReady: false,
		modelReady: false,
		modelsLoading: true,
		recordRemaining: 0,
		error: null as Msg | null,
		score: 0,
		confidence: 0,
		// Stored as message keys so they re-render when the language changes.
		feedback: [msg('defaultFeedback')] as Msg[],
		resultSummary: null as Msg | null,
		issues: [] as PracticeIssue[]
	});

	let videoElement: HTMLVideoElement | null = null;
	let refVideo = $state<HTMLVideoElement | null>(null);
	let learnerCanvas = $state<HTMLCanvasElement | null>(null);
	let refCanvas = $state<HTMLCanvasElement | null>(null);
	let replayFrames = $state.raw<CapturedFrame[]>([]);
	let replayAspect = 4 / 3;
	let replayMs = 0;
	let reference = $state<Reference | null>(null);
	let replayRaf: number | null = null;
	let canvasElement: HTMLCanvasElement | null = null;
	let wordPickerEl: HTMLDivElement | null = null;
	let handLandmarker: HandLandmarker | null = null;
	let poseLandmarker: PoseLandmarker | null = null;
	let session: InferenceSession | null = null;
	let labels: string[] = [];
	let drawingUtils: DrawingUtils | null = null;
	let cameraStream: MediaStream | null = null;
	let animationFrameId: number | null = null;
	let countdownTimer: ReturnType<typeof setInterval> | null = null;
	let captureFrames: CapturedFrame[] = [];
	let lastCaptureAt = 0;
	let recordingStartedAt = 0;

	const filteredWords = $derived(
		appState.words.filter((word) =>
			word.label.toLowerCase().includes(appState.search.trim().toLowerCase())
		)
	);

	const feedbackText = $derived(appState.feedback.map((part) => i18n.render(part)).join(''));

	onMount(() => {
		loadWordCatalog();
		window.addEventListener('click', handleClickOutside);
		void init();
	});

	async function init() {
		await setupRecognitionPipeline();
		await startCamera();
	}

	onDestroy(() => {
		if (countdownTimer) clearInterval(countdownTimer);
		if (animationFrameId) cancelAnimationFrame(animationFrameId);
		if (replayRaf) cancelAnimationFrame(replayRaf);
		if (typeof window !== 'undefined') window.removeEventListener('click', handleClickOutside);
		stopCamera();
	});

	function handleClickOutside(event: MouseEvent) {
		if (wordPickerEl && !wordPickerEl.contains(event.target as Node)) {
			appState.dropdownOpen = false;
		}
	}

	async function loadWordCatalog() {
		const wordLabels = await loadLabels();
		if (wordLabels.length === 0) {
			appState.error = msg('wordListLoadError');
			return;
		}
		appState.words = wordLabels.map((label, index) => ({ label, index }));
		appState.progress = loadProgress();

		// ?topic=<id> | ?review=1 | ?quiz=1 start a session; ?word=<label> preselects a word.
		const params = new URLSearchParams(location.search);
		const topic = TOPICS.find((t) => t.id === params.get('topic'));
		appState.quiz = params.has('quiz');
		if (topic) appState.queue = Object.keys(topic.words);
		else if (params.has('review')) appState.queue = dueWords(appState.progress);
		else if (appState.quiz) appState.queue = shuffle(wordLabels).slice(0, 10);

		const wanted = params.get('word');
		appState.selectedWord =
			wanted && wordLabels.includes(wanted) ? wanted : (appState.queue[0] ?? wordLabels[0]);
	}

	async function setupRecognitionPipeline() {
		appState.modelsLoading = true;
		try {
			const models = await loadModels();
			poseLandmarker = models.poseLandmarker;
			handLandmarker = models.handLandmarker;
			session = models.session;
			labels = models.labels;

			appState.modelReady = true;
			appState.error = session ? null : msg('modelLoadedButOnnxFailed');
		} catch (error) {
			console.error(error);
			appState.error = msg('recognitionSetupFailed');
		} finally {
			appState.modelsLoading = false;
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
			if (appState.error?.key === 'cameraPermissionError') appState.error = null;
			startLoop();
		} catch (error) {
			console.error(error);
			appState.error = msg('cameraPermissionError');
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

	function clearOverlay() {
		const ctx = canvasElement?.getContext('2d');
		if (ctx && canvasElement) ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
	}

	function drawSkeleton(
		poseResult: ReturnType<typeof detectRaw>['poseResult'],
		handResult: ReturnType<typeof detectRaw>['handResult']
	) {
		if (!canvasElement || !videoElement) return;
		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;

		if (videoElement.videoWidth > 0 && canvasElement.width !== videoElement.videoWidth) {
			canvasElement.width = videoElement.videoWidth;
			canvasElement.height = videoElement.videoHeight;
		}
		if (!drawingUtils) drawingUtils = new DrawingUtils(ctx);

		ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

		for (const landmarks of poseResult.landmarks ?? []) {
			drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
				color: '#00FF00',
				lineWidth: 2
			});
			drawingUtils.drawLandmarks(landmarks, { radius: 3, color: '#FF0000' });
		}
		for (const landmarks of handResult.landmarks ?? []) {
			drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
				color: '#00FFFF',
				lineWidth: 2
			});
			drawingUtils.drawLandmarks(landmarks, { radius: 2, color: '#0000FF' });
		}
	}

	function startLoop() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}

		const step = () => {
			const recording = appState.status === 'recording';
			// Auto mode keeps watching between attempts so the next sign starts by itself.
			const listening =
				appState.auto &&
				['idle', 'success', 'error'].includes(appState.status) &&
				!!appState.selectedWord &&
				appState.modelReady;
			if (videoElement && poseLandmarker && handLandmarker && (recording || listening)) {
				const now = performance.now();
				const elapsed = now - recordingStartedAt;

				if (recording) {
					appState.recordRemaining = Math.max(
						0,
						Math.ceil((MAX_RECORD_DURATION_MS - elapsed) / 1000)
					);
				}

				if (recording && elapsed >= MAX_RECORD_DURATION_MS) {
					// Same as pressing "Stop and check".
					void stopAndAnalyze();
				} else if (now - lastCaptureAt >= 1000 / 30) {
					try {
						lastCaptureAt = now;

						const { poseResult, handResult } = detectRaw(
							videoElement,
							poseLandmarker,
							handLandmarker,
							monotonicTimestamp(now)
						);
						drawSkeleton(poseResult, handResult);
						const ev = appState.auto ? detector.update(handResult.landmarks ?? [], now) : null;
						if (ev === 'start' && !recording) {
							beginRecording();
							lastCaptureAt = now;
						}
						if (recording || ev === 'start') {
							captureFrames.push(framesFromResults(poseResult, handResult));
						}
						if (ev === 'stop' && recording) {
							if (elapsed - STOP_MS < MIN_SIGN_MS) resetPractice(); // flicker: back to listening
							else {
								captureFrames = trimIdleTail(captureFrames, elapsed);
								void stopAndAnalyze();
							}
						}
					} catch (error) {
						console.error('Recognition capture error:', error);
					}
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
		recordingStartedAt = performance.now();
		appState.recordRemaining = Math.ceil(MAX_RECORD_DURATION_MS / 1000);
		appState.status = 'recording';
		appState.resultSummary = null;
		appState.issues = [];
		appState.feedback = [msg('recordingFeedback')];
	}

	async function stopAndAnalyze() {
		if (appState.status !== 'recording') return;

		detector.reset();
		clearOverlay();

		if (!appState.selectedWord || captureFrames.length < 10) {
			appState.status = 'error';
			appState.feedback = [msg('recordLongerError')];
			return;
		}

		appState.status = 'analyzing';
		appState.feedback = [msg('runningModel')];
		replayFrames = captureFrames;
		replayMs = performance.now() - recordingStartedAt;
		replayAspect = (videoElement?.videoWidth ?? 4) / (videoElement?.videoHeight || 3) || 4 / 3;

		try {
			const predictions = session ? await classifyFrames(session, captureFrames, labels) : [];

			const topPrediction = predictions[0];
			const normalize = (value: string) => value.trim().toLowerCase();
			const selectedPrediction = predictions.find(
				(prediction) => normalize(prediction.label) === normalize(appState.selectedWord)
			);

			const modelMatchesSelectedWord =
				topPrediction !== undefined &&
				normalize(topPrediction.label) === normalize(appState.selectedWord);

			const averaged = averageMetrics(captureFrames, replayAspect);

			if (!averaged) {
				throw new Error('No valid landmark metrics were captured.');
			}

			// Null on failure: practice then falls back to the visibility-only check.
			const entry = selectedWordData();
			reference = entry ? await referenceFor(entry.label, videoPath(entry.index)) : null;

			const geometricResult = evaluatePracticeAttempt(averaged, reference?.metrics);

			const modelConfidence = selectedPrediction?.confidence ?? 0;

			// With a model, its confidence in the selected word is the score (capped by the
			// visibility check). Without one, only the visibility score is available.
			const score = session
				? Math.round(Math.min(geometricResult.score, modelConfidence * 100))
				: geometricResult.score;

			appState.score = score;
			appState.confidence = modelConfidence;
			appState.issues = geometricResult.issues;
			appState.top = predictions.slice(0, 3);

			if (!session) {
				appState.resultSummary = msg('geometricOnlySummary');
				appState.feedback = [msg('geometricOnlyFeedback')];
				appState.confidence = geometricResult.confidence;
				appState.status = 'success';
				return;
			}

			appState.progress = track(appState.selectedWord, score >= LEARNED_SCORE, score);

			const recognized = modelMatchesSelectedWord && modelConfidence >= 0.6;
			appState.quizStreak = recognized ? appState.quizStreak + 1 : 0;

			if (recognized) {
				appState.resultSummary = msg('correctSignSummary');
				appState.feedback = [msg('recognizedFeedback', appState.selectedWord)];
			} else if (modelConfidence >= 0.25) {
				appState.resultSummary = msg('closeSignSummary');
				appState.feedback = [
					msg('closeFeedback', topPrediction?.label ?? msg('anotherSign'))
				];
			} else {
				appState.resultSummary = msg('needsImprovementSummary');
				appState.feedback = [msg('notRecognizedFeedback', appState.selectedWord)];
			}

			appState.status = 'success';
			await tick();
			playReplay();
		} catch (error) {
			console.error('Practice analysis failed:', error);
			appState.status = 'error';
			appState.feedback = [msg('analysisFailed')];
		}
	}

	// Manual start button: immediate in auto mode (the detector ends it), countdown otherwise.
	function startPractice() {
		if (!appState.selectedWord) return;
		if (appState.auto) beginRecording();
		else startCountdown();
	}

	function setAuto(on: boolean) {
		appState.auto = on;
		detector.reset();
		if (on && appState.status === 'countdown') resetPractice();
	}

	function resetPractice() {
		detector.reset();
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = null;
		}
		clearOverlay();
		appState.status = 'idle';
		appState.countdown = 0;
		captureFrames = [];
		appState.score = 0;
		appState.confidence = 0;
		appState.resultSummary = null;
		appState.feedback = [msg('defaultFeedback')];
		appState.issues = [];
		appState.top = [];
		if (replayRaf) cancelAnimationFrame(replayRaf);
		reference = null;
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

	const queuePos = $derived(appState.queue.indexOf(appState.selectedWord));
	const wordData = $derived(selectedWordData());
	const best = $derived(appState.progress.words[appState.selectedWord]?.best);
	const similar = $derived(similarTo(appState.selectedWord, appState.words.map((w) => w.label)));
	const topicName = $derived(topicOf(appState.selectedWord)?.[i18n.lang]);

	function stepQueue(delta: number) {
		const next = appState.queue[queuePos + delta];
		if (next) handleWordSelect(next);
	}

	// Keep the speed on the element: changing src resets playbackRate to defaultPlaybackRate.
	$effect(() => {
		if (!refVideo) return;
		void appState.selectedWord;
		refVideo.defaultPlaybackRate = appState.refSpeed;
		refVideo.playbackRate = appState.refSpeed;
	});

	function drawSequence(canvas: HTMLCanvasElement, frames: CapturedFrame[], t: number) {
		const ctx = canvas.getContext('2d');
		if (!ctx || frames.length === 0) return;
		const frame = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))];
		const utils = new DrawingUtils(ctx);
		const seen = (points: CapturedFrame['pose']) => points.some((p) => p.x !== 0 || p.y !== 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const draw = (points: CapturedFrame['pose'], connections: typeof PoseLandmarker.POSE_CONNECTIONS, color: string) => {
			if (!seen(points)) return;
			utils.drawConnectors(points as NormalizedLandmark[], connections, { color, lineWidth: 2 });
			utils.drawLandmarks(points as NormalizedLandmark[], { radius: 2, color });
		};
		draw(frame.pose, PoseLandmarker.POSE_CONNECTIONS, '#00FF00');
		draw(frame.leftHand, HandLandmarker.HAND_CONNECTIONS, '#00FFFF');
		draw(frame.rightHand, HandLandmarker.HAND_CONNECTIONS, '#FFB000');
	}

	// Both clips play in real time from the same start and hold their last frame.
	function playReplay() {
		if (replayRaf) cancelAnimationFrame(replayRaf);
		if (!learnerCanvas || replayFrames.length === 0) return;
		learnerCanvas.width = 320;
		learnerCanvas.height = Math.round(320 / replayAspect);
		if (refCanvas && reference) {
			refCanvas.width = 320;
			refCanvas.height = Math.round(320 / reference.aspect);
		}
		const start = performance.now();
		const total = Math.max(replayMs, reference?.durationMs ?? 0);
		const frame = (now: number) => {
			const elapsed = now - start;
			if (learnerCanvas) drawSequence(learnerCanvas, replayFrames, Math.min(elapsed / replayMs, 0.999));
			if (refCanvas && reference) {
				drawSequence(refCanvas, reference.frames, Math.min(elapsed / reference.durationMs, 0.999));
			}
			replayRaf = elapsed < total ? requestAnimationFrame(frame) : null;
		};
		replayRaf = requestAnimationFrame(frame);
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
				{#if appState.selectedWord}
					<p class="meta">
						{i18n.t.englishLabel}: <strong>{englishOf(appState.selectedWord)}</strong>
						{#if topicName}· {topicName}{/if}
						· {best === undefined ? i18n.t.notPracticed : i18n.t.bestScore(best)}
					</p>
				{/if}
				{#if similar.length > 0}
					<p class="meta">
						{i18n.t.similarSigns}:
						{#each similar as other (other)}
							<button type="button" class="chip" onclick={() => handleWordSelect(other)}>{other}</button>
						{/each}
					</p>
				{/if}
				{#if appState.queue.length > 1}
					<div class="status-row queue-nav">
						<button type="button" class="ghost" disabled={queuePos <= 0} onclick={() => stepQueue(-1)}>
							{i18n.t.prevWord}
						</button>
						<span class="muted" role="status">{i18n.t.queuePosition(queuePos + 1, appState.queue.length)}</span>
						<button
							type="button"
							class="ghost"
							disabled={queuePos < 0 || queuePos >= appState.queue.length - 1}
							onclick={() => stepQueue(1)}
						>
							{i18n.t.nextWord}
						</button>
					</div>
				{/if}
			</div>

			<div class="reference-box">
				{#if appState.quiz && appState.status !== 'success'}
					<div class="placeholder"><p>{i18n.t.quizSignHidden}</p></div>
				{:else if wordData}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={refVideo}
						class:mirrored={appState.refMirror}
						controls
						autoplay
						muted
						playsinline
						loop={appState.refLoop}
						src={asset(videoPath(wordData.index))}
						poster={asset(posterPath(wordData.index))}
						aria-label={i18n.t.refVideoLabel(wordData.label)}
					></video>
				{:else}
					<div class="placeholder">
						<p>{i18n.t.noReferenceVideo}</p>
					</div>
				{/if}
			</div>

			<div class="status-row ref-controls">
				<span id="speed-label" class="muted">{i18n.t.speedLabel}</span>
				<div role="group" aria-labelledby="speed-label" class="speeds">
					{#each [1, 0.75, 0.5] as speed (speed)}
						<button
							type="button"
							class="ghost"
							aria-pressed={appState.refSpeed === speed}
							class:on={appState.refSpeed === speed}
							onclick={() => (appState.refSpeed = speed)}>{speed}×</button
						>
					{/each}
				</div>
				<label><input type="checkbox" bind:checked={appState.refLoop} /> {i18n.t.loopLabel}</label>
				<label><input type="checkbox" bind:checked={appState.refMirror} /> {i18n.t.mirrorLabel}</label>
			</div>

			<div class="camera-box">
				<video bind:this={videoElement} class="mirrored" muted playsinline autoplay></video>
				<canvas bind:this={canvasElement} class="overlay mirrored"></canvas>
				{#if appState.status === 'recording'}
					<div class="rec-indicator">{i18n.t.recordingRemaining(appState.recordRemaining)}</div>
				{/if}
			</div>

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
				{#if appState.auto && appState.modelReady && appState.cameraReady && appState.status !== 'countdown' && appState.status !== 'analyzing'}
					<span class="muted">
						{appState.status === 'recording' ? i18n.t.autoSigning : i18n.t.autoWaiting}
					</span>
				{/if}
			</div>

			<div class="status-row">
				<button
					type="button"
					class="primary"
					disabled={!appState.modelReady || !appState.cameraReady}
					onclick={startPractice}
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

			{#if appState.modelsLoading}
				<div class="loading" role="status">{i18n.t.loadingModels}</div>
			{/if}

			{#if appState.error}
				<div class="alert">{i18n.render(appState.error)}</div>
			{/if}

			{#if appState.status === 'success'}
				<div class="result-card">
					<div class="score-row">
						<strong>{appState.score}%</strong>
						<span>{i18n.render(appState.resultSummary)}</span>
						{#if appState.quiz && appState.quizStreak >= 2}
							<span role="img" aria-label={i18n.t.quizStreak(appState.quizStreak)}>🔥 {appState.quizStreak}</span>
						{/if}
					</div>
					{#if appState.quiz && appState.quizStreak > 0}<FireBurst streak={appState.quizStreak} />{/if}

					<p class="confidence">{i18n.t.confidenceLabel(Math.round(appState.confidence * 100))}</p>

					{#if appState.top.length > 0}
						<p class="meta"><strong>{i18n.t.topGuesses}:</strong></p>
						<ol class="top">
							{#each appState.top as guess (guess.index)}
								<li>{guess.label} <span class="muted">{Math.round(guess.confidence * 100)}%</span></li>
							{/each}
						</ol>
					{/if}

					{#if appState.issues.length > 0}
						<ul>
								{#each appState.issues as issue (issue.id)}
									<li>
										<strong>{i18n.t[issue.titleKey]}:</strong>
										{i18n.t[issue.messageKey]}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			{#if appState.status === 'success' && replayFrames.length > 0}
				<div class="replay">
					<div class="header-row">
						<h3>{i18n.t.replayTitle}</h3>
						<button type="button" class="ghost" onclick={playReplay}>{i18n.t.replayPlay}</button>
					</div>
					<div class="replay-grid">
						<figure>
							<canvas bind:this={learnerCanvas} aria-label={i18n.t.replayYouLabel}></canvas>
							<figcaption>{i18n.t.replayYou}</figcaption>
						</figure>
						<figure>
							{#if reference}
								<canvas bind:this={refCanvas} aria-label={i18n.t.replayRefLabel}></canvas>
								<figcaption>{i18n.t.replayRef}</figcaption>
							{:else}
								<p class="muted">{i18n.t.replayNoRef}</p>
							{/if}
						</figure>
					</div>
				</div>
			{/if}

			<div class="feedback">
				{feedbackText}
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
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
		margin-bottom: 14px;
		border-radius: 12px;
	}

	.reference-box {
		margin-bottom: 14px;
		border-radius: 12px;
	}

	.reference-box video {
		display: block;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
	}

	.camera-box video,
	.camera-box .overlay {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.camera-box .overlay {
		pointer-events: none;
	}

	.camera-box .mirrored {
		transform: scaleX(-1);
	}

	.rec-indicator {
		position: absolute;
		top: 10px;
		left: 12px;
		padding: 4px 10px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.55);
		color: var(--danger);
		font: 700 0.95rem/1.2 monospace;
	}

	.loading {
		margin-bottom: 12px;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--panel-alt);
		border: 1px solid var(--panel-border);
		color: var(--text-muted);
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
        position: relative;
        background: var(--success-soft);
        border: 1px solid var(--success-border);
        padding: 14px 16px;
        border-radius: 12px;
        margin-bottom: 12px;
    }

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

	.meta {
		margin: 6px 0 0;
		color: var(--text-muted);
	}

	.meta strong {
		color: var(--text);
	}

	.chip {
		margin: 2px 4px 2px 0;
		padding: 2px 10px;
		border-radius: 999px;
		border: 1px solid var(--panel-border);
		background: var(--panel-alt);
		color: var(--text);
		cursor: pointer;
	}

	.queue-nav,
	.ref-controls {
		align-items: center;
	}

	.ref-controls label {
		color: var(--text-muted);
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.ref-controls input {
		width: auto;
	}

	.speeds {
		display: flex;
		gap: 6px;
	}

	button.ghost.on {
		border-color: var(--primary);
		color: var(--text);
	}

	.reference-box video.mirrored {
		transform: scaleX(-1);
	}

	.top {
		margin: 0 0 12px;
		padding-left: 22px;
	}

	.replay {
		margin-bottom: 12px;
	}

	.replay h3 {
		margin: 0;
	}

	.replay-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.replay figure {
		margin: 0;
	}

	.replay canvas {
		width: 100%;
		height: auto;
		display: block;
		background: var(--panel-alt);
		border: 1px solid var(--panel-border);
		border-radius: 10px;
		transform: scaleX(-1);
	}

	.replay figcaption {
		text-align: center;
		color: var(--text-muted);
		margin-top: 4px;
	}

</style>