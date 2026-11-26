import { getContext, setContext } from 'svelte';
import posthog from 'posthog-js';
import { browser } from '$app/environment';

export interface User {
	id: string;
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
			const storedUserId = localStorage.getItem('currentUserId');
			if (storedUsername && storedUserId) {
				this.user = { id: storedUserId, username: storedUsername, burritoConsiderations: 0 };
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
					localStorage.setItem('currentUserId', userData.id);
					posthog.identify(userData.id, { username });
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
			localStorage.removeItem('currentUserId');
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
