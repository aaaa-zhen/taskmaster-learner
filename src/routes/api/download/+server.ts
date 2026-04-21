import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const { episodeId } = await request.json();

	if (!episodeId) {
		return json({ error: 'episodeId is required' }, { status: 400 });
	}

	const { rows: [episode] } = await query(
		'SELECT * FROM episodes WHERE id = $1 AND user_id = $2', [episodeId, userId]
	);

	if (!episode) {
		return json({ error: 'Episode not found' }, { status: 404 });
	}

	// Already downloaded
	if (episode.video_path && fs.existsSync(episode.video_path)) {
		return json({ status: 'ready', path: `/media/${episodeId}/video.mp4` });
	}

	// Check if yt-dlp is available
	try {
		await execAsync('yt-dlp --version');
	} catch {
		return json({ error: 'yt-dlp is not installed on this server' }, { status: 501 });
	}

	const mediaDir = path.join(process.cwd(), 'media', episodeId);
	if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

	const outputPath = path.join(mediaDir, 'video.mp4');

	execAsync(
		`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" ` +
		`--merge-output-format mp4 -o "${outputPath}" "${episode.url}"`
	).then(async () => {
		await query('UPDATE episodes SET video_path = $1 WHERE id = $2 AND user_id = $3',
			[outputPath, episodeId, userId]);
	}).catch(err => {
		console.error(`Video download failed for ${episodeId}:`, err.message);
	});

	return json({ status: 'downloading' });
};
