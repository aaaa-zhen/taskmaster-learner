<script lang="ts">
	import '../app.css';
	import { authModalOpen } from '$lib/stores/auth';

	let { children, data } = $props();

	let authTab = $state<'login' | 'signup'>('login');
	let authError = $state('');
	let authLoading = $state(false);

	async function handleAuth(e: SubmitEvent) {
		e.preventDefault();
		authError = '';
		authLoading = true;
		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);
		try {
			const res = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: authTab,
					username: fd.get('username'),
					password: fd.get('password')
				})
			});
			const data = await res.json();
			if (data.error) {
				authError = data.error;
			} else {
				window.location.reload();
			}
		} catch {
			authError = 'Network error. Please try again.';
		} finally {
			authLoading = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>

{@render children()}

{#if $authModalOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="auth-overlay"
		tabindex="-1"
		onclick={(e) => { if (e.target === e.currentTarget) authModalOpen.set(false); }}
		onkeydown={(e) => { if (e.key === 'Escape') authModalOpen.set(false); }}
	>
		<div class="auth-card" inert={authLoading}>
			<div class="auth-logo">Clip Learner</div>
			<p class="auth-prompt">Sign up to save words and track your progress.</p>

			<div class="auth-tabs">
				<button class="auth-tab" class:active={authTab === 'login'} onclick={() => { authTab = 'login'; authError = ''; }}>Log in</button>
				<button class="auth-tab" class:active={authTab === 'signup'} onclick={() => { authTab = 'signup'; authError = ''; }}>Sign up</button>
			</div>

			{#if authError}
				<p class="auth-error">{authError}</p>
			{/if}

			<form onsubmit={handleAuth}>
				<label class="auth-label">
					Username
					<input class="auth-input" type="text" name="username" required minlength={authTab === 'signup' ? 3 : 1} autocomplete="username" />
				</label>
				<label class="auth-label">
					Password
					<input class="auth-input" type="password" name="password" required minlength={authTab === 'signup' ? 8 : 1} autocomplete={authTab === 'login' ? 'current-password' : 'new-password'} />
				</label>
				<button class="auth-btn" type="submit" disabled={authLoading}>
					{authLoading ? '…' : authTab === 'login' ? 'Log in' : 'Create account'}
				</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.auth-overlay {
		position: fixed;
		inset: 0;
		z-index: 500;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: color-mix(in srgb, var(--bg) 40%, transparent);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		animation: fadeIn 0.2s ease;
	}
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

	.auth-card {
		width: min(400px, 100%);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 36px;
		box-shadow: 0 24px 64px rgba(0,0,0,0.18);
		animation: slideUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes slideUp {
		from { transform: translateY(10px); opacity: 0; }
		to   { transform: translateY(0);    opacity: 1; }
	}

	.auth-logo {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--accent);
		margin-bottom: 8px;
	}
	.auth-prompt {
		font-size: 13.5px;
		color: var(--text-muted);
		margin-bottom: 20px;
		line-height: 1.5;
	}

	.auth-tabs {
		display: flex;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 3px;
		margin-bottom: 20px;
		background: var(--bg-dark);
	}
	.auth-tab {
		flex: 1;
		padding: 7px 12px;
		font-size: 13px;
		font-weight: 500;
		border-radius: calc(var(--radius-sm) - 2px);
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.auth-tab.active {
		background: var(--bg-card);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	.auth-error {
		background: color-mix(in srgb, var(--red) 10%, var(--bg-card));
		border: 1px solid color-mix(in srgb, var(--red) 30%, var(--border));
		color: var(--red);
		border-radius: var(--radius-sm);
		padding: 9px 13px;
		font-size: 13px;
		margin-bottom: 14px;
	}

	.auth-label {
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 12px;
	}
	.auth-input {
		padding: 9px 11px;
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
		padding: 10px;
		margin-top: 6px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}
	.auth-btn:hover:not(:disabled) { background: var(--accent-hover); }
	.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
