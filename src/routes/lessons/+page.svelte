<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/i18n.svelte';
	import { TOPICS } from '$lib/learning/lessons';
	import { dueWords, isLearned, loadProgress, streak } from '$lib/learning/progress';
	import type { Progress } from '$lib/learning/progress';

	let progress = $state<Progress>({ words: {}, days: [] });
	onMount(() => (progress = loadProgress()));

	const learned = (labels: string[]) => labels.filter((label) => isLearned(progress, label)).length;
	const total = TOPICS.reduce((sum, t) => sum + Object.keys(t.words).length, 0);
	const due = $derived(dueWords(progress).length);
</script>

<main class="page">
	<section class="panel">
		<h1>{i18n.t.lessonsTitle}</h1>
		<p class="muted">{i18n.t.lessonsIntro}</p>
		<p class="stats">
			<strong>{i18n.t.streakLabel(streak(progress))}</strong>
			<span>{i18n.t.learnedTotal(learned(TOPICS.flatMap((t) => Object.keys(t.words))), total)}</span>
		</p>

		<div class="review">
			<h2>{i18n.t.reviewTitle}</h2>
			<p>{due > 0 ? i18n.t.reviewDue(due) : i18n.t.reviewNone}</p>
			{#if due > 0}
				<a class="btn" href={resolve('/learn') + '?review=1'}>{i18n.t.reviewStart}</a>
			{/if}
		</div>

		<ul class="topics">
			{#each TOPICS as topic (topic.id)}
				{@const words = Object.keys(topic.words)}
				<li class="topic">
					<h2>{topic[i18n.lang]}</h2>
					<progress max={words.length} value={learned(words)} aria-label={topic[i18n.lang]}></progress>
					<p class="muted">{i18n.t.topicProgress(learned(words), words.length)}</p>
					<a class="btn" href={resolve('/learn') + '?topic=' + topic.id}>{i18n.t.startPractice}</a>
				</li>
			{/each}
		</ul>
		<p class="muted note">{i18n.t.progressNote}</p>
	</section>
</main>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
	}

	h1,
	h2 {
		margin: 0 0 8px;
	}

	h2 {
		font-size: 1.1rem;
	}

	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
	}

	.review,
	.topic {
		background: var(--panel-alt);
		border: 1px solid var(--panel-border);
		border-radius: 12px;
		padding: 14px;
	}

	.review {
		margin: 14px 0;
	}

	.topics {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
	}

	progress {
		width: 100%;
		accent-color: var(--success);
	}

	.btn {
		display: inline-block;
		padding: 8px 14px;
		border-radius: 10px;
		background: var(--primary);
		color: var(--primary-ink);
		text-decoration: none;
	}

	.btn:hover {
		background: var(--primary-hover);
	}

	.note {
		margin-bottom: 0;
	}
</style>
