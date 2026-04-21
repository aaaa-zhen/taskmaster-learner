<script lang="ts">
    import { page } from '$app/state';
</script>

<div class="error-page">
    <h1>{page.status}</h1>
    <p>{page.error?.message || 'Something went wrong'}</p>
    <a href="/">Back to home</a>
</div>

<style>
    .error-page {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 40px;
        text-align: center;
    }
    h1 {
        font-family: var(--font-display);
        font-size: 72px;
        font-weight: 900;
        color: var(--text);
    }
    p {
        font-size: 18px;
        color: var(--text-muted);
        max-width: 400px;
    }
    a {
        margin-top: 12px;
        padding: 10px 24px;
        background: var(--accent);
        color: white;
        border-radius: 6px;
        font-family: var(--font-ui);
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
    }
    a:hover {
        background: var(--accent-hover);
        text-decoration: none;
    }
</style>
