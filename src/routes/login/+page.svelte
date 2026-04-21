<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<svelte:head><title>Log in – Clip Learner</title></svelte:head>

<div class="auth-wrap">
	<div class="auth-card">
		<div class="auth-logo">Clip Learner</div>
		<h1 class="auth-title">Welcome back</h1>

		{#if form?.error}
			<p class="auth-error">{form.error}</p>
		{/if}

		<form method="POST" use:enhance>
			<label class="auth-label">
				Username
				<input class="auth-input" type="text" name="username" required autocomplete="username" />
			</label>
			<label class="auth-label">
				Password
				<input class="auth-input" type="password" name="password" required autocomplete="current-password" />
			</label>
			<button class="auth-btn" type="submit">Log in</button>
		</form>

		<p class="auth-foot">No account? <a href="/signup">Sign up</a></p>
	</div>
</div>

<style>
	.auth-wrap {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		padding: 24px;
	}
	.auth-card {
		width: min(400px, 100%);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 40px 36px;
	}
	.auth-logo {
		font-size: 13px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 24px;
	}
	.auth-title {
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.02em;
		margin-bottom: 24px;
		color: var(--text);
	}
	.auth-error {
		background: color-mix(in srgb, var(--red) 10%, var(--bg-card));
		border: 1px solid color-mix(in srgb, var(--red) 30%, var(--border));
		color: var(--red);
		border-radius: var(--radius-sm);
		padding: 10px 14px;
		font-size: 13.5px;
		margin-bottom: 16px;
	}
	.auth-label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 14px;
	}
	.auth-input {
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
		transition: border-color 0.15s;
	}
	.auth-input:focus { outline: none; border-color: var(--accent); }
	.auth-btn {
		width: 100%;
		padding: 11px;
		margin-top: 8px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.auth-btn:hover { background: var(--accent-hover); }
	.auth-foot {
		margin-top: 20px;
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
	}
	.auth-foot a { color: var(--accent); }
	.auth-foot a:hover { text-decoration: underline; }
</style>
