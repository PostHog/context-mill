<script lang="ts">
	import { getAuthContext } from '$lib/auth.svelte';

	const auth = getAuthContext();
</script>

<header class="header">
	<div class="header-container">
		<nav>
			<a href="/">Home</a>
			{#if auth.user}
				<a href="/burrito">Burrito</a>
				<a href="/profile">Profile</a>
			{/if}
		</nav>
		<div class="user-section">
			{#if auth.user}
				<span>Welcome, {auth.user.username}</span>
				<button class="btn-logout" onclick={() => auth.logout()}>Logout</button>
			{/if}
		</div>
	</div>
</header>
