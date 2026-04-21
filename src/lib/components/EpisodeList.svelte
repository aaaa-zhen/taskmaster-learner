<script lang="ts">
	import type { Episode } from '$lib/types';

	let { episodes = [] }: { episodes: Episode[] } = $props();

	function statusLabel(status: string) {
		switch (status) {
			case 'pending': return 'Queued';
			case 'downloading': return 'Downloading...';
			case 'analyzing': return 'Analyzing humor...';
			case 'ready': return 'Ready to study';
			case 'error': return 'Error';
			default: return status;
		}
	}

	async function deleteEpisode(e: MouseEvent, id: string) {
		e.preventDefault();
		e.stopPropagation();
		if (!confirm('Delete this clip?')) return;
		await fetch('/api/process', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		window.location.reload();
	}

	function statusColor(status: string) {
		switch (status) {
			case 'ready': return 'var(--green)';
			case 'error': return 'var(--accent)';
			case 'downloading':
			case 'analyzing': return 'var(--blue)';
			default: return 'var(--text-muted)';
		}
	}
</script>

{#if episodes.length > 0}
	<div class="list">
		<h2>Your Clips</h2>
		<hr class="dotted-sep" />
		{#each episodes as ep}
			<a
				href={ep.status === 'ready' ? `/episode/${ep.id}` : undefined}
				class="episode-card"
				class:disabled={ep.status !== 'ready'}
			>
				{#if ep.thumbnail}
					<img src={ep.thumbnail} alt={ep.title} class="thumb" />
				{:else}
					<div class="thumb-placeholder"></div>
				{/if}
				<div class="info">
					<h3>{ep.title}</h3>
					<span class="status" style="color: {statusColor(ep.status)}">
						{statusLabel(ep.status)}
					</span>
					{#if ep.error_message}
						<p class="error">{ep.error_message}</p>
					{/if}
				</div>
				<button class="delete-btn" onclick={(e) => deleteEpisode(e, ep.id)} title="Delete clip">&times;</button>
			</a>
			<hr class="dotted-sep" />
		{/each}
	</div>
{/if}

<style>
	.list {
		width: 100%;
	}

	h2 {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 400;
		margin-bottom: 16px;
	}

	.episode-card {
		display: flex;
		gap: 16px;
		padding: 16px 0;
		text-decoration: none;
		color: inherit;
		transition: opacity 0.2s;
	}

	.episode-card:hover:not(.disabled) {
		opacity: 0.8;
	}

	.episode-card.disabled {
		opacity: 0.6;
		cursor: default;
	}

	.thumb {
		width: 140px;
		height: 80px;
		border-radius: 6px;
		object-fit: cover;
		border: 1px solid var(--border);
	}

	.thumb-placeholder {
		width: 140px;
		height: 80px;
		border-radius: 6px;
		background: var(--bg-dark);
		border: 1px solid var(--border);
	}

	.info {
		flex: 1;
		min-width: 0;
	}

	.info h3 {
		font-family: var(--font-body);
		font-size: 16px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status {
		font-family: var(--font-ui);
		font-size: 13px;
		margin-top: 4px;
		display: block;
	}

	.error {
		color: var(--accent);
		font-size: 12px;
		margin-top: 4px;
		font-family: var(--font-ui);
	}

	.delete-btn {
		background: none;
		border: none;
		color: var(--text-light);
		font-size: 18px;
		cursor: pointer;
		padding: 4px 8px;
		min-height: auto;
		min-width: auto;
		transition: color 0.15s;
	}
	.delete-btn:hover {
		color: var(--accent);
	}

	@media (max-width: 768px) {
		.thumb {
			width: 100px;
			height: 58px;
		}

		.thumb-placeholder {
			width: 100px;
			height: 58px;
		}

		.episode-card {
			gap: 12px;
			padding: 12px 0;
		}

		.info h3 {
			font-size: 14px;
		}
	}
</style>
