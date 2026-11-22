<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/i18n.svelte';

	function goTranslate() {
		goto(resolve('/translate'));
	}

	function goLearn() {
		goto(resolve('/learn'));
	}
</script>

<main class="page home-page">
	<section class="hero">
		<img class="hero-logo" src={asset('/images/vslink.svg')} alt="vslink" />
		<div class="tagline">
			{i18n.t.heroTagline.before}<span class="accent">{i18n.t.heroTagline.learn}</span>{i18n.t.heroTagline.and}<span class="accent">{i18n.t.heroTagline.translate}</span>{i18n.t.heroTagline.mid}<span class="accent">{i18n.t.heroTagline.realtime}</span>{i18n.t.heroTagline.after}
		</div>
		<div class="button-row">
			<button class="primary-btn" onclick={goLearn}>{i18n.t.learnButton}</button>
			<button class="secondary-btn" onclick={goTranslate}>{i18n.t.translateButton}</button>
		</div>
	</section>

	<section class="features">
		<div class="feature-card">
			<h3>{i18n.t.featurePracticeTitle}</h3>
			<p>{i18n.t.featurePracticeBody}</p>
		</div>
		<div class="feature-card">
			<h3>{i18n.t.featureLiveTitle}</h3>
			<p>{i18n.t.featureLiveBody}</p>
		</div>
		<div class="feature-card">
			<h3>{i18n.t.featureFeedbackTitle}</h3>
			<p>{i18n.t.featureFeedbackBody}</p>
		</div>
	</section>
</main>

<style>
	.home-page {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 36px;
		padding-top: 50px;
		padding-bottom: 60px;
	}

	.hero {
		max-width: 900px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 18px;
	}

	.hero-logo {
		width: min(360px, 70%);
		height: auto;
	}

	.brand {
		font-size: clamp(2.8rem, 7vw, 5rem);
		font-weight: 900;
		color: var(--primary);
		letter-spacing: 0.08em;
	}

	.tagline {
		font-size: clamp(1.1rem, 2vw, 1.7rem);
		line-height: 1.5;
		max-width: 820px;
		color: var(--text);
	}

	.accent {
		color: var(--primary-hover);
		font-weight: 700;
	}

	.button-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 12px 16px;
		margin-top: 12px;
	}

	.primary-btn,
	.secondary-btn {
		border: none;
		border-radius: 12px;
		padding: 12px 26px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.primary-btn {
		background: var(--primary);
		color: var(--ink);
	}

	.secondary-btn {
		background: var(--panel);
		color: var(--text);
		border: 1px solid var(--panel-border);
	}

	.primary-btn:hover,
	.secondary-btn:hover {
		transform: translateY(-1px);
	}

	.features {
		max-width: 1100px;
		width: 100%;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		gap: 18px;
	}

	.feature-card {
		background: var(--panel);
		border: 1px solid var(--panel-border);
		border-radius: 18px;
		padding: 22px 18px;
		box-shadow: 0 4px 18px var(--shadow);
	}

	.feature-card h3 {
		margin-top: 0;
		color: var(--primary);
	}

	.feature-card p {
		margin-bottom: 0;
		color: var(--muted);
		line-height: 1.6;
	}

	@media (max-width: 800px) {
		.home-page {
			padding: 32px 14px 40px;
			gap: 28px;
		}
	}
</style>
