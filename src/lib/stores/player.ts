import { writable } from 'svelte/store';

export const currentTime = writable(0);
export const isPlaying = writable(false);
export const duration = writable(0);

// Controls subtitle visibility from outside (e.g. word popup pausing video)
export const subtitleVisible = writable(false);
