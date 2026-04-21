import { parseSrtTime } from '$lib/utils/time';

export interface ParsedSegment {
	index: number;
	startTime: number;
	endTime: number;
	text: string;
}

export function parseSrt(content: string): ParsedSegment[] {
	const blocks = content.trim().split(/\n\s*\n/);
	const raw: ParsedSegment[] = [];

	for (const block of blocks) {
		const lines = block.trim().split('\n');
		if (lines.length < 3) continue;

		const timeLine = lines[1];
		const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
		if (!timeMatch) continue;

		const startTime = parseSrtTime(timeMatch[1]);
		const endTime = parseSrtTime(timeMatch[2]);
		let text = lines.slice(2).join(' ');

		// Clean up auto-caption artifacts
		text = text.replace(/<[^>]+>/g, ''); // remove HTML tags
		text = text.replace(/\[.*?\]/g, ''); // remove [Music] etc
		text = text.replace(/^>>\s*/g, ''); // remove leading >>
		text = text.replace(/\s*>>\s*/g, ' — '); // replace >> with dash for speaker changes
		text = text.replace(/\s+/g, ' ').trim();

		if (!text) continue;

		raw.push({ index: raw.length, startTime, endTime, text });
	}

	// Merge short segments into ~5-10 second chunks
	return mergeSegments(raw);
}

function mergeSegments(segments: ParsedSegment[]): ParsedSegment[] {
	if (segments.length === 0) return [];

	const merged: ParsedSegment[] = [];
	let current = { ...segments[0] };

	for (let i = 1; i < segments.length; i++) {
		const seg = segments[i];
		const duration = seg.endTime - current.startTime;
		const gap = seg.startTime - current.endTime;

		// Merge if: total duration under 8 seconds AND gap is small
		if (duration < 8 && gap < 1.5) {
			current.endTime = seg.endTime;
			current.text += ' ' + seg.text;
		} else {
			current.index = merged.length;
			merged.push(current);
			current = { ...seg };
		}
	}

	current.index = merged.length;
	merged.push(current);

	// Deduplicate repeated text (common in auto-captions)
	return merged.map(seg => ({
		...seg,
		text: deduplicateText(seg.text)
	}));
}

function deduplicateText(text: string): string {
	const words = text.split(' ');
	const result: string[] = [];
	let i = 0;

	while (i < words.length) {
		// Check for repeated phrases (2-5 words)
		let found = false;
		for (let len = 2; len <= 5 && i + len * 2 <= words.length; len++) {
			const phrase = words.slice(i, i + len).join(' ');
			const next = words.slice(i + len, i + len * 2).join(' ');
			if (phrase.toLowerCase() === next.toLowerCase()) {
				result.push(...words.slice(i, i + len));
				i += len * 2;
				found = true;
				break;
			}
		}
		if (!found) {
			result.push(words[i]);
			i++;
		}
	}

	return result.join(' ');
}
