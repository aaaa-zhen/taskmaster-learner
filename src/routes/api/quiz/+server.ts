import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { generateQuiz } from '$lib/server/claude';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const { episodeId } = await request.json();
	if (!episodeId) return json({ error: 'Missing episodeId' }, { status: 400 });

	// Verify episode ownership
	const { rows: [episode] } = await query(
		'SELECT id FROM episodes WHERE id = $1 AND user_id = $2', [episodeId, userId]
	);
	if (!episode) return json({ error: 'Episode not found' }, { status: 404 });

	const { rows: segments } = await query(
		'SELECT text FROM segments WHERE episode_id = $1 ORDER BY start_time', [episodeId]
	);
	const { rows: vocabulary } = await query(
		'SELECT word, definition, example FROM vocab_notebook WHERE episode_id = $1 AND user_id = $2 LIMIT 10',
		[episodeId, userId]
	);

	if (segments.length === 0) return json({ questions: [] });

	try {
		const questions = await generateQuiz(segments, vocabulary, userId);
		return json({ questions });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
