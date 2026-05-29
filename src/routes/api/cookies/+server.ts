import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { query } from '$lib/server/db';

const COOKIES_PATH = path.join(process.cwd(), 'cookies.txt');

/**
 * Validate that the uploaded text is a real Netscape-format cookies.txt, not a
 * shell script / JSON / arbitrary text that merely mentions "youtube.com".
 * Requires the Netscape header AND at least one tab-separated 7-field cookie row.
 */
function isNetscapeCookieFile(text: string): boolean {
	const lines = text.split(/\r?\n/);
	const header = lines.find((l) => l.trim() !== '');
	if (!header || !/^#\s*Netscape HTTP Cookie File/i.test(header.trim())) return false;
	// A valid cookie line: 7 tab-separated fields (domain may be prefixed with #HttpOnly_)
	return lines.some((l) => {
		if (l.trim() === '' || (l.startsWith('#') && !l.startsWith('#HttpOnly_'))) return false;
		return l.split('\t').length === 7;
	});
}

// Only the first user (site owner) can upload cookies
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	const { rows: [owner] } = await query("SELECT MIN(id) as id FROM users WHERE username NOT LIKE 'guest_%'");
	if (!owner?.id || locals.user.id !== Number(owner.id)) {
		return json({ error: 'Only the site owner can upload cookies' }, { status: 403 });
	}

	const formData = await request.formData().catch(() => null);
	if (!formData) return json({ error: 'Invalid form data' }, { status: 400 });

	const file = formData.get('cookies') as File | null;
	if (!file || file.size === 0) return json({ error: 'No file provided' }, { status: 400 });
	if (file.size > 5 * 1024 * 1024) return json({ error: 'File too large (max 5MB)' }, { status: 413 });

	const text = await file.text();
	if (!isNetscapeCookieFile(text)) {
		return json(
			{
				error:
					'Not a valid Netscape cookies.txt file. Export cookies from a logged-in browser in Netscape format (the file should start with "# Netscape HTTP Cookie File").'
			},
			{ status: 400 }
		);
	}

	await writeFile(COOKIES_PATH, text, 'utf8');
	return json({ success: true });
};
