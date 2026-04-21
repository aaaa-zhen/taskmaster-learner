<script lang="ts">
	import type { HumorAnnotation, HumorCategory } from '$lib/types';
	import { categoryColors, categoryLabels } from '$lib/utils/colors';
	import { formatTime } from '$lib/utils/time';

	let {
		text,
		startTime,
		active = false,
		annotations = [],
		segmentId,
		onseek,
		onexplain
	}: {
		text: string;
		startTime: number;
		active?: boolean;
		annotations?: HumorAnnotation[];
		segmentId: number;
		onseek?: (time: number) => void;
		onexplain?: (id: number) => void;
	} = $props();

	function handleClick() {
		onseek?.(startTime);
	}

	function handleExplain(e: Event) {
		e.stopPropagation();
		onexplain?.(segmentId);
	}

	function findExcerptInText(text: string, excerpt: string): { start: number; end: number } | null {
		// Try exact match first
		const exact = text.toLowerCase().indexOf(excerpt.toLowerCase());
		if (exact !== -1) return { start: exact, end: exact + excerpt.length };

		// Try stripping punctuation from excerpt edges and searching
		const trimmed = excerpt.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
		if (trimmed.length >= 2) {
			const idx = text.toLowerCase().indexOf(trimmed.toLowerCase());
			if (idx !== -1) return { start: idx, end: idx + trimmed.length };
		}

		// Try matching the first significant word sequence (first 3+ words)
		const words = excerpt.trim().split(/\s+/).filter(w => w.length > 2);
		if (words.length >= 2) {
			const partial = words.slice(0, Math.min(3, words.length)).join(' ');
			const idx = text.toLowerCase().indexOf(partial.toLowerCase());
			if (idx !== -1) return { start: idx, end: Math.min(text.length, idx + excerpt.length) };
		}

		return null;
	}

	function buildHighlightedText(text: string, annotations: HumorAnnotation[]): string {
		if (annotations.length === 0) return escapeHtml(text);

		const highlights: { start: number; end: number; color: string; explanation: string; category: string; categoryLabel: string }[] = [];

		for (const ann of annotations) {
			const found = findExcerptInText(text, ann.excerpt);
			if (found) {
				const color = categoryColors[ann.category as HumorCategory] || '#888';
				const label = categoryLabels[ann.category as HumorCategory] || ann.category;
				highlights.push({ start: found.start, end: found.end, color, explanation: ann.explanation, category: ann.category, categoryLabel: label });
			}
		}

		highlights.sort((a, b) => a.start - b.start);

		let result = '';
		let pos = 0;

		for (const h of highlights) {
			if (h.start < pos) continue;
			result += escapeHtml(text.slice(pos, h.start));
			result += `<mark style="background:${h.color}35;color:${h.color};border-bottom:2.5px solid ${h.color};padding:2px 4px;border-radius:3px;font-weight:600" title="${escapeHtml(h.categoryLabel)}: ${escapeHtml(h.explanation)}" data-category="${escapeHtml(h.category)}">${escapeHtml(text.slice(h.start, h.end))}</mark>`;
			pos = h.end;
		}

		result += escapeHtml(text.slice(pos));
		return result;
	}

	function escapeHtml(s: string): string {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	const highlightedHtml = $derived(buildHighlightedText(text, annotations));
</script>

<div
	class="line"
	class:active
	onclick={handleClick}
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
	role="button"
	tabindex="0"
>
	<span class="timestamp">{formatTime(startTime)}</span>
	<div class="content">
		<p class="text">{@html highlightedHtml}</p>
		{#if annotations.length > 0}
			<div class="annotations">
				{#each annotations as ann}
					{@const color = categoryColors[ann.category as HumorCategory] || '#888'}
					{@const label = categoryLabels[ann.category as HumorCategory] || ann.category}
					<div class="annotation-card" style="border-left-color: {color}">
						<span class="ann-category" style="color: {color}">{label}</span>
						<span class="ann-explanation">{ann.explanation}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<button class="explain-btn" onclick={handleExplain} title="Why is this funny?">
		?
	</button>
</div>

<style>
	.line {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 20px 18px;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		border-left: 2px solid transparent;
		border-bottom: 1px solid var(--border-light);
	}

	.line:hover {
		background: rgba(128,128,128,0.06);
	}

	.line.active {
		background: color-mix(in srgb, var(--accent) 8%, var(--bg-card));
		border-left-color: var(--accent);
	}

	.timestamp {
		color: var(--text-light);
		font-family: var(--font-ui);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		min-width: 44px;
		padding-top: 5px;
	}

	.content {
		flex: 1;
		min-width: 0;
	}

	.text {
		margin: 0;
		line-height: 1.8;
		font-size: 18px;
		font-family: var(--font-body);
	}

	.annotations {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 10px;
	}

	.annotation-card {
		background: var(--bg-card);
		border-left: 3px solid;
		border-radius: 0 4px 4px 0;
		padding: 8px 12px;
		font-size: 14px;
		line-height: 1.6;
	}

	.ann-category {
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-right: 8px;
	}

	.ann-explanation {
		color: var(--text-muted);
		font-family: var(--font-body);
	}

	.explain-btn {
		background: var(--bg-dark);
		color: var(--text-light);
		border: 1px solid var(--border);
		border-radius: 50%;
		width: 28px;
		height: 28px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
		flex-shrink: 0;
	}

	.explain-btn:hover {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	@media (max-width: 768px) {
		.line {
			padding: 14px 12px;
			gap: 10px;
		}

		.text {
			font-size: 16px;
		}

		.annotation-card {
			padding: 6px 10px;
		}

		.explain-btn {
			width: 32px;
			height: 32px;
			font-size: 15px;
		}
	}
</style>
