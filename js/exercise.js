'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

// ─── Distractor Selection ─────────────────────────────────────────────────────

function getWritingDistractors(verb, allVerbs, count) {
  const cluster = WRITING_CLUSTERS.find(c => c.includes(verb.inf));
  const inCluster = cluster
    ? allVerbs.filter(v => cluster.includes(v.inf) && v.inf !== verb.inf)
    : [];

  const pool = shuffle(inCluster);
  if (pool.length >= count) return pool.slice(0, count);

  // Supplement with random verbs not already picked
  const usedInfs = new Set([verb.inf, ...pool.map(v => v.inf)]);
  const extras = shuffle(allVerbs.filter(v => !usedInfs.has(v.inf)));
  return [...pool, ...extras].slice(0, count);
}

function getMeaningDistractors(verb, allVerbs, count) {
  const cluster = MEANING_CLUSTERS.find(c => c.includes(verb.inf));
  const inCluster = cluster
    ? allVerbs.filter(v => cluster.includes(v.inf) && v.inf !== verb.inf)
    : [];

  const pool = shuffle(inCluster);
  if (pool.length >= count) return pool.slice(0, count);

  const usedInfs = new Set([verb.inf, ...pool.map(v => v.inf)]);
  const extras = shuffle(allVerbs.filter(v => !usedInfs.has(v.inf)));
  return [...pool, ...extras].slice(0, count);
}

// ─── Question Generators ──────────────────────────────────────────────────────

function makeEnToDaQuestion(verb, allVerbs) {
  const distractors = getWritingDistractors(verb, allVerbs, 3);
  const options = shuffle([verb, ...distractors]);
  return {
    type: 'en-to-da',
    prompt: 'Which Danish verb matches?',
    question: verb.meaning,
    correctValue: verb.inf,
    danishVerb: verb.inf,
    options: options.map(v => ({ label: v.inf, value: v.inf })),
  };
}

function makeDaToEnQuestion(verb, allVerbs) {
  const distractors = getMeaningDistractors(verb, allVerbs, 3);
  const options = shuffle([verb, ...distractors]);
  return {
    type: 'da-to-en',
    prompt: 'What does this verb mean?',
    question: verb.inf,
    correctValue: verb.meaning,
    danishVerb: verb.inf,
    options: options.map(v => ({ label: v.meaning, value: v.meaning })),
  };
}

function makeGroupQuestion(verb) {
  // Fixed order — always -te / -ede / Irregular
  const options = [
    { label: '-te',       value: 'te' },
    { label: '-ede',      value: 'ede' },
    { label: 'Irregular', value: 'irregular' },
  ];
  return {
    type: 'group',
    prompt: 'What group does this verb belong to?',
    question: verb.inf,
    correctValue: verb.group,
    danishVerb: verb.inf,
    verbData: verb,
    options,
    hint: `Past: ${verb.past}`,
  };
}

// ─── Balanced Selection for Group Exercise ────────────────────────────────────

function balancedGroupVerbs(allVerbs, count) {
  const byGroup = {
    ede:       shuffle(allVerbs.filter(v => v.group === 'ede')),
    te:        shuffle(allVerbs.filter(v => v.group === 'te')),
    irregular: shuffle(allVerbs.filter(v => v.group === 'irregular')),
  };

  const perGroup = Math.floor(count / 3);
  const remainder = count % 3;

  // Distribute remainder to groups with most verbs first
  const selected = [
    ...byGroup.ede.slice(0, perGroup + (remainder >= 1 ? 1 : 0)),
    ...byGroup.te.slice(0, perGroup + (remainder >= 2 ? 1 : 0)),
    ...byGroup.irregular.slice(0, perGroup),
  ];

  return shuffle(selected).slice(0, count);
}

// ─── Main: Generate Exercise Session ─────────────────────────────────────────

function generateExercises(config) {
  const allVerbs = VERBS.slice(0, config.verbSet === 'top100' ? 100 : 100);
  const count = parseInt(config.count, 10) || 10;
  const type = config.exerciseType;

  let selectedVerbs;
  if (type === 'group') {
    selectedVerbs = balancedGroupVerbs(allVerbs, count);
  } else {
    selectedVerbs = pickRandom(allVerbs, count);
  }

  return selectedVerbs.map(verb => {
    if (type === 'en-to-da') return makeEnToDaQuestion(verb, allVerbs);
    if (type === 'da-to-en') return makeDaToEnQuestion(verb, allVerbs);
    return makeGroupQuestion(verb);
  });
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

let _ttsVerb = '';

function playTTS(text) {
  const speak = (text !== undefined && text !== '') ? text : _ttsVerb;
  if (!window.speechSynthesis || !speak) return;
  window.speechSynthesis.cancel();

  const btn = document.getElementById('tts-btn');
  const utter = new SpeechSynthesisUtterance(speak);
  utter.lang = 'da-DK';
  utter.rate = 0.85;

  utter.onstart = () => btn && btn.classList.add('playing');
  utter.onend   = () => btn && btn.classList.remove('playing');
  utter.onerror = () => btn && btn.classList.remove('playing');

  window.speechSynthesis.speak(utter);
}

function stopTTS() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  const btn = document.getElementById('tts-btn');
  if (btn) btn.classList.remove('playing');
}



let state = {
  exercises: [],
  index: 0,
  score: 0,
  answered: false,
  timerInterval: null,
  timeLeft: 0,
  totalTime: 0,
  audio: true,
};

function initExercise() {
  const raw = sessionStorage.getItem('verbConfig');
  if (!raw) { window.location.href = 'verbs-config.html'; return; }

  const config = JSON.parse(raw);
  state.exercises = generateExercises(config);
  state.index = 0;
  state.score = 0;
  state.totalTime = config.timeLimit ? parseInt(config.timeLimit, 10) : 0;
  state.audio = config.audio !== 'off';

  // Show/hide TTS button globally based on audio setting
  const ttsBtn = document.getElementById('tts-btn');
  const ttsLabel = document.getElementById('tts-verb-label');
  if (ttsBtn)   ttsBtn.style.display   = state.audio ? '' : 'none';
  if (ttsLabel) ttsLabel.style.display = state.audio ? '' : 'none';

  renderQuestion();
}

function renderQuestion() {
  const q = state.exercises[state.index];
  state.answered = false;

  // Progress
  const pct = (state.index / state.exercises.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent =
    `${state.index + 1} / ${state.exercises.length}`;

  // Prompt & question
  document.getElementById('question-prompt').textContent = q.prompt;
  document.getElementById('question-text').textContent = q.question;

  // Hint (unused element guard)
  const hintEl = document.getElementById('question-hint');
  if (hintEl) hintEl.style.display = 'none';

  // Answer buttons
  const grid = document.getElementById('answer-grid');
  grid.innerHTML = '';
  grid.className = 'answer-grid' + (q.options.length === 3 ? ' three-options' : '');

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt.label;
    btn.dataset.value = opt.value;
    btn.addEventListener('click', () => handleAnswer(opt.value, btn));
    grid.appendChild(btn);
  });

  // Timer
  clearInterval(state.timerInterval);
  const timerBar = document.getElementById('timer-bar');
  const timerFill = document.getElementById('timer-fill');

  if (state.totalTime > 0) {
    timerBar.style.display = 'block';
    state.timeLeft = state.totalTime;
    timerFill.style.width = '100%';
    timerFill.className = 'timer-fill';

    state.timerInterval = setInterval(() => {
      state.timeLeft -= 0.1;
      const pct = Math.max(0, (state.timeLeft / state.totalTime) * 100);
      timerFill.style.width = pct + '%';

      if (state.timeLeft <= state.totalTime * 0.33) timerFill.className = 'timer-fill danger';
      else if (state.timeLeft <= state.totalTime * 0.6) timerFill.className = 'timer-fill warning';

      if (state.timeLeft <= 0) {
        clearInterval(state.timerInterval);
        if (!state.answered) handleAnswer(null, null);
      }
    }, 100);
  } else {
    timerBar.style.display = 'none';
  }
}

function handleAnswer(selectedValue, clickedBtn) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timerInterval);

  const q = state.exercises[state.index];
  const isCorrect = selectedValue === q.correctValue;
  if (isCorrect) state.score++;

  // Highlight buttons
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === q.correctValue) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn) {
      btn.classList.add('wrong');
    }
  });

  // Show feedback after short delay
  setTimeout(() => showFeedback(isCorrect, q), 500);
}

function showFeedback(isCorrect, q) {
  _ttsVerb = q.danishVerb || '';

  const overlay       = document.getElementById('feedback-overlay');
  overlay.className   = 'feedback-overlay ' + (isCorrect ? 'success' : 'failure');

  document.getElementById('feedback-icon').textContent  = isCorrect ? '✓' : '✗';
  document.getElementById('feedback-title').textContent = isCorrect ? 'Correct!' : 'Incorrect';

  const correctEl     = document.getElementById('feedback-correct');
  const subtitleEl    = document.getElementById('feedback-subtitle');
  const conjContainer = document.getElementById('conj-table-container');
  const ttsBtn        = document.getElementById('tts-btn');
  const ttsLabel      = document.getElementById('tts-verb-label');

  if (q.type === 'group' && q.verbData) {
    // Show conjugation table; rows have their own TTS buttons
    subtitleEl.textContent = '';
    correctEl.textContent  = isCorrect ? '' : ('→ ' + (q.options.find(o => o.value === q.correctValue) || {}).label);
    if (ttsBtn)        ttsBtn.style.display        = 'none';
    if (ttsLabel)      ttsLabel.style.display      = 'none';
    if (conjContainer) {
      conjContainer.style.display = 'block';
      conjContainer.innerHTML     = buildConjTable(q.verbData);
    }
  } else {
    if (conjContainer) conjContainer.style.display = 'none';
    if (state.audio) {
      if (ttsBtn)   ttsBtn.style.display   = '';
      if (ttsLabel) ttsLabel.style.display = '';
    }
    if (isCorrect) {
      subtitleEl.textContent = '';
      correctEl.textContent  = '';
    } else {
      subtitleEl.textContent = 'The correct answer is:';
      const correct = q.options.find(o => o.value === q.correctValue);
      correctEl.textContent  = correct ? correct.label : q.correctValue;
    }
    if (ttsLabel) ttsLabel.textContent = _ttsVerb;
  }

  if (state.audio) playTTS();
}

function buildConjTable(v) {
  const rows = [
    { label: 'Infinitive', value: v.inf },
    { label: 'Present',    value: v.present },
    { label: 'Past',       value: v.past },
    { label: 'Perfect',    value: v.perfect },
    { label: 'Imperative', value: v.imp },
  ];
  return rows.map(r => {
    const speakable = r.value && r.value !== '—';
    const btn = speakable
      ? `<button class="tts-mini" onclick="event.stopPropagation();playTTS('${r.value.replace(/'/g, "\\'")}')">🔊</button>`
      : `<span class="tts-mini-gap"></span>`;
    return `<div class="conj-row"><span class="conj-label">${r.label}</span><span class="conj-value">${r.value}</span>${btn}</div>`;
  }).join('');
}

function nextQuestion() {
  const overlay = document.getElementById('feedback-overlay');
  if (overlay.classList.contains('hidden')) return;
  stopTTS();
  overlay.className = 'feedback-overlay hidden';

  state.index++;
  if (state.index >= state.exercises.length) {
    showSummary();
  } else {
    renderQuestion();
  }
}

function showSummary() {
  document.getElementById('exercise-view').style.display = 'none';
  document.getElementById('feedback-overlay').className = 'feedback-overlay hidden';

  const summary = document.getElementById('summary-view');
  summary.style.display = 'flex';

  const total = state.exercises.length;
  const pct = Math.round((state.score / total) * 100);

  document.getElementById('score-number').textContent = state.score;
  document.getElementById('score-total').textContent = '/ ' + total;
  document.getElementById('score-pct').textContent = pct + '%';

  let msg = '';
  if (pct === 100) msg = '🏆 Perfect score!';
  else if (pct >= 80) msg = '🎉 Great job!';
  else if (pct >= 60) msg = '👍 Good effort!';
  else if (pct >= 40) msg = '📚 Keep practicing!';
  else msg = '💪 Don\'t give up!';

  document.getElementById('summary-msg').textContent = msg;
}
