import type { PageServerLoad } from './$types';
import { query } from '$lib/server/db';
import { error, redirect } from '@sveltejs/kit';
import type { Episode, Segment, HumorAnnotation, SceneBreakdown, VocabEntry } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(302, '/');
	const userId = locals.user.id;

	const { rows: [episode] } = await query(
		'SELECT * FROM episodes WHERE id = $1 AND user_id = $2',
		[params.id, userId]
	);
	if (!episode) throw error(404, 'Episode not found');

	const { rows: segments } = await query(
		'SELECT * FROM segments WHERE episode_id = $1 ORDER BY index_num', [params.id]
	);

	const { rows: annotations } = await query(
		'SELECT * FROM humor_annotations WHERE episode_id = $1', [params.id]
	);

	const { rows: scenes } = await query(
		'SELECT * FROM scene_breakdowns WHERE episode_id = $1 ORDER BY start_seg', [params.id]
	);

	const parsedScenes = scenes.map((s: any) => {
		let humor_types: string[] = [];
		try {
			humor_types = typeof s.humor_types === 'string' ? JSON.parse(s.humor_types) : (s.humor_types ?? []);
		} catch {
			humor_types = [];
		}
		return { ...s, humor_types };
	});

	const { rows: vocabulary } = await query(
		'SELECT * FROM vocab_notebook WHERE episode_id = $1 AND user_id = $2 ORDER BY created_at',
		[params.id, userId]
	);

	const { rows: notebookEntries } = await query(
		'SELECT * FROM vocab_notebook WHERE episode_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 100',
		[params.id, userId]
	);

	const { rows: [countRow] } = await query(
		'SELECT COUNT(*) as n FROM vocab_notebook WHERE user_id = $1',
		[userId]
	);

	await query("UPDATE episodes SET studied_at = datetime('now') WHERE id = $1 AND user_id = $2", [params.id, userId]);

	return {
		episode: episode as Episode,
		segments: segments as Segment[],
		annotations: annotations as HumorAnnotation[],
		scenes: parsedScenes as SceneBreakdown[],
		vocabulary: vocabulary as VocabEntry[],
		notebookEntries: notebookEntries as VocabEntry[],
		wordsSaved: Number(countRow.n)
	};
};
