import { getContext, setContext } from 'svelte';
import posthog from 'posthog-js';
import { browser } from '$app/environment';

export interface User {
	username: string;
	burritoConsiderations: number;
}

const AUTH_KEY = Symbol('auth');

// Class-based auth state using Svelte 5 $state in class fields
// This is the recommended pattern for encapsulating reactive state + behavior
export class AuthState {
	user = $state<User | null>(null);

	constructor() {
		// Restore user from localStorage on creation (browser only)
		if (browser) {
			const storedUsername = localStorage.getItem('currentUser');
			if (storedUsername) {
				this.user = { username: storedUsername, burritoConsiderations: 0 };
			}
		}
	}

	login = async (username: string, password: string): Promise<boolean> => {
		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			if (response.ok) {
				const { user: userData } = await response.json();
				this.user = userData as User;

				if (browser) {
					localStorage.setItem('currentUser', username);
					posthog.identify(username, { username });
					posthog.capture('user_logged_in', { username });
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
		if (browser) {
			posthog.capture('user_logged_out');
			posthog.reset();
			localStorage.removeItem('currentUser');
		}
		this.user = null;
	};

	incrementBurritoConsiderations = (): void => {
		if (this.user) {
			this.user = {
				...this.user,
				burritoConsiderations: this.user.burritoConsiderations + 1
			};
		}
	};
}

export function setAuthContext(auth: AuthState) {
	setContext(AUTH_KEY, auth);
}

export function getAuthContext(): AuthState {
	return getContext<AuthState>(AUTH_KEY);
}
