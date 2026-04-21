<script lang="ts">
	let { data } = $props();

	interface Question {
		type: 'meaning' | 'humor_type' | 'fill_blank';
		question: string;
		options: string[];
		correct: number;
		context?: string;
	}

	let questions = $state<Question[]>([]);
	let currentQ = $state(0);
	let selectedAnswer = $state(-1);
	let answered = $state(false);
	let score = $state(0);
	let finished = $state(false);

	function generateQuestions(): Question[] {
		const qs: Question[] = [];
		const anns = data.annotations as any[];
		const vocabs = data.vocabulary as any[];

		// "What does it mean?" questions from vocabulary
		for (const v of vocabs.slice(0, 5)) {
			const wrongDefs = vocabs
				.filter((x: any) => x.id !== v.id && x.definition)
				.map((x: any) => x.definition)
				.slice(0, 3);

			if (wrongDefs.length < 2) continue;

			const options = shuffle([v.definition, ...wrongDefs.slice(0, 3)]);
			qs.push({
				type: 'meaning',
				question: `What does "${v.word}" mean?`,
				options,
				correct: options.indexOf(v.definition),
				context: v.example
			});
		}

		// "What type of humor?" questions from annotations
		const humorTypes = ['sarcasm', 'deadpan', 'wordplay', 'banter', 'self_deprecation', 'absurdist', 'callback'];
		for (const ann of anns.slice(0, 5)) {
			if (!ann.segment_text) continue;
			const wrongTypes = humorTypes
				.filter(t => t !== ann.category)
				.slice(0, 3);

			const labels = [ann.category, ...wrongTypes].map(formatCategory);
			const shuffled = shuffle(labels);
			qs.push({
				type: 'humor_type',
				question: `What type of humor is this?`,
				options: shuffled,
				correct: shuffled.indexOf(formatCategory(ann.category)),
				context: `"${ann.excerpt}"`
			});
		}

		return shuffle(qs).slice(0, 8);
	}

	function formatCategory(cat: string): string {
		return cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}

	function shuffle<T>(arr: T[]): T[] {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	function selectAnswer(idx: number) {
		if (answered) return;
		selectedAnswer = idx;
		answered = true;
		if (idx === questions[currentQ].correct) {
			score++;
		}
	}

	function nextQuestion() {
		if (currentQ + 1 >= questions.length) {
			finished = true;
		} else {
			currentQ++;
			selectedAnswer = -1;
			answered = false;
		}
	}

	function restart() {
		questions = generateQuestions();
		currentQ = 0;
		selectedAnswer = -1;
		answered = false;
		score = 0;
		finished = false;
	}

	// Generate on mount
	questions = generateQuestions();
</script>

<svelte:head>
	<title>Quiz - {data.episode.title}</title>
</svelte:head>

<div class="quiz-page">
	<header>
		<a href="/episode/{data.episode.id}" class="back">Back to clip</a>
		<h1>Quiz: {data.episode.title}</h1>
	</header>

	<hr class="dotted-sep" />

	<div class="quiz-container">
		{#if questions.length === 0}
			<div class="empty">
				<p>Not enough data to generate a quiz yet. Study the clip first!</p>
				<a href="/episode/{data.episode.id}" class="btn">Back to clip</a>
			</div>
		{:else if finished}
			<div class="results">
				<h2>Quiz Complete!</h2>
				<div class="score-display">
					<span class="score-num">{score}</span>
					<span class="score-sep">/</span>
					<span class="score-total">{questions.length}</span>
				</div>
				<p class="score-text">
					{#if score === questions.length}
						Perfect! You really get British humor!
					{:else if score >= questions.length * 0.7}
						Great job! You're getting the hang of it!
					{:else if score >= questions.length * 0.4}
						Good effort! Watch the clip again and try once more.
					{:else}
						Keep studying! British humor takes time to master.
					{/if}
				</p>
				<div class="results-actions">
					<button class="btn" onclick={restart}>Try Again</button>
					<a href="/episode/{data.episode.id}" class="btn btn-secondary">Back to clip</a>
				</div>
			</div>
		{:else}
			<div class="progress">
				<span class="q-num">Question {currentQ + 1} of {questions.length}</span>
				<span class="q-score">Score: {score}</span>
			</div>

			<hr class="dotted-sep" />

			<div class="question-card">
				<h2>{questions[currentQ].question}</h2>
				{#if questions[currentQ].context}
					<p class="context">{questions[currentQ].context}</p>
				{/if}

				<div class="options">
					{#each questions[currentQ].options as option, i}
						<button
							class="option"
							class:selected={selectedAnswer === i}
							class:correct={answered && i === questions[currentQ].correct}
							class:wrong={answered && selectedAnswer === i && i !== questions[currentQ].correct}
							onclick={() => selectAnswer(i)}
							disabled={answered}
						>
							{option}
						</button>
					{/each}
				</div>

				{#if answered}
					<div class="feedback">
						{#if selectedAnswer === questions[currentQ].correct}
							<p class="correct-text">Correct!</p>
						{:else}
							<p class="wrong-text">Not quite. The answer was: <strong>{questions[currentQ].options[questions[currentQ].correct]}</strong></p>
						{/if}
						<button class="btn" onclick={nextQuestion}>
							{currentQ + 1 >= questions.length ? 'See Results' : 'Next Question'}
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.quiz-page {
		max-width: 700px;
		margin: 0 auto;
		padding: 30px;
	}

	header {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}

	.back {
		font-family: var(--font-ui);
		font-size: 13px;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 18px;
		font-weight: 400;
	}

	.quiz-container {
		padding: 30px 0;
	}

	.progress {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
		padding: 12px 0;
	}

	.question-card {
		padding: 30px 0;
	}

	.question-card h2 {
		font-family: var(--font-display);
		font-size: 24px;
		font-weight: 700;
		margin-bottom: 12px;
	}

	.context {
		color: var(--text-muted);
		font-style: italic;
		margin-bottom: 24px;
		font-size: 16px;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.option {
		padding: 16px 20px;
		background: white;
		border: 1.5px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-body);
		font-size: 15px;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s;
		color: var(--text);
	}

	.option:hover:not(:disabled) {
		border-color: var(--accent);
		background: rgba(232, 76, 48, 0.03);
	}

	.option.correct {
		border-color: var(--green);
		background: rgba(90, 154, 106, 0.1);
	}

	.option.wrong {
		border-color: var(--accent);
		background: rgba(232, 76, 48, 0.08);
	}

	.option:disabled {
		cursor: default;
	}

	.feedback {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}

	.correct-text {
		color: var(--green);
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		margin-bottom: 16px;
	}

	.wrong-text {
		color: var(--accent);
		margin-bottom: 16px;
		font-size: 15px;
	}

	.results {
		text-align: center;
		padding: 40px 0;
	}

	.results h2 {
		font-family: var(--font-display);
		font-size: 28px;
	}

	.score-display {
		font-family: var(--font-display);
		font-size: 64px;
		font-weight: 900;
		margin: 20px 0;
	}

	.score-num {
		color: var(--accent);
	}

	.score-sep {
		color: var(--border);
		margin: 0 4px;
	}

	.score-total {
		color: var(--text-muted);
	}

	.score-text {
		font-size: 18px;
		color: var(--text-muted);
		margin-bottom: 30px;
		font-style: italic;
	}

	.results-actions {
		display: flex;
		gap: 12px;
		justify-content: center;
	}

	.btn {
		display: inline-block;
		padding: 12px 28px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 50px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.2s;
	}

	.btn:hover {
		background: var(--accent-hover);
		text-decoration: none;
	}

	.btn-secondary {
		background: white;
		color: var(--text);
		border: 1px solid var(--border);
	}

	.btn-secondary:hover {
		background: var(--bg-dark);
	}

	.empty {
		text-align: center;
		padding: 40px;
		color: var(--text-muted);
	}

	.empty .btn {
		margin-top: 20px;
	}

	@media (max-width: 768px) {
		.quiz-page {
			padding: 20px 16px;
		}

		h1 {
			font-size: 16px;
		}

		.question-card h2 {
			font-size: 20px;
		}

		.option {
			padding: 14px 16px;
			font-size: 14px;
		}

		.score-display {
			font-size: 48px;
		}

		.results h2 {
			font-size: 24px;
		}

		.score-text {
			font-size: 16px;
		}

		.results-actions {
			flex-direction: column;
			align-items: center;
		}
	}
</style>
