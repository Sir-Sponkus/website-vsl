<script lang="ts">

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/32x32.png" />
</svelte:head>

{@render children()}
