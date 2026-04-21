const RESUME_PREFIX = 'tm-pos-';

function getResumeKey(id: string) {
	return `${RESUME_PREFIX}${id}`;
}

export function loadResumePosition(id: string): number | null {
	if (typeof localStorage === 'undefined' || !id) return null;
	const raw = localStorage.getItem(getResumeKey(id));
	if (!raw) return null;
	const value = Number.parseInt(raw, 10);
	return Number.isFinite(value) ? value : null;
}

export function saveResumePosition(id: string, seconds: number) {
	if (typeof localStorage === 'undefined' || !id || seconds < 1) return;
	localStorage.setItem(getResumeKey(id), String(Math.floor(seconds)));
}

export function clearResumePosition(id: string) {
	if (typeof localStorage === 'undefined' || !id) return;
	localStorage.removeItem(getResumeKey(id));
}
