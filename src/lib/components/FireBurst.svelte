<script lang="ts">
	// Mount it inside a position:relative parent; remount ({#key}) to replay. The animation ends
	// invisible, so there are no timers or frames to clean up.
	let { streak = 1 }: { streak?: number } = $props();

	// svelte-ignore state_referenced_locally
	const level = Math.min(streak, 5); // read once: the component is remounted per burst
	const flames = Array.from({ length: 8 + level * 3 }, (_, i) => ({
		left: 8 + ((i * 37) % 85),
		delay: (i * 53) % 250,
		size: 14 + level * 2 + ((i * 7) % 8),
		rise: 40 + level * 14 + ((i * 11) % 30)
	}));
</script>

<span class="fire" aria-hidden="true" style="--dur: {0.9 + level * 0.1}s">
	{#each flames as f, i (i)}
		<i style="left:{f.left}%;font-size:{f.size}px;--rise:{f.rise}px;animation-delay:{f.delay}ms">🔥</i>
	{/each}
	<b>🔥</b>
</span>

<style>
	.fire {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 2;
	}

	i {
		position: absolute;
		bottom: 40%;
		font-style: normal;
		line-height: 1;
		opacity: 0;
		animation: rise var(--dur) ease-out both;
	}

	/* Static stand-in for users who prefer reduced motion. */
	b {
		display: none;
		position: absolute;
		top: 2px;
		right: 4px;
		font-size: 16px;
	}

	@keyframes rise {
		20% {
			opacity: 1;
		}
		to {
			opacity: 0;
			transform: translateY(calc(var(--rise) * -1)) scale(1.2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		i {
			display: none;
		}

		b {
			display: block;
		}
	}
</style>
