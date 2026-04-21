# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Production build
npm run check        # Run svelte-check + TypeScript type checking
npm run check:watch  # Watch mode for type checking
npm run preview      # Preview production build
```

No test framework is configured.

## Requirements

- Node.js + npm
- `yt-dlp` on PATH (used for subtitle and video download)
- `.env` with `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_BASE_URL`)
- SQLite database auto-created at `data/app.db` on first run

## Architecture

**Clip Learner** is a SvelteKit app for learning English from YouTube clips. Users paste a URL; the app downloads auto-generated subtitles, analyzes them with an LLM for humor/slang/idioms, and provides an interactive study UI.

### Data Flow

1. `POST /api/process` — validates YouTube URL, creates episode record (status: `pending`), then kicks off background processing (not awaited)
2. Background: `downloadSubtitlesOnly()` fetches YouTube page XML captions → `parseSrt()` cleans and merges into 5–10 second chunks → `processEpisode()` inserts segments → `analyzeTranscript()` calls LLM → inserts annotations/scenes/vocab → status set to `ready`
3. User is redirected to `/episode/[id]` which may show an "analyzing" state until ready

### Key Server Modules (`src/lib/server/`)

- **`db.ts`** — SQLite via `better-sqlite3`; schema auto-initialized on first use; tables: `episodes`, `segments`, `humor_annotations`, `scene_breakdowns`, `vocab_notebook`, `app_settings`
- **`claude.ts`** — All LLM interactions: `analyzeTranscript()`, `explainSegment()`, `lookupWord()`, `generateQuiz()`. Uses `@anthropic-ai/sdk` but is also compatible with OpenAI-SDK-compatible endpoints via `base_url` config
- **`ytdlp.ts`** — Wraps `yt-dlp` CLI: video metadata, subtitle download (XML→SRT conversion), optional video download
- **`subtitles.ts`** — SRT parsing, segment merging, deduplication of auto-caption artifacts
- **`analysis.ts`** — Orchestrates the full pipeline from segments → LLM → DB

### API Routes (`src/routes/api/`)

| Route | Purpose |
|---|---|
| `process` | Ingest YouTube URL, trigger analysis, delete episode |
| `explain` | On-demand segment explanation or word lookup |
| `quiz` | Generate quiz from episode vocabulary |
| `notebook` | CRUD for saved vocabulary |
| `settings` | Persist LLM config (api_key, base_url, model) in DB |
| `download` | Download video for offline playback (returns 501 on serverless) |
| `stats` | Usage statistics |
| `debug` | Debug helpers |

### LLM Configuration

Settings are stored in the `app_settings` DB table (key/value). The UI's `SettingsModal.svelte` allows changing `api_key`, `base_url`, and `model`. Falls back to env vars `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL`.

### Svelte 5 Runes

Components use Svelte 5 runes (`$state()`, `$effect()`, `$derived()`) — not the legacy reactive `$:` syntax.

### Media Serving

`src/hooks.server.ts` intercepts `/media/*` requests and serves files from the local `media/<youtube_id>/` directory with HTTP range request support (for video seeking). This only works on Node.js runtimes, not serverless.

### Humor Categories

The 11 annotation categories used throughout the type system and UI: `wordplay`, `cultural_reference`, `sarcasm`, `deadpan`, `callback`, `self_deprecation`, `banter`, `slang`, `idiom`, `absurdist`, `double_entendre`, `caption_error`.
