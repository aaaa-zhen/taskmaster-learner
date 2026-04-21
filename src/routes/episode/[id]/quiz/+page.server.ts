import type { PageServerLoad } from './$types';
import { query } from '$lib/server/db';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const userId = locals.user!.id;
	const { rows: [episode] } = await query(
		'SELECT * FROM episodes WHERE id = $1 AND user_id = $2',
		[params.id, userId]
	);
	if (!episode) throw error(404, 'Episode not found');

	const { rows: annotations } = await query(
		'SELECT ha.*, s.text as segment_text FROM humor_annotations ha JOIN segments s ON ha.segment_id = s.id WHERE ha.episode_id = $1',
		[params.id]
	);

	const { rows: vocabulary } = await query(
		'SELECT * FROM vocab_notebook WHERE episode_id = $1 AND user_id = $2',
		[params.id, userId]
	);

	return { episode, annotations, vocabulary };
};
