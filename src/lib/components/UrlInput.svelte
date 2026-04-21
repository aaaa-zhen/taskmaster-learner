<script lang="ts">
	let url = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit() {
		if (!url.trim()) return;
		loading = true;
		error = '';

		try {
			const res = await fetch('/api/process', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url })
			});

			const data = await res.json();

			if (data.error) {
				error = data.error;
			} else {
				window.location.href = `/episode/${data.id}`;
			}
		} catch {
			error = 'Failed to process video. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="url-input">
	<label class="label" for="url-input">Paste a YouTube URL</label>
	<div class="input-group">
		<input
			id="url-input"
			type="text"
			bind:value={url}
			placeholder="https://youtube.com/watch?v=..."
			disabled={loading}
		/>
		<button type="submit" disabled={loading || !url.trim()}>
			{loading ? 'Processing...' : 'Study This Clip'}
		</button>
	</div>
	{#if error}
		<p class="error">{error}</p>
	{/if}
	{#if loading}
		<p class="loading-text">Downloading video & analyzing humor... this may take a minute or two.</p>
	{/if}
</form>

<style>
	.url-input {
		width: 100%;
	}

	.label {
		display: block;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 1.5px;
		margin-bottom: 10px;
	}

	.input-group {
		display: flex;
		gap: 10px;
	}

	input {
		flex: 1;
		padding: 14px 18px;
		border: 1.5px solid var(--border);
		border-radius: 8px;
		background: var(--bg-card);
		color: var(--text);
		font-family: var(--font-body);
		font-size: 16px;
		outline: none;
		transition: border-color 0.2s;
	}

	input:focus {
		border-color: var(--accent);
	}

	input::placeholder {
		color: var(--text-light);
	}

	button {
		padding: 10px 22px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 6px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s, transform 0.1s;
		white-space: nowrap;
	}

	button:hover:not(:disabled) {
		background: var(--accent-hover);
		transform: translateY(-1px);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error {
		color: var(--accent);
		margin-top: 10px;
		font-size: 14px;
		font-family: var(--font-ui);
	}

	.loading-text {
		color: var(--text-muted);
		margin-top: 10px;
		font-size: 14px;
		font-style: italic;
	}

	@media (max-width: 768px) {
		.input-group {
			flex-direction: column;
		}

		input {
			padding: 12px 14px;
		}

		button {
			padding: 12px 22px;
			min-height: 44px;
		}
	}
</style>
