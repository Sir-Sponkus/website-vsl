<script lang="ts">
	import '../app.css';
	let { children } = $props();
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>VSLink</title>
	<link rel="icon" href="/32x32.png" />
</svelte:head>

<nav class="top-nav" aria-label="Main navigation">
	<div class="nav-inner">
		<a href={resolve('/')} class="nav-brand">VSLink</a>
		<div class="nav-links">
			<a href={resolve('/learn')}>Learn</a>
			<a href={resolve('/translate')}>Translate</a>
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
		color: var(--amber-2);
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
		color: var(--amber-2);
	}
</style>