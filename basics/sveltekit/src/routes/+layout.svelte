<script lang="ts">
	import { AuthState, setAuthContext } from '$lib/auth.svelte';
	import Header from '$lib/components/Header.svelte';
	import '../app.css';

	let { children } = $props();

	// Create and provide auth context
	const auth = new AuthState();
	setAuthContext(auth);
</script>

<svelte:head>
	<title>Burrito consideration app</title>
	<meta name="description" content="Consider the potential of burritos with PostHog analytics" />
</svelte:head>

<Header />
<main>
	{@render children()}
</main>
