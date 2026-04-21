import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { hashPassword, verifyPassword, createSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const { action, username, password } = body;

	if (!username?.trim() || !password) {
		return json({ error: 'Username and password are required.' }, { status: 400 });
	}

	if (action === 'signup') {
		if (username.trim().length < 3) {
			return json({ error: 'Username must be at least 3 characters.' }, { status: 400 });
		}
		if (password.length < 8) {
			return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
		}

		const { rows: existing } = await query('SELECT id FROM users WHERE username = $1', [username.trim()]);
		if (existing.length > 0) {
			return json({ error: 'Username already taken.' }, { status: 400 });
		}

		const hashed = await hashPassword(password);
		const { rows: [newUser] } = await query(
			'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
			[username.trim(), hashed]
		);

		const sessionId = await createSession(newUser.id as number);
		cookies.set('clip_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30,
			secure: false
		});
		return json({ ok: true });
	}

	if (action === 'login') {
		const { rows } = await query('SELECT id, password FROM users WHERE username = $1', [username.trim()]);
		const user = rows[0];
		const valid = user && await verifyPassword(password, user.password as string);

		if (!valid) {
			return json({ error: 'Invalid username or password.' }, { status: 400 });
		}

		const sessionId = await createSession(user.id as number);
		cookies.set('clip_session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30,
			secure: false
		});
		return json({ ok: true });
	}

	return json({ error: 'Invalid action.' }, { status: 400 });
};
