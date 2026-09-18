<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';

	function goTranslate() {
		goto(resolve('/translate/'));
	}

	function goLearn() {
		goto(resolve('/learn/'));
	}
</script>

<main class="page home-page">
	<section class="hero">
		<img src={asset('/images/vslink.svg')} alt="vslink" width=50% height="auto" />
		<div class="tagline">
			An AI-powered tool that helps you <span class="accent">learn</span> and <span class="accent">translate</span> Vietnamese Sign Language in <span class="accent">real-time</span>.
		</div>
		<div class="button-row">
			<button class="primary-btn" onclick={goLearn}>Learn</button>
			<button class="secondary-btn" onclick={goTranslate}>Translate</button>
		</div>
	</section>

	<section class="features">
		<div class="feature-card">
			<h3>Practice words</h3>
			<p>Choose from a dictionary of sign words and get feedback on hand placement and motion.</p>
		</div>
		<div class="feature-card">
			<h3>Live recognition</h3>
			<p>Use your camera to test signs and view model predictions in real time.</p>
		</div>
		<div class="feature-card">
			<h3>Feedback-first</h3>
			<p>See where to improve: hand height, spacing, finger spread, motion, and openness.</p>
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
		gap: 16px;
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
		grid-template-columns: repeat(3, minmax(200px, 1fr));
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
</style>