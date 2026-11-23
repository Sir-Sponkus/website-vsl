<script lang="ts">
	import { onMount } from 'svelte';
	import { i18n } from '$lib/i18n/i18n.svelte';

	type Tab = 'about' | 'contributions';
	const tabs: Tab[] = ['about', 'contributions'];

	// Add more contributors here.
	const contributors = [{ name: 'Sir-Sponkus', role: 'lead' }];

	let tab = $state<Tab>('about');

	onMount(() => {
		const sync = () => (tab = location.hash === '#contributions' ? 'contributions' : 'about');
		sync();
		addEventListener('hashchange', sync);
		return () => removeEventListener('hashchange', sync);
	});

	function select(next: Tab, focus = false) {
		tab = next;
		history.replaceState(null, '', next === 'contributions' ? '#contributions' : location.pathname + location.search);
		if (focus) document.getElementById(`tab-${next}`)?.focus();
	}

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
		e.preventDefault();
		select(tabs[(tabs.indexOf(tab) + 1) % tabs.length], true);
	}

	const label = (t: Tab) => (t === 'about' ? i18n.t.aboutTabAbout : i18n.t.aboutTabContrib);
</script>

<main class="page">
	<article class="panel">
		<div class="tabs" role="tablist" aria-label={i18n.t.aboutTabsLabel}>
			{#each tabs as t (t)}
				<button
					type="button"
					role="tab"
					id="tab-{t}"
					aria-selected={tab === t}
					aria-controls="panel-{t}"
					tabindex={tab === t ? 0 : -1}
					class:active={tab === t}
					onclick={() => select(t)}
					onkeydown={onKey}>{label(t)}</button
				>
			{/each}
		</div>

		{#if tab === 'about'}
			<div role="tabpanel" id="panel-about" aria-labelledby="tab-about">
				<h1>{i18n.t.aboutTitle}</h1>
				{#each i18n.t.aboutItems as item (item.h)}
					<section>
						<h2>{item.h}</h2>
						<p>{item.p}</p>
					</section>
				{/each}
			</div>
		{:else}
			<div role="tabpanel" id="panel-contributions" aria-labelledby="tab-contributions">
				<h1>{i18n.t.aboutTabContrib}</h1>
				<section>
					<h2>{i18n.t.contribContributors}</h2>
					<ul>
						{#each contributors as c (c.name)}
							<li><strong>{c.name}</strong> <span class="muted">- {i18n.t.contribRoleLead}</span></li>
						{/each}
					</ul>
				</section>
				<section>
					<h2>{i18n.t.contribBuiltWith}</h2>
					<ul>
						{#each i18n.t.contribBuiltItems as b (b.n)}
							<li><strong>{b.n}</strong> <span class="muted">- {b.d}</span></li>
						{/each}
					</ul>
				</section>
				<section>
					<h2>{i18n.t.contribHow}</h2>
					<ul>
						{#each i18n.t.contribHowItems as item (item)}
							<li>{item}</li>
						{/each}
					</ul>
				</section>
			</div>
		{/if}
	</article>
</main>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
	}

	.tabs {
		display: flex;
		gap: 6px;
		margin-bottom: 16px;
		padding: 4px;
		background: var(--panel-alt);
		border: 1px solid var(--panel-border);
		border-radius: 10px;
	}

	.tabs button {
		flex: 1;
		padding: 8px 12px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		cursor: pointer;
	}

	.tabs button.active {
		background: var(--primary);
		color: var(--text);
	}

	.tabs button:focus-visible {
		outline: 2px solid var(--primary-hover);
		outline-offset: 2px;
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

	ul {
		margin: 0;
		padding-left: 1.2rem;
		line-height: 1.6;
	}

	.muted {
		color: var(--text-muted);
	}
</style>
