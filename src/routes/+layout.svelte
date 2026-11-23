<script lang="ts">
	import '../app.css';
	import '@fortawesome/fontawesome-free/css/all.min.css';
	import { i18n } from '$lib/i18n/i18n.svelte';
	let { children } = $props();
	import { asset, resolve } from '$app/paths';

	// Keep <html lang> in sync with the selected language.
	$effect(() => {
		document.documentElement.lang = i18n.lang;
	});

	// app.html sets data-theme before paint; this only mirrors and toggles it.
	let theme = $state<'light' | 'dark'>('dark');
	$effect(() => {
		theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
	});

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// storage unavailable: the choice just lasts for this visit
		}
	}



</script>

<svelte:head>
	<title>VSLink</title>
	<link rel="icon" href={asset('/eye.svg')} type="image/svg+xml" />
</svelte:head>

<nav class="top-nav" aria-label="Main navigation">
	<div class="nav-inner">
		<a href={resolve('/')} class="nav-brand"><img src={asset('/images/vslink.svg')} alt="vslink" /></a>
		<div class="nav-links">
			<a href={resolve('/learn')}>{i18n.t.learnButton}</a>
			<a href={resolve('/lessons')}>{i18n.t.navLessons}</a>
			<a href={resolve('/quiz')}>{i18n.t.navQuiz}</a>
			<a href={resolve('/translate')}>{i18n.t.translateButton}</a>
			<a href={resolve('/about')}>{i18n.t.navAbout}</a>
		</div>
		<div class="lang-switch">
			<button
				type="button"
				class="lang-btn"
				onclick={toggleTheme}
				aria-label={theme === 'light' ? i18n.t.themeToDark : i18n.t.themeToLight}
				title={theme === 'light' ? i18n.t.themeToDark : i18n.t.themeToLight}
			>
				<i class="fa-solid {theme === 'light' ? 'fa-moon' : 'fa-sun'}" aria-hidden="true"></i>
			</button>
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
	}

	.nav-brand img {
		display: block;
		width: 100px;
		height: auto;
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
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
	}

	.nav-links a {
		color: var(--text);
		text-decoration: none;
		padding: 8px 10px;
		border-radius: 8px;
		transition: background 0.2s ease, color 0.2s ease;
	}

	.nav-links a:hover {
		background: var(--primary-soft);
		color: var(--primary-hover);
	}

	.lang-switch {
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
 
	.lang-btn:hover:not(.active) {
		border-color: var(--primary);
		color: var(--primary-hover);
	}

	.lang-btn.active {
		background: var(--primary-active);
		color: var(--ink);
		border-color: var(--amber);
	}

	@media (max-width: 560px) {
		.nav-inner {
			padding: 10px 14px;
			gap: 8px 10px;
		}

		.nav-brand img {
			width: 80px;
		}

		/* Brand + language switch share the first row; the links get their own. */
		.nav-links {
			order: 3;
			width: 100%;
			gap: 2px;
		}

		.nav-links a {
			padding: 6px 8px;
			font-size: 0.9rem;
		}
	}
</style>
