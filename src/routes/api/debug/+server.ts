import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user!.id;
	const { rows: episodes } = await query(
		'SELECT id, title, status, error_message FROM episodes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
		[userId]
	);
	const { rows: rawSettings } = await query(
		'SELECT key, value FROM user_settings WHERE user_id = $1',
		[userId]
	);
	const settings = rawSettings.map((row: any) => ({
		key: row.key,
		value: row.key === 'api_key' ? `${String(row.value).slice(0, 4)}....` : row.value
	}));
	return json({ episodes, settings });
};
