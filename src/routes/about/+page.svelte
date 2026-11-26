<script lang="ts">
	import { i18n } from '$lib/i18n/i18n.svelte';

	// Add more contributors here.
	const contributors = [{ name: 'Sir-Sponkus', role: 'lead' }];
</script>

<main class="page">
	<article class="panel">
		<h1>{i18n.t.aboutTitle}</h1>
		{#each i18n.t.aboutItems as item (item.h)}
			<section>
				<h2>{item.h}</h2>
				<!-- static strings from i18n, never user input -->
				<div class="body">{@html item.p}</div>
			</section>
		{/each}
	</article>
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
		margin-bottom: 6px;
	}

	h3 {
		font-size: 1rem;
		margin-bottom: 6px;
	}

	.body {
		line-height: 1.6;
	}

	.body :global(p) {
		margin: 0 0 8px;
	}

	.body :global(ul),
	.body :global(ol) {
		margin: 0 0 8px;
		padding-left: 1.2rem;
	}

	ul {
		margin: 0;
		padding-left: 1.2rem;
		line-height: 1.6;
	}

	.muted {
		color: var(--text-muted);
	}
</style>
