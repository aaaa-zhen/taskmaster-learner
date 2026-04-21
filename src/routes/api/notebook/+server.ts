import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	const { rows } = await query(
		'SELECT * FROM vocab_notebook WHERE user_id = $1 ORDER BY created_at DESC',
		[locals.user!.id]
	);
	return json(rows);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { word, definition, example, episode_id, category } = await request.json();

	if (!word) {
		return json({ error: 'word is required' }, { status: 400 });
	}

	const { rows: [row] } = await query(
		'INSERT INTO vocab_notebook (word, definition, example, episode_id, category, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
		[word, definition, example, episode_id || null, category || 'general', locals.user!.id]
	);

	return json({ id: row.id });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { id } = await request.json();

	if (!id) {
		return json({ error: 'id is required' }, { status: 400 });
	}

	await query('DELETE FROM vocab_notebook WHERE id = $1 AND user_id = $2', [id, locals.user!.id]);
	return json({ success: true });
};
