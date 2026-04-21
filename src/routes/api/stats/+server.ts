import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';

export const GET: RequestHandler = async ({ locals }) => {
	const userId = locals.user!.id;

	const { rows: [clips] } = await query(
		"SELECT count(*) as count FROM episodes WHERE status = $1 AND user_id = $2", ['ready', userId]
	);
	const { rows: [words] } = await query(
		'SELECT count(*) as count FROM vocab_notebook WHERE user_id = $1', [userId]
	);
	const { rows: [annotations] } = await query(
		'SELECT count(*) as count FROM humor_annotations ha JOIN episodes e ON e.id = ha.episode_id WHERE e.user_id = $1',
		[userId]
	);

	return json({
		clipsStudied: Number(clips.count),
		wordsSaved: Number(words.count),
		jokesExplained: Number(annotations.count)
	});
};
