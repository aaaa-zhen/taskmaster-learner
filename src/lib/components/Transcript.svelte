<script lang="ts">
	import type { Segment, HumorAnnotation } from '$lib/types';
	import { currentTime } from '$lib/stores/player';
	import TranscriptLine from './TranscriptLine.svelte';
	import { tick } from 'svelte';

	let {
		segments = [],
		annotations = [],
		onseek,
		onexplain
	}: {
		segments?: Segment[];
		annotations?: HumorAnnotation[];
		onseek?: (time: number) => void;
		onexplain?: (id: number) => void;
	} = $props();

	let container: HTMLDivElement | undefined = $state();
	let activeIndex = $state(-1);
	let followPlayback = $state(true);
	let internalScroll = false;
	let scrollResetTimer: ReturnType<typeof setTimeout> | null = null;

	const annotationMap = $derived(
		annotations.reduce((map, ann) => {
			const list = map.get(ann.segment_id) || [];
			list.push(ann);
			map.set(ann.segment_id, list);
			return map;
		}, new Map<number, HumorAnnotation[]>())
	);

	$effect(() => {
		const time = $currentTime;
		const idx = segments.findIndex((s, i) => {
			const next = segments[i + 1];
			return time >= s.start_time && (!next || time < next.start_time);
		});
		if (idx !== activeIndex && idx >= 0) {
			activeIndex = idx;
			if (followPlayback) {
				scrollToActive();
			}
		}
	});

	function handleScroll() {
		if (internalScroll) return;
		followPlayback = false;
	}

	function handleSeek(time: number) {
		followPlayback = true;
		onseek?.(time);
	}

	function resumeFollowing() {
		followPlayback = true;
		scrollToActive();
	}

	async function scrollToActive() {
		await tick();
		if (!container) return;
		const el = container.querySelector('.line.active') as HTMLElement | null;
		if (!el) return;
		internalScroll = true;
		if (scrollResetTimer) clearTimeout(scrollResetTimer);
		el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		scrollResetTimer = setTimeout(() => {
			internalScroll = false;
		}, 400);
	}
</script>

<div class="transcript-wrap">
	<div class="transcript" bind:this={container} onscroll={handleScroll}>
		{#each segments as segment, i}
			<TranscriptLine
				text={segment.text}
				startTime={segment.start_time}
				active={i === activeIndex}
				annotations={annotationMap.get(segment.id) || []}
				segmentId={segment.id}
				onseek={handleSeek}
				onexplain={onexplain}
			/>
		{/each}
	</div>

	{#if !followPlayback}
		<button type="button" class="follow-btn" onclick={resumeFollowing}>
			Follow Live
		</button>
	{/if}
</div>

<style>
	.transcript-wrap {
		position: relative;
		height: 100%;
	}

	.transcript {
		overflow-y: auto;
		height: 100%;
	}

	.follow-btn {
		position: absolute;
		right: 12px;
		bottom: 12px;
		padding: 7px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		background: var(--bg-card);
		color: var(--text-muted);
		font-size: 12px;
		font-weight: 500;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition: border-color 0.12s, color 0.12s;
	}

	.follow-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
