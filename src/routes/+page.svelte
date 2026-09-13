<script lang="ts">
import {goto} from '$app/navigation';
import {asset} from '$app/paths';

function goTranslate() {
	goto('/translate');
}

function goLearn() {
	goto('/learn/');
}
</script>

<main>
	<section class="hero">
		<div class="center big-text bold vslink">
			VSLink
		</div>
		<div class="center vslink-description italic">
			An AI-powered tool that helps you <span class="mauve">learn</span> and <span class="mauve">translate</span> Vietnamese Sign Language in <span class="mauve">real-time</span>.
		</div>
		<div class="button-row">
			<button class="btn" onclick={goLearn}>Learn</button>
			<button class="btn" onclick={goTranslate}>Translate</button>
		</div>
	</section>

	<section class="more-content">
		<p>
			Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
			tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
			veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
			commodo consequat.
		</p>
		<p>
			Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
			dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
			proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
		</p>
		<p>
			Sed ut perspiciatis unde omnis iste natus error sit voluptatem
			accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab
			illo inventore veritatis et quasi architecto beatae vitae dicta sunt
			explicabo.
		</p>
	</section>
</main>

<style>
.center {
	text-align: center;
}
.bold {
	font-weight: bold;
}
.italic {
	font-style: italic;
}

.big-text {
	font-size: 3em;
}

.vslink {
	color: var(--mauve);
	padding: 20px;
}

.vslink-description {
	color: var(--foreground1);
	font-size: 1.5em;
}

.mauve {
	color: var(--mauve);
}

.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	padding: 20px;
}

.button-row {
	display: flex;
	gap: 16px;
	margin-top: 24px;
}

.btn {
	padding: 12px 28px;
	font-size: 1em;
	border: 2px solid var(--mauve);
	border-radius: 8px;
	background: transparent;
	color: var(--mauve);
	cursor: pointer;
	transition: background 0.2s, color 0.2s;
}

.btn:hover {
	background: var(--mauve);
	color: var(--background, #fff);
}

.more-content {
	max-width: 700px;
	margin: 0 auto;
	padding: 60px 20px;
	line-height: 1.6;
	color: var(--foreground1);
}
</style>