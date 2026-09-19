<script lang="ts">
	import '../app.css';
	import { i18n } from '$lib/i18n/i18n.svelte';
	let { children } = $props();
	import { asset, resolve } from '$app/paths';



</script>

<svelte:head>
	<title>VSLink</title>
	<link rel="icon" href={asset('/eye.svg')} type="image/svg+xml" />
</svelte:head>

<nav class="top-nav" aria-label="Main navigation">
	<div class="nav-inner">
		<a href={resolve('/')} class="nav-brand"><img src={asset('/images/vslink.svg')} alt="vslink" width="100" height="auto" /></a>
		<div class="nav-links">
			<a href={resolve('/learn')}>{i18n.t.learnButton}</a>
			<a href={resolve('/translate')}>{i18n.t.translateButton}</a>
		</div>
		<div class="lang-switch">
			<button
				type="button"
				class="lang-btn"
				class:active={i18n.lang === 'en'}
				onclick={() => i18n.setLang('en')}
			>
				EN
			</button>
			<button
				type="button"
				class="lang-btn"
				class:active={i18n.lang === 'vi'}
				onclick={() => i18n.setLang('vi')}
			>
				VI
			</button>
</div>
		
	</div>
</nav>

{@render children()}

<style>
	.top-nav {
		position: sticky;
		top: 0;
		z-index: 20;
		background: var(--nav-bg);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--panel-border);
	}

	.nav-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 14px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.nav-brand {
		color: var(--primary);
		text-decoration: none;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.nav-links a {
		color: var(--text);
		text-decoration: none;
		padding: 8px 10px;
		border-radius: 8px;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.nav-links a:hover {
		background: rgba(199, 158, 55, 0.12);
		color: var(--primary);
	}

	.lang-switch {
		position: fixed;
		top: 12px;
		right: 20px;
		z-index: 50;
		display: flex;
		gap: 6px;
	}
 
	.lang-btn {
		width: 40px;
		border: 1px solid var(--panel-border);
		background: var(--panel);
		color: var(--text);
		border-radius: 8px;
		padding: 6px 0;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: center;
		cursor: pointer;
	}
 
	.lang-btn.active {
		background: var(--primary-active);
		color: var(--ink);
		border-color: var(--amber);
	}
</style>