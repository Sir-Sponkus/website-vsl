<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { i18n } from '$lib/i18n/i18n.svelte';
</script>

<main class="page home-page">
	<section class="hero">
		<img class="hero-logo" src={asset('/images/vslink.svg')} alt="vslink" />
		<div class="tagline">
			{i18n.t.heroTagline.before}<span class="accent">{i18n.t.heroTagline.learn}</span>{i18n.t.heroTagline.and}<span class="accent">{i18n.t.heroTagline.translate}</span>{i18n.t.heroTagline.mid}<span class="accent">{i18n.t.heroTagline.realtime}</span>{i18n.t.heroTagline.after}
		</div>
	</section>

	<nav class="cards" aria-label="Sections">
		<a class="card" href={resolve('/learn')}>
			<i class="fa-solid fa-hand" aria-hidden="true"></i>
			<h2>{i18n.t.learnButton}</h2>
			<p>{i18n.t.cardLearnDesc}</p>
		</a>
		<a class="card" href={resolve('/lessons')}>
			<i class="fa-solid fa-book-open" aria-hidden="true"></i>
			<h2>{i18n.t.navLessons}</h2>
			<p>{i18n.t.cardLessonsDesc}</p>
		</a>
		<a class="card" href={resolve('/quiz')}>
			<i class="fa-solid fa-circle-question" aria-hidden="true"></i>
			<h2>{i18n.t.navQuiz}</h2>
			<p>{i18n.t.cardQuizDesc}</p>
		</a>
		<a class="card" href={resolve('/translate')}>
			<i class="fa-solid fa-language" aria-hidden="true"></i>
			<h2>{i18n.t.translateButton}</h2>
			<p>{i18n.t.cardTranslateDesc}</p>
		</a>
	</nav>

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

	.cards {
		max-width: 1100px;
		width: 100%;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 18px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		padding: 22px 18px;
		background: var(--panel-alt);
		border: 1px solid var(--panel-border);
		border-radius: 18px;
		color: var(--text);
		text-decoration: none;
		box-shadow: 0 4px 18px var(--shadow);
		transition: transform 0.15s ease, border-color 0.15s ease;
	}

	.card:hover,
	.card:focus-visible {
		transform: translateY(-3px);
		border-color: var(--primary);
	}

	.card:focus-visible {
		outline: 3px solid var(--primary);
		outline-offset: 3px;
	}

	.card i {
		font-size: 1.8rem;
		color: var(--primary);
	}

	.card h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.card p {
		margin: 0;
		color: var(--muted);
		line-height: 1.5;
	}

	@media (max-width: 1000px) {
		.cards {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 560px) {
		.cards {
			grid-template-columns: 1fr;
		}
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
