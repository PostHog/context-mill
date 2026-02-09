<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import posthog from 'posthog-js';
	import { getAuthContext } from '$lib/auth.svelte';

	const auth = getAuthContext();

	// Redirect to home if not logged in
	$effect(() => {
		if (browser && !auth.user) {
			goto('/');
		}
	});

	function triggerTestError() {
		try {
			throw new Error('Test error for PostHog error tracking');
		} catch (err) {
			posthog.captureException(err);
			console.error('Captured error:', err);
			alert('Error captured and sent to PostHog!');
		}
	}
</script>

<div class="container">
	{#if auth.user}
		<h1>User profile</h1>

		<div class="stats">
			<h2>Your information</h2>
			<p><strong>Username:</strong> {auth.user.username}</p>
			<p><strong>Burrito considerations:</strong> {auth.user.burritoConsiderations}</p>
		</div>

		<h2 style="margin-top: 2rem;">Error tracking demo</h2>
		<p>Click the button below to trigger a test error that will be captured by PostHog.</p>

		<button class="btn-primary" onclick={triggerTestError} style="margin-top: 1rem;">
			Trigger test error (for PostHog)
		</button>

		<div class="note">
			<p>This demonstrates PostHog's error tracking capabilities.</p>
			<p>The error will appear in your PostHog error tracking dashboard.</p>
		</div>
	{:else}
		<p>Please log in to view your profile.</p>
	{/if}
</div>
