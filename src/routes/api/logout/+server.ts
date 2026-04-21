import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('clip_session');
	if (sessionId) {
		await deleteSession(sessionId);
		cookies.delete('clip_session', { path: '/' });
	}
	throw redirect(302, '/login');
};
