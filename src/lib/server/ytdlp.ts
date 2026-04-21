export function extractVideoId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
		/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
		/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
		/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
	];
	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match) return match[1];
	}
	return null;
}

export async function getVideoInfo(url: string): Promise<{ title: string; duration: number; thumbnail: string }> {
	const videoId = extractVideoId(url);
	if (!videoId) throw new Error('Invalid YouTube URL');

	// Use YouTube oEmbed API (no API key needed)
	const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
	const res = await fetch(oembedUrl);
	if (!res.ok) throw new Error('Failed to fetch video info');
	const data = await res.json();

	return {
		title: data.title || 'Unknown',
		duration: 0,
		thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
	};
}

export async function downloadSubtitlesOnly(videoId: string, _url: string): Promise<{ subsText: string }> {
	// Fetch YouTube page with consent cookie to get captions
	const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			'Accept-Language': 'en-US,en;q=0.9',
			'Cookie': 'CONSENT=YES+cb'
		}
	});

	if (!pageRes.ok) throw new Error('Failed to fetch YouTube page');
	const html = await pageRes.text();

	if (!html.includes('"captions"') || !html.includes('playerCaptionsTracklistRenderer')) {
		throw new Error('No captions available for this video. Try a video with subtitles/auto-captions enabled.');
	}

	const startIdx = html.indexOf('"captions":') + '"captions":'.length;
	let depth = 0;
	let endIdx = startIdx;
	for (let i = startIdx; i < html.length; i++) {
		if (html[i] === '{') depth++;
		if (html[i] === '}') depth--;
		if (depth === 0) { endIdx = i + 1; break; }
	}

	let captionsData: any;
	try {
		captionsData = JSON.parse(html.slice(startIdx, endIdx));
	} catch {
		throw new Error('Failed to parse captions data from YouTube page');
	}

	const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
	if (!tracks || tracks.length === 0) {
		throw new Error('No caption tracks found');
	}

	// Prefer English manual captions, then auto-generated English, then first available
	const enTrack = tracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr') ||
		tracks.find((t: any) => t.languageCode === 'en') ||
		tracks[0];

	if (!enTrack?.baseUrl) {
		throw new Error('No usable caption track found');
	}

	const captionRes = await fetch(enTrack.baseUrl + '&fmt=srv3');
	if (!captionRes.ok) throw new Error('Failed to fetch captions');
	const xml = await captionRes.text();

	const srtText = xmlToSrt(xml);
	if (!srtText.trim()) {
		throw new Error('Captions were empty after parsing');
	}

	return { subsText: srtText };
}

function xmlToSrt(xml: string): string {
	const segments: string[] = [];
	const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
	let match;
	let index = 1;

	while ((match = regex.exec(xml)) !== null) {
		const start = parseFloat(match[1]);
		const dur = parseFloat(match[2]);
		const end = start + dur;
		let text = match[3]
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/<[^>]+>/g, '')
			.trim();

		if (!text) continue;

		segments.push(
			`${index}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}\n`
		);
		index++;
	}

	return segments.join('\n');
}

function formatSrtTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	const ms = Math.round((seconds % 1) * 1000);
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
