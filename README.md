# Clip Learner

Clip Learner is a SvelteKit app for learning English from real video clips. The current version is built around YouTube clips and subtitle-driven study: you paste a clip URL, the app downloads auto-generated subtitles, breaks the transcript into study chunks, asks an LLM to explain jokes/slang/cultural references, and lets you save vocabulary to a notebook.

The product started from learning English through British comedy, especially Taskmaster, but the codebase is already aimed at a more general "learn from clips" workflow.

## Current Features

- Paste a YouTube URL and create a study item
- Download English auto-subtitles with `yt-dlp`
- Parse subtitles into transcript segments
- Analyze transcript lines for humor, slang, idioms, and cultural references
- Show scene breakdowns and vocabulary suggestions
- Hover or select words in the transcript to get instant definitions
- Save vocabulary into a notebook
- Download clips for offline playback
- Generate a simple quiz from annotations and saved vocabulary

## Stack

- SvelteKit + Svelte 5
- TypeScript
- SQLite via Node's built-in `node:sqlite`
- OpenAI-compatible chat API client for transcript analysis and word explanation
- `yt-dlp` for YouTube metadata, subtitle download, and offline video download

## Project Structure

```text
src/routes/
  +page.svelte                 Home page and clip list
  episode/[id]/+page.svelte    Study view
  episode/[id]/quiz/+page.svelte
  notebook/+page.svelte        Saved vocabulary
  api/process/+server.ts       Clip ingest + subtitle analysis
  api/explain/+server.ts       Segment explanation + word lookup
  api/download/+server.ts      Offline video download
  api/notebook/+server.ts      Vocabulary notebook API

src/lib/server/
  db.ts                        SQLite schema
  ytdlp.ts                     YouTube metadata/subtitle helpers
  subtitles.ts                 SRT parsing and segment merging
  analysis.ts                  Transcript processing pipeline
  claude.ts                    LLM prompts and response parsing
```

## Requirements

- Node.js 22.5+ (required for `node:sqlite`)
- npm
- `yt-dlp` available on `PATH`
- A configured Anthropic-compatible API key in `.env`

Example `.env`:

```sh
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=
```

## Local Development

Install dependencies:

```sh
npm install
```

Start the app:

```sh
npm run dev
```

Quality checks:

```sh
npm run check
npm run build
```

## Data Storage

- SQLite database: `data/app.db`
- Downloaded media and subtitles: `media/<youtube_id>/`

The database schema is created automatically on startup.

## Current Limitations

- The app is tightly coupled to YouTube URLs today
- Transcript quality depends on YouTube auto-captions
- Vocabulary suggestions are currently inserted directly into the notebook table for each episode analysis
- The app now uses local user accounts and per-user settings, but there is no third-party auth or email recovery flow yet
- The UI and naming still mix "Taskmaster" history with the broader "Clip Learner" direction

## Product Direction

This repo is already close to becoming a reusable language-learning platform for:

- comedy clips
- interviews
- talk shows
- anime or drama clips with subtitles
- any video workflow where the learner wants instant explanation without leaving the player
