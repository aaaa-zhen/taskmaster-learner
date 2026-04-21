import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { explainSegment, lookupWord } from '$lib/server/claude';

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const body = await request.json();

	if (body.word) {
		try {
			const definition = await lookupWord(body.word, userId, body.context);
			return json({ definition });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			return json({ error: message }, { status: 500 });
		}
	}

	const { segmentId } = body;
	if (!segmentId) {
		return json({ error: 'segmentId or word is required' }, { status: 400 });
	}

	// Verify segment belongs to this user via episode ownership
	const { rows: [segment] } = await query(
		`SELECT s.* FROM segments s
		 JOIN episodes e ON e.id = s.episode_id
		 WHERE s.id = $1 AND e.user_id = $2`,
		[segmentId, userId]
	);
	if (!segment) {
		return json({ error: 'Segment not found' }, { status: 404 });
	}

	const { rows: context } = await query(
		'SELECT text FROM segments WHERE episode_id = $1 AND index_num BETWEEN $2 AND $3 ORDER BY index_num',
		[segment.episode_id, segment.index_num - 5, segment.index_num + 5]
	);

	try {
		const explanation = await explainSegment(
			segment.text,
			context.map((c: any) => c.text),
			userId
		);
		return json({ explanation });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return json({ error: message }, { status: 500 });
	}
};
