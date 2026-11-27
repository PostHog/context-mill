import { getContext, setContext } from 'svelte';
import posthog from 'posthog-js';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

export interface User {
	id: string;
	username: string;
	burritoConsiderations: number;
}

const AUTH_KEY = Symbol('auth');

// Class-based auth state using Svelte 5 $state in class fields
export class AuthState {
	user = $state<User | null>(null);

	constructor() {
		// Restore user from localStorage on creation in the browser and re-identify with the stable user ID.
		if (browser) {
			const storedUsername = localStorage.getItem('currentUser')?.trim();
			const storedUserId = localStorage.getItem('currentUserId')?.trim();
			const storedCount = parseInt(localStorage.getItem('burritoConsiderations') || '0', 10);
			if (storedUsername && storedUserId) {
				this.user = {
					id: storedUserId,
					username: storedUsername,
					burritoConsiderations: Number.isNaN(storedCount) ? 0 : storedCount
				};
				if (env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()) {
					posthog.identify(storedUserId, { username: storedUsername });
				}
			}
		}
	}

	login = async (username: string, password: string): Promise<boolean> => {
		const trimmedUsername = username.trim();
		// Reject blank login inputs before calling the API, identify, or capture rather than using a fallback identity.
		if (!trimmedUsername || !password) {
			return false;
		}

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: trimmedUsername, password })
			});

			if (response.ok) {
				const { user: userData } = await response.json();
				if (!userData?.id) {
					return false;
				}
				this.user = userData as User;

				if (browser) {
					localStorage.setItem('currentUser', trimmedUsername);
					localStorage.setItem('currentUserId', userData.id);
					localStorage.setItem('burritoConsiderations', String(userData.burritoConsiderations ?? 0));
					if (env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()) {
						// Identify with the stable user ID and keep username in person properties, never in capture event properties.
						posthog.identify(userData.id, { username: trimmedUsername });
						posthog.capture('user_logged_in', { login_method: 'username' });
					}
				}

				return true;
			}
			return false;
		} catch (error) {
			console.error('Login error:', error);
			return false;
		}
	};

	logout = (): void => {
		// Only capture logout and reset PostHog when transitioning out of an authenticated session.
		if (!this.user) {
			return;
		}
		if (browser) {
			if (env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()) {
				posthog.capture('user_logged_out');
				posthog.reset();
			}
			localStorage.removeItem('currentUser');
			localStorage.removeItem('currentUserId');
			localStorage.removeItem('burritoConsiderations');
		}
		this.user = null;
	};

	incrementBurritoConsiderations = (): void => {
		if (this.user) {
			const nextCount = this.user.burritoConsiderations + 1;
			this.user = {
				...this.user,
				burritoConsiderations: nextCount
			};
			if (browser) {
				localStorage.setItem('burritoConsiderations', String(nextCount));
			}
		}
	};
}

export function setAuthContext(auth: AuthState) {
	setContext(AUTH_KEY, auth);
}

export function getAuthContext(): AuthState {
	return getContext<AuthState>(AUTH_KEY);
}
