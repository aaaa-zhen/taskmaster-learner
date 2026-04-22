/**
 * Runs once when the server boots (imported from hooks.server.ts).
 *
 * Two jobs:
 *
 * 1. Orphan cleanup — the job tracker in jobs.ts is in-memory only, so a
 *    PM2 restart or crash leaves episodes stuck in transient states
 *    (`fetching_audio` / `transcribing` / `analyzing`) with no worker
 *    advancing them. Mark those as `error` so the user can hit "Try again".
 *
 * 2. Environment sanity check — log warnings (not errors) if the binaries
 *    this server depends on are missing. Makes deploy-time diagnosis
 *    dramatically easier: check `pm2 logs` and you see "yt-dlp: missing"
 *    instead of "video went to error state for mysterious reason".
 */

import { spawn } from 'node:child_process';
import { query } from './db';
import { env } from '$env/dynamic/private';

const TRANSIENT_STATUSES = [
	'pending',
	'downloading', // legacy name
	'fetching_audio',
	'transcribing',
	'analyzing'
];

async function cleanupOrphanEpisodes(): Promise<void> {
	try {
		const { rows } = await query(
			`SELECT id FROM episodes WHERE status IN (${TRANSIENT_STATUSES.map((_, i) => '$' + (i + 1)).join(',')})`,
			TRANSIENT_STATUSES
		);
		if (rows.length === 0) return;
		await query(
			`UPDATE episodes
			 SET status = 'error',
			     error_message = 'Server restarted while processing — click Try again to retry.'
			 WHERE status IN (${TRANSIENT_STATUSES.map((_, i) => '$' + (i + 1)).join(',')})`,
			TRANSIENT_STATUSES
		);
		console.log(
			`[startup] Marked ${rows.length} orphan episode(s) as error after restart.`
		);
	} catch (err) {
		console.error('[startup] Orphan cleanup failed:', err);
	}
}

function binaryExists(cmd: string, args: string[] = ['--version']): Promise<boolean> {
	return new Promise((resolve) => {
		const p = spawn(cmd, args);
		p.on('error', () => resolve(false));
		p.on('close', (code) => resolve(code === 0));
		// Safety timeout in case a binary hangs.
		setTimeout(() => {
			try {
				p.kill();
			} catch {}
			resolve(false);
		}, 4000);
	});
}

async function checkEnvironment(): Promise<void> {
	const checks: Array<[string, Promise<boolean>]> = [
		['yt-dlp', binaryExists('yt-dlp')],
		['ffmpeg', binaryExists('ffmpeg', ['-version'])],
		['ffprobe', binaryExists('ffprobe', ['-version'])]
	];
	const results = await Promise.all(checks.map(async ([name, p]) => [name, await p] as const));
	const missing = results.filter(([, ok]) => !ok).map(([name]) => name);
	if (missing.length) {
		console.warn(
			`[startup] ⚠ Missing binaries on PATH: ${missing.join(', ')}. ` +
				`Episode processing will fail until these are installed.`
		);
	}

	// Whisper + LLM: per-user API keys from Settings. Server env vars are optional fallbacks.
	if (env.WHISPER_API_KEY) {
		console.log(
			`[startup] Whisper fallback: ${env.WHISPER_BASE_URL || 'https://api.openai.com/v1'} (${env.WHISPER_MODEL || 'whisper-large-v3-turbo'})`
		);
	} else {
		console.log('[startup] Whisper: no server-side key — will use per-user API key from Settings');
	}

	if (!env.ANTHROPIC_API_KEY) {
		console.log('[startup] LLM: no server-side key — will use per-user API key from Settings');
	}
}

let started = false;

/**
 * Idempotent startup. Safe to call from multiple places — only runs once per
 * process lifetime.
 */
async function cleanupExpiredSessions(): Promise<void> {
	try {
		await query("DELETE FROM sessions WHERE expires_at <= datetime('now')");
	} catch (err) {
		console.error('[startup] Session cleanup failed:', err);
	}
}

export async function runStartupTasks(): Promise<void> {
	if (started) return;
	started = true;
	await cleanupOrphanEpisodes();
	await cleanupExpiredSessions();
	await checkEnvironment();
}
