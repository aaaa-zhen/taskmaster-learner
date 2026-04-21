import type { PageServerLoad } from './$types';
import { query } from '$lib/server/db';
import type { VocabEntry } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	const { rows } = await query(
		'SELECT * FROM vocab_notebook WHERE user_id = $1 ORDER BY created_at DESC',
		[locals.user!.id]
	);
	return { entries: rows as VocabEntry[] };
};
