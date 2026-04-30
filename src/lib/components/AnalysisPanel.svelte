<script lang="ts">
	import type {
		SceneBreakdown,
		HumorCategory,
		VocabEntry,
		Segment,
		HumorAnnotation
	} from '$lib/types';
	import HumorBadge from './HumorBadge.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'isomorphic-dompurify';
	import { currentTime } from '$lib/stores/player';
	import { formatTime } from '$lib/utils/time';

	marked.setOptions({ breaks: true, gfm: true });

	let {
		scenes = [],
		segments = [],
		annotations = [],
		vocabulary = [],
		explanation = '',
		loadingExplanation = false,
		focusSegmentId = null,
		activeTab = $bindable('explanation'),
		onsaveWord
	}: {
		scenes?: SceneBreakdown[];
		segments?: Segment[];
		annotations?: HumorAnnotation[];
		vocabulary?: VocabEntry[];
		explanation?: string;
		loadingExplanation?: boolean;
		focusSegmentId?: number | null;
		activeTab?: 'explanation' | 'scenes' | 'vocab';
		onsaveWord?: (vocab: VocabEntry) => void;
	} = $props();

	function findSegmentAtTime(time: number): Segment | null {
		if (segments.length === 0) return null;
		for (let i = 0; i < segments.length; i++) {
			const current = segments[i];
			const next = segments[i + 1];
			if (time >= current.start_time && (!next || time < next.start_time)) {
				return current;
			}
		}
		for (let i = segments.length - 1; i >= 0; i--) {
			if (time >= segments[i].start_time) return segments[i];
		}
		return segments[0] || null;
	}

	function findSceneForSegment(segment: Segment | null): SceneBreakdown | null {
		if (!segment) return null;
		return (
			scenes.find(
				(scene) => segment.index_num >= scene.start_seg && segment.index_num <= scene.end_seg
			) || null
		);
	}

	function includesLoosely(haystack: string, needle: string): boolean {
		return haystack.toLowerCase().includes(needle.toLowerCase().trim());
	}

	const annotationMap = $derived(
		annotations.reduce((map, ann) => {
			const list = map.get(ann.segment_id) || [];
			list.push(ann);
			map.set(ann.segment_id, list);
			return map;
		}, new Map<number, HumorAnnotation[]>())
	);

	const currentSegment = $derived.by(() => findSegmentAtTime($currentTime));
	const focusSegment = $derived.by(
		() => segments.find((segment) => segment.id === focusSegmentId) || currentSegment || null
	);
	const isFollowingClip = $derived(!focusSegmentId || focusSegment?.id === currentSegment?.id);
	const currentScene = $derived.by(() => findSceneForSegment(currentSegment));
	const focusScene = $derived.by(() => findSceneForSegment(focusSegment));
	const focusAnnotations = $derived(
		focusSegment ? annotationMap.get(focusSegment.id) || [] : []
	);
	const sceneWindowText = $derived.by(() => {
		if (!focusScene) return '';
		return segments
			.filter(
				(segment) =>
					segment.index_num >= focusScene.start_seg && segment.index_num <= focusScene.end_seg
			)
			.map((segment) => segment.text)
			.join(' ');
	});

	const relevantVocabulary = $derived.by(() => {
		if (vocabulary.length === 0) return [];

		const lineText = focusSegment?.text || '';
		const sceneText = sceneWindowText;

		const matched = vocabulary.filter(
			(vocab) =>
				includesLoosely(lineText, vocab.word) ||
				includesLoosely(sceneText, vocab.word) ||
				(vocab.example && includesLoosely(lineText, vocab.example))
		);

		return (matched.length > 0 ? matched : vocabulary).slice(0, 6);
	});

	const otherVocabulary = $derived.by(() =>
		vocabulary.filter((vocab) => !relevantVocabulary.some((current) => current.id === vocab.id))
	);

	const renderedExplanation = $derived(
		explanation ? DOMPurify.sanitize(marked(explanation) as string) : ''
	);
</script>

<div class="panel">
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'explanation'}
			onclick={() => (activeTab = 'explanation')}
		>
			Now
		</button>
		<button
			class="tab"
			class:active={activeTab === 'scenes'}
			onclick={() => (activeTab = 'scenes')}
		>
			Clip Guide
		</button>
		<button
			class="tab"
			class:active={activeTab === 'vocab'}
			onclick={() => (activeTab = 'vocab')}
		>
			Words Here
		</button>
	</div>

	<div class="content">
		{#if activeTab === 'explanation'}
			{#if focusSegment}
				<div class="now-card">
					<div class="card-top">
						<p class="eyebrow">{isFollowingClip ? 'Following the clip' : 'Selected line'}</p>
						<span class="time-pill">{formatTime(focusSegment.start_time)}</span>
					</div>
					<p class="current-line">{focusSegment.text}</p>
					{#if focusScene}
						<p class="context-note">
							In this part: <strong>{focusScene.title}</strong>
						</p>
					{/if}
				</div>
			{/if}

			{#if loadingExplanation}
				<div class="loading-container">
					<div class="dots">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</div>
					<p class="loading">Building a simple explanation for this moment...</p>
				</div>
			{:else if explanation}
				<div class="explanation markdown">
					{@html renderedExplanation}
				</div>
			{:else}
				<div class="placeholder">
					<span class="placeholder-icon">?</span>
					<p>The helper will explain the current line here so you do not need to leave the clip.</p>
				</div>
			{/if}

			{#if focusAnnotations.length > 0}
				<div class="section">
					<h4>Why This Line Is Tricky</h4>
					<div class="stack">
						{#each focusAnnotations as ann}
							{@const color = `var(--tag-${ann.category.replace(/_/g, '-')}, var(--accent))`}
							<div class="detail-card" style="border-left-color: {color}">
								<p class="detail-label">{ann.category.replace(/_/g, ' ')}</p>
								<p class="detail-text">{ann.explanation}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if relevantVocabulary.length > 0}
				<div class="section">
					<h4>Words In This Moment</h4>
					<div class="stack">
						{#each relevantVocabulary.slice(0, 3) as vocab}
							<div class="mini-vocab">
								<div class="mini-vocab-head">
									<strong>{vocab.word}</strong>
									<button class="save-btn" onclick={() => onsaveWord?.(vocab)} title="Save to notebook">
										+
									</button>
								</div>
								<p>{vocab.definition}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

		{:else if activeTab === 'scenes'}
			{#if currentScene}
				<div class="now-card">
					<p class="eyebrow">Current moment</p>
					<h3>{currentScene.title}</h3>
					<p class="scene-text">{currentScene.explanation}</p>
					<div class="scene-badges">
						{#each currentScene.humor_types as type}
							<HumorBadge category={type as HumorCategory} />
						{/each}
					</div>
				</div>
			{/if}

			{#if scenes.length === 0}
				<p class="placeholder-text">A clip guide will appear after analysis.</p>
			{/if}

			{#each scenes as scene, i}
				<div class="scene-card" class:active-scene={currentScene?.id === scene.id}>
					<div class="scene-header">
						<span class="scene-num">{i + 1}</span>
						<h3>{scene.title}</h3>
					</div>
					<p class="scene-text">{scene.explanation}</p>
					<div class="scene-badges">
						{#each scene.humor_types as type}
							<HumorBadge category={type as HumorCategory} />
						{/each}
					</div>
				</div>
			{/each}

		{:else if activeTab === 'vocab'}
			{#if vocabulary.length === 0}
				<p class="placeholder-text">Clip-specific words, references, and jokes will appear after analysis.</p>
			{:else}
				<p class="panel-intro">
					These are the words and references this clip uses in its own way, so you do not need to leave the video to look them up.
				</p>
			{/if}

			{#if relevantVocabulary.length > 0}
				<div class="section">
					<h4>Most Relevant Right Now</h4>
					<div class="stack">
						{#each relevantVocabulary as vocab}
							<div class="vocab-card">
								<div class="vocab-header">
									<strong class="vocab-word">{vocab.word}</strong>
									<button class="save-btn" onclick={() => onsaveWord?.(vocab)} title="Save to notebook">
										+
									</button>
								</div>
								<p class="vocab-def">{vocab.definition}</p>
								{#if vocab.example}
									<p class="vocab-example">"{vocab.example}"</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if otherVocabulary.length > 0}
				<div class="section">
					<h4>More From This Clip</h4>
					<div class="stack">
						{#each otherVocabulary.slice(0, 6) as vocab}
							<div class="vocab-card compact">
								<div class="vocab-header">
									<strong class="vocab-word">{vocab.word}</strong>
									<button class="save-btn" onclick={() => onsaveWord?.(vocab)} title="Save to notebook">
										+
									</button>
								</div>
								<p class="vocab-def">{vocab.definition}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-card);
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid var(--border);
	}

	.tab {
		flex: 1;
		padding: 14px;
		background: none;
		border: none;
		color: var(--text-muted);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		border-bottom: 2px solid transparent;
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.content {
		flex: 1;
		overflow-y: auto;
		padding: 18px;
	}

	.now-card,
	.scene-card,
	.detail-card,
	.mini-vocab,
	.vocab-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.now-card {
		padding: 16px;
		margin-bottom: 18px;
	}

	.card-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}

	.eyebrow {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.1px;
		text-transform: uppercase;
		color: var(--accent);
	}

	.time-pill {
		border-radius: 999px;
		background: var(--bg-dark);
		padding: 5px 8px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.current-line {
		margin: 0;
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 700;
		line-height: 1.35;
	}

	.context-note {
		margin: 10px 0 0;
		color: var(--text-muted);
		font-size: 13px;
		line-height: 1.55;
	}

	.placeholder {
		text-align: center;
		padding: 28px 20px;
	}

	.placeholder-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--bg-dark);
		border: 2px solid var(--border);
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 700;
		color: var(--text-muted);
		margin-bottom: 16px;
	}

	.placeholder p,
	.placeholder-text,
	.panel-intro {
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1.65;
	}

	.panel-intro {
		margin: 0 0 16px;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 34px 20px;
		gap: 14px;
	}

	.dots {
		display: flex;
		gap: 6px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		animation: bounce 1.2s ease-in-out infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.15s;
	}

	.dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes bounce {
		0%, 80%, 100% {
			transform: scale(0.6);
			opacity: 0.4;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.loading {
		margin: 0;
		color: var(--text-muted);
		font-family: var(--font-ui);
		font-size: 13px;
	}

	.explanation {
		line-height: 1.7;
		font-size: 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 16px;
	}

	.explanation :global(h1),
	.explanation :global(h2),
	.explanation :global(h3) {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 700;
		margin: 14px 0 8px;
	}

	.explanation :global(p) {
		margin: 6px 0;
	}

	.explanation :global(ul),
	.explanation :global(ol) {
		padding-left: 18px;
		margin: 6px 0;
	}

	.explanation :global(li) {
		margin-bottom: 4px;
	}

	.section {
		margin-top: 18px;
	}

	.section h4 {
		margin: 0 0 10px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.1px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.detail-card {
		padding: 12px 14px;
		border-left: 4px solid var(--accent);
	}

	.detail-label {
		margin: 0 0 6px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.detail-text {
		margin: 0;
		line-height: 1.6;
	}

	.mini-vocab,
	.vocab-card {
		padding: 14px;
	}

	.mini-vocab-head,
	.vocab-header {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.mini-vocab-head strong,
	.vocab-word {
		font-family: var(--font-display);
		font-size: 18px;
	}

	.mini-vocab p,
	.vocab-def {
		margin: 8px 0 0;
		line-height: 1.6;
	}

	.vocab-example {
		margin: 6px 0 0;
		color: var(--text-muted);
		font-style: italic;
		line-height: 1.5;
	}

	.save-btn {
		margin-left: auto;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--accent);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.save-btn:hover {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.scene-card {
		padding: 16px;
		margin-bottom: 12px;
	}

	.scene-card.active-scene {
		border-color: var(--accent);
		box-shadow: 0 8px 24px rgba(32, 184, 205, 0.08);
	}

	.scene-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.scene-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--accent);
		color: white;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		flex-shrink: 0;
	}

	.scene-card h3,
	.now-card h3 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
	}

	.scene-text {
		margin: 0;
		line-height: 1.65;
		color: var(--text);
	}

	.scene-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	.vocab-card.compact .vocab-word {
		font-size: 16px;
	}

	@media (max-width: 768px) {
		.content {
			padding: 14px;
		}

		.tab {
			padding: 12px 8px;
			font-size: 12px;
			min-height: 44px;
		}

		.current-line {
			font-size: 18px;
		}

		.scene-card,
		.now-card,
		.detail-card,
		.mini-vocab,
		.vocab-card,
		.explanation {
			padding: 12px;
		}

		.save-btn {
			width: 32px;
			height: 32px;
			font-size: 18px;
		}
	}
</style>
