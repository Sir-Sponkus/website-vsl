<script lang="ts">
	import '../app.css'
	let { children } = $props();
</script>

<svelte:head>
	<title>VSLink</title>
	<link rel="icon" href="/32x32.png" />
</svelte:head>


{@render children()}
