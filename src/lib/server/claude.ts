import OpenAI from 'openai';
import { query } from './db';
// Use SvelteKit's dynamic env accessor — `vite dev` doesn't push .env into
// process.env, so reading ANTHROPIC_* from process.env silently failed.
import { env } from '$env/dynamic/private';

const DEFAULTS = {
	api_key: '',
	base_url: 'https://aihubmix.com',
	model: 'gpt-5.4-nano'
};

async function getSettings(userId: number): Promise<typeof DEFAULTS> {
	try {
		const { rows } = await query(
			'SELECT key, value FROM user_settings WHERE user_id = $1',
			[userId]
		);
		const settings = { ...DEFAULTS };
		for (const row of rows) {
			if (row.key in settings) {
				(settings as any)[row.key] = row.value;
			}
		}
		if (rows.length === 0) {
			const { rows: legacyRows } = await query('SELECT key, value FROM app_settings');
			for (const row of legacyRows) {
				if (row.key in settings) {
					(settings as any)[row.key] = row.value;
				}
			}
		}
		// Fallback to env vars if no DB settings
		if (!settings.api_key && env.ANTHROPIC_API_KEY) {
			settings.api_key = env.ANTHROPIC_API_KEY;
		}
		if (env.ANTHROPIC_BASE_URL) {
			settings.base_url = settings.base_url || env.ANTHROPIC_BASE_URL;
		}
		return settings;
	} catch {
		return {
			api_key: env.ANTHROPIC_API_KEY || '',
			base_url: env.ANTHROPIC_BASE_URL || DEFAULTS.base_url,
			model: DEFAULTS.model
		};
	}
}

async function chat(
	prompt: string,
	maxTokens: number,
	userId: number,
	opts: { json?: boolean } = {}
): Promise<string> {
	const settings = await getSettings(userId);
	if (!settings.api_key) {
		throw new Error('API key not configured. Go to Settings to add your API key.');
	}
	const client = new OpenAI({
		apiKey: settings.api_key,
		baseURL: settings.base_url + '/v1',
		timeout: 180_000
	});
	const body: Record<string, unknown> = {
		model: settings.model,
		max_completion_tokens: maxTokens,
		messages: [{ role: 'user', content: prompt }]
	};
	// Ask the provider to return valid JSON when we're going to parse it.
	// Providers that don't support this field usually ignore it safely.
	if (opts.json) {
		body.response_format = { type: 'json_object' };
	}
	const res = await client.chat.completions.create(body as any);
	return res.choices[0]?.message?.content || '';
}

/**
 * Best-effort extraction of a JSON object from LLM output.
 *
 * Handles: plain JSON, ```json fences, and prose that happens to contain a
 * JSON block. Returns null if nothing parses.
 */
function extractJson<T = unknown>(text: string): T | null {
	if (!text) return null;
	const cleaned = text
		.replace(/^\s*```json\s*/im, '')
		.replace(/^\s*```\s*/im, '')
		.replace(/\s*```\s*$/im, '')
		.trim();
	try {
		return JSON.parse(cleaned) as T;
	} catch {
		// Fall through to bracket-based extraction.
	}
	const first = cleaned.indexOf('{');
	const last = cleaned.lastIndexOf('}');
	if (first === -1 || last === -1 || last <= first) return null;
	try {
		return JSON.parse(cleaned.slice(first, last + 1)) as T;
	} catch {
		return null;
	}
}

export async function analyzeTranscript(
	segments: { index: number; text: string }[],
	userId: number
): Promise<AnalysisResult> {
	const transcript = segments
		.map(s => `[${s.index}] ${s.text}`)
		.join('\n');

	const text = await chat(`You are helping someone learn English from videos. They understand basic grammar but struggle with jokes, slang, and culture. Write ALL explanations using very simple, easy words — like explaining to a 10-year-old.

IMPORTANT RULES:
1. This transcript comes from YouTube AUTO-CAPTIONS which often have mistakes, especially with accents. When something doesn't make sense, think about what they PROBABLY said.
2. British comedy is FULL of dirty jokes, sexual innuendo, and double meanings. ALWAYS check if a phrase could have a sexual or rude second meaning — this is often the actual joke. Don't be shy about explaining these. Words like "flicking", "coming", "banging", "blowing", etc. are often used as double entendres (one meaning is innocent, the other is sexual/rude).
3. Look for DOUBLE ENTENDRE — sentences that sound innocent but have a hidden dirty/funny meaning. This is one of the most common types of British humor and learners need to understand it.
4. Don't be polite or censor yourself. The learner needs the REAL explanation of why something is funny, even if it's rude or sexual.

TRANSCRIPT (each line prefixed with [segment_index]):
${transcript}

ONLY annotate moments that are genuinely one of these:
- Actually funny (jokes, wordplay, sarcasm)
- Genuinely difficult slang or idioms a learner wouldn't know
- Real cultural references that need explaining
- Moments where the auto-caption is clearly wrong and confusing

DO NOT annotate normal speech. DO NOT force things into categories — only annotate if it truly fits. Be selective — quality over quantity. If a line is just normal talking, skip it.

Categories: wordplay, cultural_reference, sarcasm, deadpan, callback, self_deprecation, banter, slang, idiom, absurdist, double_entendre, caption_error

For each annotation:
- excerpt: the exact words from the transcript
- segment_index: which line it's in
- category: one of the categories above (use "caption_error" when auto-captions got words wrong)
- explanation: what it means in very simple English. If caption is wrong, say what they probably said.

Also provide scene-by-scene breakdown and vocabulary suggestions.

Return as JSON:
{
  "annotations": [
    { "segment_index": 0, "excerpt": "exact words", "category": "sarcasm", "explanation": "Simple explanation...", "start_pos": 0, "end_pos": 10 }
  ],
  "scenes": [
    { "start_seg": 0, "end_seg": 5, "title": "Scene title", "explanation": "What happens and why it's funny in simple words", "humor_types": ["sarcasm"] }
  ],
  "vocabulary": [
    { "word": "chuffed", "definition": "Very happy (casual British word)", "example": "He was chuffed with his score", "category": "slang" }
  ]
}

Return ONLY valid JSON, no markdown code blocks.`, 4096, userId);

	// Strip markdown code blocks if present
	let cleaned = text.replace(/^```json\s*/m, '').replace(/\s*```\s*$/m, '').trim();

	try {
		return JSON.parse(cleaned);
	} catch {
		try {
			let fixed = cleaned;
			fixed = fixed.replace(/,\s*\{[^}]*$/s, '');
			const openBraces = (fixed.match(/\{/g) || []).length;
			const closeBraces = (fixed.match(/\}/g) || []).length;
			const openBrackets = (fixed.match(/\[/g) || []).length;
			const closeBrackets = (fixed.match(/\]/g) || []).length;
			for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
			for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';
			const result = JSON.parse(fixed);
			return {
				annotations: result.annotations || [],
				scenes: result.scenes || [],
				vocabulary: result.vocabulary || []
			};
		} catch {
			console.error('Could not parse AI response, returning empty analysis. Raw:', text.slice(0, 200));
			return { annotations: [], scenes: [], vocabulary: [] };
		}
	}
}

export async function explainSegment(
	segmentText: string,
	context: string[],
	userId: number
): Promise<string> {
	const contextStr = context.join('\n');

	return chat(`You explain English videos to someone who is still learning. Explain like you're talking to a 10-year-old — use the simplest words possible. Never use difficult words in your explanation.

Line: "${segmentText}"

Context:
${contextStr}

Give a SHORT explanation. Use markdown:

- **What they said:** Rewrite what they said in very simple, easy English (1 sentence)
- **Why it's funny/interesting:** Explain the joke or point like you're telling a friend. Keep it super simple (1-2 sentences)
- **Hard words:** List any difficult words and explain each one in baby-simple English
- **Tone:** Is this a joke? Serious? Sarcastic? Friendly teasing?

Skip sections that don't apply. No intro, just explain. Use words a child would know.`, 400, userId);
}

interface WordLookupContext {
	episodeTitle?: string;
	source?: 'transcript' | 'analysis' | 'generic';
	currentLine?: string;
	previousLine?: string;
	nextLine?: string;
}

/**
 * Per-user LRU cache for word lookups. Same word in the same context (current
 * line) returns instantly on repeat clicks — common when studying a single
 * transcript. 24h TTL, 200 entries per user.
 */
interface CachedLookup {
	value: WordEntry;
	expiresAt: number;
}
const lookupCache = new Map<string, CachedLookup>();
const LOOKUP_TTL_MS = 24 * 60 * 60 * 1000;
const LOOKUP_CACHE_MAX = 400;

function lookupCacheKey(userId: number, word: string, context?: WordLookupContext): string {
	return [userId, word.toLowerCase().trim(), context?.currentLine || ''].join('\u0001');
}

export async function lookupWord(
	word: string,
	userId: number,
	context?: WordLookupContext
): Promise<object> {
	// --- cache hit?
	const cacheKey = lookupCacheKey(userId, word, context);
	const cached = lookupCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}

	const extraContext = [
		context?.episodeTitle ? `Episode title: ${context.episodeTitle}` : '',
		context?.source ? `Source: ${context.source}` : '',
		context?.previousLine ? `Previous line: ${context.previousLine}` : '',
		context?.currentLine ? `Current line: ${context.currentLine}` : '',
		context?.nextLine ? `Next line: ${context.nextLine}` : ''
	].filter(Boolean).join('\n');

	const isPhrase = word.trim().split(/\s+/).length > 2;
	const text = await chat(
		`You are explaining ${isPhrase ? 'a phrase or sentence' : 'a word'} to a 10-year-old child learning English. Use the SIMPLEST words possible. Short sentences. Fun and clear.

${isPhrase ? 'Phrase' : 'Word'}: "${word}"
Context: ${extraContext || 'No context.'}

Reply with valid JSON only (no markdown, no prose). All five fields are required; use "" for note if there's nothing extra to say.

Schema:
- phonetic: ${isPhrase ? '"(phrase)"' : 'IPA-style pronunciation like "/ teɪk /"'}
- partOfSpeech: ${isPhrase ? '"phrase" or "idiom" or "sentence"' : '"noun" or "verb" or "adjective" or similar'}
- definition: one simple sentence explaining what it means HERE in the video, max 20 words, like talking to a little kid
- example: one super simple example sentence, max 12 words
- note: one short sentence only if there's something extra important; otherwise "".

Example response:
{"phonetic":"/ teɪk /","partOfSpeech":"verb","definition":"To grab something and carry it away.","example":"She took the apple with her.","note":""}`,
		280,
		userId
	);

	const parsed = extractJson<WordEntry>(text);
	if (parsed) {
		// Cache successful lookups for 24h, evict oldest when over cap.
		if (lookupCache.size >= LOOKUP_CACHE_MAX) {
			const firstKey = lookupCache.keys().next().value;
			if (firstKey) lookupCache.delete(firstKey);
		}
		lookupCache.set(cacheKey, { value: parsed, expiresAt: Date.now() + LOOKUP_TTL_MS });
		return parsed;
	}
	// Log the raw response so we can diagnose JSON-parse failures without
	// resorting to print-debugging through the UI.
	console.error(
		`[lookupWord] JSON parse failed for word=${JSON.stringify(word)}. Raw response (${text.length} chars):`,
		text.slice(0, 800)
	);
	// Last-ditch fallback — at least show the word back to the user instead
	// of a broken JSON fragment.
	return {
		phonetic: '',
		partOfSpeech: '',
		definition: `Couldn't parse a definition for "${word}". Try again or check the model setting.`,
		note: ''
	};
}

interface WordEntry {
	phonetic?: string;
	partOfSpeech?: string;
	definition?: string;
	example?: string;
	note?: string;
}

export interface AnalysisResult {
	annotations: {
		segment_index: number;
		excerpt: string;
		category: string;
		explanation: string;
		start_pos: number;
		end_pos: number;
	}[];
	scenes: {
		start_seg: number;
		end_seg: number;
		title: string;
		explanation: string;
		humor_types: string[];
	}[];
	vocabulary: {
		word: string;
		definition: string;
		example: string;
		category: string;
	}[];
}

// ----------------------------------------------------------------------
// Adaptive quiz — Level 2 "tutor" design.
//
// 3 stages:
//   initial   → 3 questions spanning vocab, comprehension, nuance
//   adaptive  → 2 follow-up questions that target whatever the user got
//               wrong in stage 1 (or harder variants if everything was right)
//   diagnose  → final summary: per-category breakdown + strengths/weaknesses
// ----------------------------------------------------------------------

export interface QuizQuestion {
	/** Human-readable label like "Vocabulary" — kept for UI badge. */
	type: string;
	/** Machine tag used for grouping ("vocab", "comprehension", "idiom", ...). */
	category: string;
	question: string;
	options: string[];
	correct: number;
	context?: string;
	/** If the question is about a specific saved word, the word itself. */
	sourceWord?: string;
}

export interface QuizAnswer {
	questionIndex: number;
	selected: number;
	correct: boolean;
}

export interface QuizDiagnosis {
	score: number;
	total: number;
	comprehension: 'excellent' | 'good' | 'fair' | 'needs-work';
	byCategory: { category: string; correct: number; total: number }[];
	summary: string;
	strengths: string[];
	weaknesses: string[];
	recommendations: string[];
}

/** Sample up to N segments evenly across the transcript. */
function sampleSegments<T>(segments: T[], count: number): T[] {
	if (segments.length <= count) return segments;
	const step = Math.max(1, Math.floor(segments.length / count));
	return segments.filter((_, i) => i % step === 0).slice(0, count);
}

function ensureQuestions(raw: unknown): QuizQuestion[] {
	if (!Array.isArray(raw)) return [];
	const cleaned: QuizQuestion[] = [];
	for (const q of raw) {
		if (
			q &&
			typeof q === 'object' &&
			typeof (q as any).question === 'string' &&
			Array.isArray((q as any).options) &&
			typeof (q as any).correct === 'number'
		) {
			const options = (q as any).options.map((o: unknown) => String(o ?? ''));
			if (options.length !== 4) continue;
			cleaned.push({
				type: String((q as any).type ?? 'Comprehension'),
				category: String((q as any).category ?? 'comprehension').toLowerCase(),
				question: String((q as any).question),
				options,
				correct: Math.max(0, Math.min(3, Math.floor((q as any).correct))),
				context: (q as any).context ? String((q as any).context) : undefined,
				sourceWord: (q as any).sourceWord ? String((q as any).sourceWord) : undefined
			});
		}
	}
	return cleaned;
}

/**
 * Stage 1 — Initial quiz.
 * Returns 3 questions spanning category variety. Biases toward the user's
 * saved words for this episode when available so the quiz feels personal.
 */
export async function generateInitialQuiz(
	segments: { text: string }[],
	savedWords: { word: string; definition: string; example?: string }[],
	userId: number
): Promise<QuizQuestion[]> {
	const sample = sampleSegments(segments, 8);
	const transcript = sample.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
	const vocabList = savedWords
		.slice(0, 10)
		.map((v) => `- "${v.word}": ${v.definition}`)
		.join('\n');
	const savedWordsInstruction = savedWords.length
		? `At least 1 of the 3 questions MUST test a word from the learner's saved list above — they marked these because they found them hard or interesting.`
		: `No saved words yet, so aim for a mix of comprehension and vocabulary from the transcript.`;

	const text = await chat(
		`You are a language learning tutor creating a short diagnostic quiz.

VIDEO TRANSCRIPT EXCERPTS:
${transcript}

LEARNER'S SAVED WORDS FROM THIS VIDEO:
${vocabList || '(none yet)'}

Task: generate exactly 3 multiple-choice questions to measure how well the learner understood this clip. ${savedWordsInstruction}

Aim for variety across these categories: "vocab", "comprehension", "idiom", "nuance". Pick whichever 3 fit the transcript best.

Rules:
- Each question has exactly 4 options, only 1 correct
- Questions must be answerable from the transcript or saved-words list
- Keep wording clear and concise
- "correct" is the 0-based index of the right answer
- "category" is one lowercase word from {vocab, comprehension, idiom, nuance, slang, tone}
- Include "sourceWord" only when the question is about a specific saved word

Reply with JSON only, an array of 3 objects:
[
  {"type":"Vocabulary","category":"vocab","question":"...","options":["A","B","C","D"],"correct":0,"context":"optional quote","sourceWord":"takeout"}
]`,
		900,
		userId
	);

	const parsed = extractJson(text);
	return ensureQuestions(parsed).slice(0, 3);
}

/**
 * Stage 2 — Adaptive follow-up.
 * Looks at what the learner got wrong in the initial batch and drills that
 * category. If they aced it, generates harder variants instead.
 */
export async function generateAdaptiveQuiz(
	segments: { text: string }[],
	savedWords: { word: string; definition: string; example?: string }[],
	previousQuestions: QuizQuestion[],
	previousAnswers: QuizAnswer[],
	userId: number
): Promise<QuizQuestion[]> {
	const sample = sampleSegments(segments, 8);
	const transcript = sample.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
	const vocabList = savedWords
		.slice(0, 10)
		.map((v) => `- "${v.word}": ${v.definition}`)
		.join('\n');

	// Build a compact record of Q+A for the LLM.
	const review = previousQuestions
		.map((q, i) => {
			const ans = previousAnswers.find((a) => a.questionIndex === i);
			const chosen = ans ? q.options[ans.selected] : '(skipped)';
			const correct = q.options[q.correct];
			const mark = ans?.correct ? '✓' : '✗';
			return `${i + 1}. [${q.category}] ${mark} "${q.question}"\n   learner picked: ${chosen}\n   correct: ${correct}`;
		})
		.join('\n');

	const wrongCategories = [
		...new Set(
			previousAnswers
				.filter((a) => !a.correct)
				.map((a) => previousQuestions[a.questionIndex]?.category)
				.filter(Boolean)
		)
	];
	const strategy = wrongCategories.length
		? `The learner struggled with: ${wrongCategories.join(', ')}. Generate 2 new questions that drill these categories with different angles — don't just repeat the same question.`
		: `The learner got everything right. Generate 2 harder questions in the same topic areas — subtle nuance, double-meaning, or tricky idioms.`;

	const text = await chat(
		`You are a language tutor running a short adaptive quiz.

VIDEO TRANSCRIPT EXCERPTS:
${transcript}

LEARNER'S SAVED WORDS:
${vocabList || '(none)'}

PREVIOUS QUESTIONS & ANSWERS:
${review}

${strategy}

Rules:
- Exactly 2 new questions (never repeat a prior question)
- Each has 4 options, 1 correct
- Use the same JSON schema: {type, category, question, options, correct, context?, sourceWord?}
- category is lowercase one word from {vocab, comprehension, idiom, nuance, slang, tone}

Reply with JSON only, an array of 2 objects.`,
		700,
		userId
	);

	const parsed = extractJson(text);
	return ensureQuestions(parsed).slice(0, 2);
}

/**
 * Stage 3 — Diagnosis.
 * Computes the per-category breakdown deterministically, and asks the LLM
 * for a short personalized summary + recommendations.
 */
export async function diagnoseQuiz(
	questions: QuizQuestion[],
	answers: QuizAnswer[],
	userId: number
): Promise<QuizDiagnosis> {
	// Deterministic scoring first — don't let the LLM get the numbers wrong.
	const total = questions.length;
	const score = answers.filter((a) => a.correct).length;
	const categoryMap = new Map<string, { correct: number; total: number }>();
	for (let i = 0; i < questions.length; i++) {
		const cat = questions[i].category || 'comprehension';
		const row = categoryMap.get(cat) ?? { correct: 0, total: 0 };
		row.total += 1;
		const a = answers.find((x) => x.questionIndex === i);
		if (a?.correct) row.correct += 1;
		categoryMap.set(cat, row);
	}
	const byCategory = Array.from(categoryMap.entries()).map(([category, v]) => ({
		category,
		correct: v.correct,
		total: v.total
	}));

	const pct = total > 0 ? score / total : 0;
	const comprehension: QuizDiagnosis['comprehension'] =
		pct >= 0.9 ? 'excellent' : pct >= 0.7 ? 'good' : pct >= 0.5 ? 'fair' : 'needs-work';

	// LLM fills in the human parts (summary, strengths, weaknesses, recs).
	const breakdown = byCategory
		.map((r) => `${r.category}: ${r.correct}/${r.total}`)
		.join(', ');
	const missed = questions
		.map((q, i) => ({ q, a: answers.find((x) => x.questionIndex === i) }))
		.filter(({ a }) => a && !a.correct)
		.map(({ q, a }) => `- [${q.category}] "${q.question}" — picked "${q.options[a!.selected]}", correct was "${q.options[q.correct]}"`)
		.join('\n');

	const text = await chat(
		`You are a language tutor giving friendly, concrete feedback after a short adaptive quiz.

Score: ${score}/${total}
Category breakdown: ${breakdown}
Questions the learner got wrong:
${missed || '(none — perfect score)'}

Write a JSON object with these fields:
- summary: one friendly sentence (under 25 words) describing how they did
- strengths: array of 1–3 short strings (category names or phrases they handled well)
- weaknesses: array of 0–3 short strings (topics to revisit)
- recommendations: array of 1–3 concrete next steps (e.g. "Re-watch the middle section where idioms cluster", "Save 3 more words tagged 'slang'")

Keep everything simple — written for a 10-year-old level reader.

Reply with JSON only, one object with those 4 keys.`,
		400,
		userId
	);

	const parsed = extractJson<{
		summary?: string;
		strengths?: string[];
		weaknesses?: string[];
		recommendations?: string[];
	}>(text);

	return {
		score,
		total,
		comprehension,
		byCategory,
		summary:
			parsed?.summary ||
			(pct === 1
				? 'Perfect score — you really got this clip!'
				: pct >= 0.7
					? 'Nice work — you understood most of this clip.'
					: 'Good effort — try watching again and reviewing the tricky parts.'),
		strengths: Array.isArray(parsed?.strengths) ? parsed!.strengths!.slice(0, 3) : [],
		weaknesses: Array.isArray(parsed?.weaknesses) ? parsed!.weaknesses!.slice(0, 3) : [],
		recommendations: Array.isArray(parsed?.recommendations)
			? parsed!.recommendations!.slice(0, 3)
			: []
	};
}

/**
 * Legacy single-call quiz entrypoint — kept for any callers still using it.
 * New flow is generateInitialQuiz + generateAdaptiveQuiz + diagnoseQuiz.
 */
export async function generateQuiz(
	segments: { text: string }[],
	vocabulary: { word: string; definition: string; example?: string }[],
	userId: number
): Promise<QuizQuestion[]> {
	return generateInitialQuiz(segments, vocabulary, userId);
}
