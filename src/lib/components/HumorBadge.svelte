<script lang="ts">
	import type { HumorCategory } from '$lib/types';
	import { categoryColors, categoryLabels } from '$lib/utils/colors';

	let { category }: { category: HumorCategory } = $props();

	const color = $derived(categoryColors[category] || '#888');
	const label = $derived(categoryLabels[category] || category);
</script>

<span class="badge" style="background: {color}18; color: {color}; border-color: {color}30">
	{label}
</span>

<style>
	.badge {
		display: inline-block;
		padding: 2px 9px;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		border: 1px solid;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
</style>
