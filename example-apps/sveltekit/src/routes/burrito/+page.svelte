<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import posthog from 'posthog-js';
	import { getAuthContext } from '$lib/auth.svelte';

	const auth = getAuthContext();

	let hasConsidered = $state(false);

	// Redirect to home if not logged in
	$effect(() => {
		if (browser && !auth.user) {
			goto('/');
		}
	});

	function handleConsideration() {
		// Skip capture when no user is logged in instead of using a fallback identity.
		if (!auth.user) return;

		auth.incrementBurritoConsiderations();
		hasConsidered = true;
		setTimeout(() => (hasConsidered = false), 2000);

		// Capture burrito consideration event without PII such as username in event properties.
		if (env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()) {
			posthog.capture('burrito_considered', {
				total_considerations: auth.user.burritoConsiderations
			});
		}
	}
</script>

<div class="container">
	{#if auth.user}
		<h1>Burrito consideration zone</h1>
		<p>This is where you consider the infinite potential of burritos.</p>
		<p>Current considerations: <strong>{auth.user.burritoConsiderations}</strong></p>

		<button class="btn-burrito" onclick={handleConsideration}>
			I have considered the burrito potential
		</button>

		{#if hasConsidered}
			<p class="success">
				Thank you for your consideration! Count: {auth.user.burritoConsiderations}
			</p>
		{/if}

		<div class="note">
			<p>Each consideration is tracked as a PostHog event with custom properties.</p>
		</div>
	{:else}
		<p>Please log in to consider burritos.</p>
	{/if}
</div>
