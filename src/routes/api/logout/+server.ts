import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('clip_session');
	if (sessionId) {
		await deleteSession(sessionId);
		cookies.delete('clip_session', { path: '/' });
	}
	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
