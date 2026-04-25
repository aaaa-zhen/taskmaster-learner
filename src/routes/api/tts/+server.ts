import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSettings } from '$lib/server/claude';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { text } = await request.json();
	if (!text || typeof text !== 'string' || text.length > 300) {
		return json({ error: 'Invalid text' }, { status: 400 });
	}

	const settings = await getSettings(locals.user.id);
	if (!settings.api_key) {
		return json({ error: 'API key not configured' }, { status: 400 });
	}

	const baseUrl = settings.base_url.replace(/\/$/, '');
	const res = await fetch(`${baseUrl}/v1/audio/speech`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${settings.api_key}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'gpt-4o-mini-tts',
			input: text,
			voice: 'coral'
		})
	});

	if (!res.ok) {
		return json({ error: 'TTS failed' }, { status: 502 });
	}

	const audio = await res.arrayBuffer();
	return new Response(audio, {
		headers: {
			'Content-Type': 'audio/mpeg',
			'Cache-Control': 'private, max-age=3600'
		}
	});
};
