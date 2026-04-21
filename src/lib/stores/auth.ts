import { writable } from 'svelte/store';

// When true, the auth modal is shown
export const authModalOpen = writable(false);

// Call this from any component that hits a 401
export function requireAuth() {
	authModalOpen.set(true);
}
