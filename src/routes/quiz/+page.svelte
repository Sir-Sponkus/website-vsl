<script lang="ts">
	import { onMount } from 'svelte';
	import { asset, resolve } from '$app/paths';
	import FireBurst from '$lib/components/FireBurst.svelte';
	import { i18n } from '$lib/i18n/i18n.svelte';
	import { pickOptions, posterPath, shuffle, videoPath } from '$lib/learning/lessons';
	import { track } from '$lib/learning/progress';
	import { loadLabels } from '$lib/sign-recognition/models';

	const QUESTIONS = 10;

	let labels = $state<string[]>([]);
	let phase = $state<'menu' | 'watch' | 'done'>('menu');
	let questions = $state<{ answer: string; options: string[] }[]>([]);
	let index = $state(0);
	let picked = $state<string | null>(null);
	let score = $state(0);
	let streak = $state(0);

	onMount(async () => (labels = await loadLabels()));

	const question = $derived(questions[index]);

	function startWatch() {
		questions = shuffle(labels)
			.slice(0, QUESTIONS)
			.map((answer) => ({ answer, options: pickOptions(answer, labels) }));
		index = 0;
		score = 0;
		streak = 0;
		picked = null;
		phase = 'watch';
	}

	function choose(option: string) {
		if (picked !== null) return;
		picked = option;
		const correct = option === question.answer;
		if (correct) score += 1;
		streak = correct ? streak + 1 : 0;
		track(question.answer, correct, null); // quiz answers schedule review but don't change best score
	}

	function next() {
		if (index + 1 >= questions.length) {
			phase = 'done';
		} else {
			index += 1;
			picked = null;
		}
	}
</script>

<main class="page">
	<section class="panel">
		<h1>{i18n.t.quizTitle}</h1>

		{#if phase === 'menu'}
			<p class="muted">{i18n.t.quizIntro}</p>
			{#if labels.length === 0}
				<p class="muted" role="status">{i18n.t.quizLoading}</p>
			{/if}
			<div class="modes">
				<div class="mode">
					<h2>{i18n.t.quizWatchTitle}</h2>
					<p>{i18n.t.quizWatchBody}</p>
					<button type="button" class="btn" disabled={labels.length === 0} onclick={startWatch}>
						{i18n.t.quizStart}
					</button>
				</div>
				<div class="mode">
					<h2>{i18n.t.quizSignTitle}</h2>
					<p>{i18n.t.quizSignBody}</p>
					<a class="btn" href={resolve('/learn') + '?quiz=1'}>{i18n.t.quizStart}</a>
				</div>
			</div>
		{:else if phase === 'watch' && question}
			<p class="muted">
				{i18n.t.quizQuestion(index + 1, questions.length)}
				{#if streak >= 2}<span class="streak" role="img" aria-label={i18n.t.quizStreak(streak)}>🔥 {streak}</span>{/if}
			</p>
			<h2>{i18n.t.quizWatchPrompt}</h2>
			{@const at = labels.indexOf(question.answer)}
			<div class="video">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					src={asset(videoPath(at))}
					poster={asset(posterPath(at))}
					aria-label={i18n.t.quizVideoLabel}
					autoplay
					muted
					loop
					controls
					playsinline
				></video>
			</div>
			<div class="options" role="group" aria-label={i18n.t.quizOptionsLabel}>
				{#each question.options as option (option)}
					<button
						type="button"
						class:right={picked !== null && option === question.answer}
						class:wrong={picked === option && option !== question.answer}
						disabled={picked !== null}
						onclick={() => choose(option)}
					>
						{option}
						{#if picked === option && option === question.answer}<FireBurst {streak} />{/if}
					</button>
				{/each}
			</div>
			<div role="status">
				{#if picked !== null}
					<p>{picked === question.answer ? i18n.t.quizCorrect : i18n.t.quizWrong(question.answer)}</p>
					<button type="button" class="btn" onclick={next}>
						{index + 1 >= questions.length ? i18n.t.quizFinish : i18n.t.quizNext}
					</button>
				{/if}
			</div>
		{:else}
			<h2>{i18n.t.quizResult(score, questions.length)}</h2>
			<button type="button" class="btn" onclick={startWatch}>{i18n.t.quizAgain}</button>
		{/if}
	</section>
</main>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
	}

	h1 {
		margin-top: 0;
	}

	h2 {
		font-size: 1.15rem;
	}

	.modes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 12px;
	}

	.mode {
		background: var(--panel-alt);
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		padding: 14px;
	}

	.video {
		display: flex;
		justify-content: center;
		background: var(--panel-alt);
		border-radius: 12px;
		overflow: hidden;
		margin-bottom: 14px;
	}

	video {
		display: block;
		max-width: 100%;
		max-height: 340px;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 10px;
		margin-bottom: 12px;
	}

	.options button {
		position: relative;
		padding: 12px;
		border-radius: 10px;
		border: 1px solid var(--panel-border);
		background: var(--panel-alt);
		color: var(--text);
		cursor: pointer;
	}

	.options button:hover:not(:disabled) {
		border-color: var(--primary);
	}

	.options button:disabled {
		cursor: default;
	}

	.options .right {
		background: var(--success-soft);
		border-color: var(--success);
	}

	.options .wrong {
		background: var(--danger-soft);
		border-color: var(--danger);
	}

	.streak {
		margin-left: 8px;
		font-weight: 600;
		color: var(--text);
	}

	.btn {
		display: inline-block;
		padding: 8px 14px;
		border: none;
		border-radius: 10px;
		background: var(--primary);
		color: var(--primary-ink);
		text-decoration: none;
		cursor: pointer;
	}

	.btn:hover:not(:disabled) {
		background: var(--primary-hover);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
