<script lang="ts">
	import { i18n } from '$lib/i18n/i18n.svelte';
</script>

<main class="page">
	<article class="panel">
		<h1>{i18n.t.aboutTitle}</h1>
		{#each i18n.t.aboutItems as item (item.h)}
			<section>
				<h2>{item.h}</h2>
				<p>{item.p}</p>
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

	p {
		line-height: 1.6;
		margin-top: 0;
	}
</style>
