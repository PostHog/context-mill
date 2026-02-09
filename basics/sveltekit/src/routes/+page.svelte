<script lang="ts">
	import { getAuthContext } from '$lib/auth.svelte';

	const auth = getAuthContext();

	let username = $state('');
	let password = $state('');
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		try {
			const success = await auth.login(username, password);
			if (success) {
				username = '';
				password = '';
			} else {
				error = 'Please provide both username and password';
			}
		} catch (err) {
			console.error('Login failed:', err);
			error = 'An error occurred during login';
		}
	}
</script>

<div class="container">
	{#if auth.user}
		<h1>Welcome back, {auth.user.username}!</h1>
		<p>You are now logged in. Check out the navigation to explore features.</p>
		<ul>
			<li><a href="/burrito">Consider a burrito</a></li>
			<li><a href="/profile">View your profile</a></li>
		</ul>
	{:else}
		<h1>Welcome to Burrito consideration app</h1>
		<p>Sign in to start considering burritos.</p>

		<form class="form" onsubmit={handleSubmit}>
			<div class="form-group">
				<label for="username">Username:</label>
				<input type="text" id="username" bind:value={username} required />
			</div>

			<div class="form-group">
				<label for="password">Password:</label>
				<input type="password" id="password" bind:value={password} required />
			</div>

			{#if error}
				<p class="error">{error}</p>
			{/if}

			<button type="submit" class="btn-primary">Sign In</button>
		</form>

		<p class="note">
			Enter any username and password to sign in. This is a demo app.
		</p>
	{/if}
</div>
