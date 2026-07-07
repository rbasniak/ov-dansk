'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────

function _nShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _nPickRandom(arr, n) {
  return _nShuffle(arr).slice(0, n);
}

// ─── Distractor Selection ─────────────────────────────────────────────────────

function _nGetDistractors(noun, pool, count) {
  // Prefer same-category distractors to make the exercise more challenging
  const sameCategory = pool.filter(n => n.category === noun.category && n.id !== noun.id);
  const shuffled = _nShuffle(sameCategory);
  if (shuffled.length >= count) return shuffled.slice(0, count);

  const used = new Set([noun.id, ...shuffled.map(n => n.id)]);
  const extras = _nShuffle(pool.filter(n => !used.has(n.id)));
  return [...shuffled, ...extras].slice(0, count);
}

// ─── Question Generators ──────────────────────────────────────────────────────

function _nMakeEnToDaQuestion(noun, pool) {
  const distractors = _nGetDistractors(noun, pool, 3);
  const options = _nShuffle([noun, ...distractors]);
  return {
    type: 'en-to-da',
    itemId: noun.da + '_en-to-da',
    prompt: 'Which Danish noun matches?',
    question: noun.meaning,
    correctValue: noun.da,
    danishWord: noun.da,
    nounData: noun,
    options: options.map(n => ({ label: n.da, value: n.da })),
  };
}

function _nMakeDaToEnQuestion(noun, pool) {
  const distractors = _nGetDistractors(noun, pool, 3);
  const options = _nShuffle([noun, ...distractors]);
  return {
    type: 'da-to-en',
    itemId: noun.da + '_da-to-en',
    prompt: 'What does this noun mean?',
    question: noun.da,
    correctValue: noun.meaning,
    danishWord: noun.da,
    nounData: noun,
    options: options.map(n => ({ label: n.meaning, value: n.meaning })),
  };
}

function _nMakeGenderQuestion(noun) {
  // Fixed order: en / et — always two options
  const options = [
    { label: 'en', value: 'en' },
    { label: 'et', value: 'et' },
  ];
  return {
    type: 'gender',
    itemId: noun.da + '_gender',
    prompt: 'What is the gender of this noun?',
    question: noun.da,
    correctValue: noun.gender,
    danishWord: noun.da,
    nounData: noun,
    options,
  };
}

function _nMakePluralClassQuestion(noun) {
  const options = [
    { label: 'Class 1 (-er)',      value: 'er'        },
    { label: 'Class 2 (-e)',       value: 'e'         },
    { label: 'Class 3 (unchanged)', value: 'zero'     },
    { label: 'Vowel change',       value: 'umlaut'    },
    { label: 'Irregular',          value: 'irregular' },
  ];
  return {
    type: 'plural-class',
    itemId: noun.da + '_plural-class',
    prompt: 'What plural class does this noun belong to?',
    question: noun.da,
    correctValue: noun.pluralClass,
    danishWord: noun.da,
    nounData: noun,
    options,
  };
}

// ─── Balanced Selection ───────────────────────────────────────────────────────

function _nBalancedGenderNouns(pool, count) {
  // Aim for ~60% et, ~40% en
  const etNouns = _nShuffle(pool.filter(n => n.gender === 'et'));
  const enNouns = _nShuffle(pool.filter(n => n.gender === 'en'));

  const etCount = Math.min(Math.round(count * 0.6), etNouns.length);
  const enCount = Math.min(count - etCount, enNouns.length);

  return _nShuffle([...etNouns.slice(0, etCount), ...enNouns.slice(0, enCount)]).slice(0, count);
}

function _nBalancedPluralNouns(pool, count) {
  // Only nouns with a defined plural class
  const eligible = pool.filter(n => n.pluralClass !== null);

  const byClass = {
    er:        _nShuffle(eligible.filter(n => n.pluralClass === 'er')),
    e:         _nShuffle(eligible.filter(n => n.pluralClass === 'e')),
    zero:      _nShuffle(eligible.filter(n => n.pluralClass === 'zero')),
    umlaut:    _nShuffle(eligible.filter(n => n.pluralClass === 'umlaut')),
    irregular: _nShuffle(eligible.filter(n => n.pluralClass === 'irregular')),
  };

  // 30% er, 30% e, 40% split across zero/umlaut/irregular
  const erCount  = Math.round(count * 0.3);
  const eCount   = Math.round(count * 0.3);
  const rem      = count - erCount - eCount;
  const perRem   = Math.floor(rem / 3);
  const remExtra = rem % 3;

  const selected = [
    ...byClass.er.slice(0, erCount),
    ...byClass.e.slice(0, eCount),
    ...byClass.zero.slice(0,      perRem + (remExtra >= 1 ? 1 : 0)),
    ...byClass.umlaut.slice(0,    perRem + (remExtra >= 2 ? 1 : 0)),
    ...byClass.irregular.slice(0, perRem),
  ];

  return _nShuffle(selected).slice(0, count);
}

// ─── Category Pool ────────────────────────────────────────────────────────────

function _nGetSelectedCategories(config) {
  if (Array.isArray(config.categories) && config.categories.length > 0) {
    return config.categories;
  }
  if (config.category) {
    return [config.category];
  }
  return NOUN_CATEGORIES.map(c => c.id);
}

function _nFilterPool(config) {
  const selected = new Set(_nGetSelectedCategories(config));
  return NOUNS.filter(n => selected.has(n.category));
}

// ─── Generate Exercise Session ────────────────────────────────────────────────

const _NOUN_PRONUNCIATION_FORMS = [
  { key: 'da',         name: 'Indefinite'    },
  { key: 'definiteSg', name: 'Definite'      },
  { key: 'plural',     name: 'Plural'        },
  { key: 'definitePl', name: 'Definite pl.'  },
];

// Expands nouns into individual pronunciation items — one per form that exists.
// Mass nouns (null plural/definitePl) produce only 2 items instead of 4.
function _nBuildPronunciationItems(nouns) {
  const items = [];
  for (const noun of nouns) {
    for (const f of _NOUN_PRONUNCIATION_FORMS) {
      const form = noun[f.key];
      if (!form) continue;
      items.push({ id: `${noun.da}_pronunciation_${f.key}`, form, formName: f.name, noun });
    }
  }
  return items;
}

function _nGenerateExercises(config, overridePool) {
  const pool  = overridePool || _nFilterPool(config);
  const type  = config.exerciseType;
  const count = config.count === 'all' ? pool.length : (parseInt(config.count, 10) || 10);

  if (type === 'pronunciation') {
    const items = _nBuildPronunciationItems(pool);
    const n     = config.count === 'all' ? items.length : (parseInt(config.count, 10) || 10);
    return _nShuffle(items).slice(0, n).map(item => ({
      type:         'pronunciation',
      itemId:       item.id,
      prompt:       item.formName,
      question:     item.form,
      danishWord:   item.form,
      nounData:     item.noun,
      correctValue: 'correct',
      options: [
        { label: '✓  Got it right',        value: 'correct' },
        { label: '✗  Needs more practice', value: 'wrong'   },
      ],
    }));
  }

  let selected;
  if (type === 'gender') {
    selected = _nBalancedGenderNouns(pool, count);
  } else if (type === 'plural-class') {
    selected = _nBalancedPluralNouns(pool, count);
  } else {
    selected = _nPickRandom(pool, count);
  }

  return selected.map(noun => {
    if (type === 'en-to-da')    return _nMakeEnToDaQuestion(noun, pool);
    if (type === 'da-to-en')    return _nMakeDaToEnQuestion(noun, pool);
    if (type === 'gender')      return _nMakeGenderQuestion(noun);
    return _nMakePluralClassQuestion(noun);
  });
}

// ─── Noun Info Card ───────────────────────────────────────────────────────────

function _nBuildInfoCard(noun) {
  const hasForms = noun.pluralClass !== null;

  const rows = [
    { label: 'Translation', value: noun.meaning,                        speakText: null              },
    { label: 'Indefinite',  value: `${noun.gender}\u00a0${noun.da}`,   speakText: noun.da            },
    { label: 'Definite',    value: noun.definiteSg,                     speakText: noun.definiteSg    },
  ];

  if (hasForms) {
    rows.push({ label: 'Plural',          value: noun.plural,                 speakText: noun.plural         });
    rows.push({ label: 'Definite plural', value: `to\u00a0${noun.definitePl}`, speakText: noun.definitePl   });
  }

  return rows.map(r => {
    const btn = r.speakText
      ? `<button class="tts-mini" onclick="event.stopPropagation();_nPlayTTS('${r.speakText.replace(/'/g, "\\'")}')">🔊</button>`
      : `<span class="tts-mini-gap"></span>`;
    return `<div class="conj-row"><span class="conj-label">${r.label}</span><span class="conj-value">${r.value}</span>${btn}</div>`;
  }).join('');
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

let _nCurrentWord = '';

function _nPlayTTS(text) {
  const speak = (text !== undefined && text !== '') ? text : _nCurrentWord;
  if (!window.speechSynthesis || !speak) return;
  window.speechSynthesis.cancel();

  const btn   = document.getElementById('tts-btn');
  const utter = new SpeechSynthesisUtterance(speak);
  utter.lang  = 'da-DK';
  utter.rate  = 0.85;

  utter.onstart = () => btn && btn.classList.add('playing');
  utter.onend   = () => btn && btn.classList.remove('playing');
  utter.onerror = () => btn && btn.classList.remove('playing');

  window.speechSynthesis.speak(utter);
}

// Exposed as global so the feedback overlay's TTS button can call it
function playTTS(text) { _nPlayTTS(text); }

function _nStopTTS() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  const btn = document.getElementById('tts-btn');
  if (btn) btn.classList.remove('playing');
}

// ─── State ────────────────────────────────────────────────────────────────────

let _nState = {
  exercises:     [],
  index:         0,
  score:         0,
  dontKnowCount: 0,
  answered:      false,
  timerInterval: null,
  timeLeft:      0,
  totalTime:     0,
  audio:         true,
  practiceMode:  null,
  subject:       'nouns',
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initNounsExercise() {
  const raw = sessionStorage.getItem('nounConfig');
  if (!raw) { window.location.href = 'nouns-config.html'; return; }

  const config           = JSON.parse(raw);
  _nState.index          = 0;
  _nState.score          = 0;
  _nState.dontKnowCount  = 0;
  _nState.totalTime      = config.timeLimit ? parseInt(config.timeLimit, 10) : 0;
  _nState.audio          = config.audio !== 'off';
  _nState.practiceMode   = config.practiceMode || null;

  const useAdaptive = config.practiceMode &&
                      typeof isLoggedIn === 'function' && isLoggedIn();

  if (config.exerciseType === 'pronunciation') {
    const allItems = _nBuildPronunciationItems(_nFilterPool(config));
    if (useAdaptive) {
      const count       = config.count === 'all' ? Infinity : (parseInt(config.count, 10) || 10);
      const progressMap = await loadProgress('nouns');
      const selected    = selectAdaptiveItems(allItems, progressMap, config.practiceMode, count);
      if (selected.length === 0) { _nShowEmptyState(config.practiceMode); return; }
      _nState.exercises = selected.map(item => ({
        type:         'pronunciation',
        itemId:       item.id,
        prompt:       item.formName,
        question:     item.form,
        danishWord:   item.form,
        nounData:     item.noun,
        correctValue: 'correct',
        options: [
          { label: '✓  Got it right',        value: 'correct' },
          { label: '✗  Needs more practice', value: 'wrong'   },
        ],
      }));
    } else {
      const count = config.count === 'all' ? allItems.length : (parseInt(config.count, 10) || 10);
      _nState.exercises = _nShuffle(allItems).slice(0, count).map(item => ({
        type:         'pronunciation',
        itemId:       item.id,
        prompt:       item.formName,
        question:     item.form,
        danishWord:   item.form,
        nounData:     item.noun,
        correctValue: 'correct',
        options: [
          { label: '✓  Got it right',        value: 'correct' },
          { label: '✗  Needs more practice', value: 'wrong'   },
        ],
      }));
    }
  } else if (useAdaptive) {
    const pool        = _nFilterPool(config);
    const count       = config.count === 'all' ? Infinity : (parseInt(config.count, 10) || 10);
    const progressMap = await loadProgress('nouns');
    const selected    = selectAdaptiveItems(pool, progressMap, config.practiceMode, count);
    if (selected.length === 0) { _nShowEmptyState(config.practiceMode); return; }
    _nState.exercises = _nGenerateExercises(config, selected);
  } else {
    _nState.exercises = _nGenerateExercises(config);
  }

  const ttsBtn   = document.getElementById('tts-btn');
  const ttsLabel = document.getElementById('tts-noun-label');
  if (ttsBtn)   ttsBtn.style.display   = _nState.audio ? '' : 'none';
  if (ttsLabel) ttsLabel.style.display = _nState.audio ? '' : 'none';

  _nRenderQuestion();
}

// ─── Render Question ──────────────────────────────────────────────────────────

function _nRenderQuestion() {
  const q = _nState.exercises[_nState.index];
  _nState.answered = false;

  // Progress
  const pct = (_nState.index / _nState.exercises.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent =
    `${_nState.index + 1} / ${_nState.exercises.length}`;

  // Question
  document.getElementById('question-prompt').textContent = q.prompt;
  document.getElementById('question-text').textContent   = q.question;

  // Don't Know button — logged-in only, not for pronunciation
  const dkContainer = document.getElementById('dont-know-container');
  if (dkContainer) {
    dkContainer.style.display =
      (q.type !== 'pronunciation' && typeof isLoggedIn === 'function' && isLoggedIn()) ? '' : 'none';
  }

  // Answer buttons
  const grid = document.getElementById('answer-grid');
  grid.innerHTML = '';

  if (q.type === 'pronunciation') {
    grid.className = 'answer-grid';
    const playBtn = document.createElement('button');
    playBtn.className = 'answer-btn pronunciation-play-btn';
    playBtn.innerHTML = '🔊 &nbsp;Tap to hear, then judge yourself';
    playBtn.addEventListener('click', () => {
      _nPlayTTS(q.danishWord);
      grid.innerHTML = '';
      grid.className = 'answer-grid three-options';
      q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt.label;
        btn.dataset.value = opt.value;
        btn.addEventListener('click', () => _nHandleAnswer(opt.value, btn));
        grid.appendChild(btn);
      });
    });
    grid.appendChild(playBtn);
  } else {
    grid.className = 'answer-grid'
      + (q.options.length === 2 ? ' two-options'  : '')
      + (q.options.length === 3 ? ' three-options' : '')
      + (q.options.length === 5 ? ' five-options'  : '');

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;
      btn.addEventListener('click', () => _nHandleAnswer(opt.value, btn));
      grid.appendChild(btn);
    });
  }

  // Timer
  clearInterval(_nState.timerInterval);
  const timerBar  = document.getElementById('timer-bar');
  const timerFill = document.getElementById('timer-fill');

  if (_nState.totalTime > 0) {
    timerBar.style.display = 'block';
    _nState.timeLeft       = _nState.totalTime;
    timerFill.style.width  = '100%';
    timerFill.className    = 'timer-fill';

    _nState.timerInterval = setInterval(() => {
      _nState.timeLeft -= 0.1;
      const pct = Math.max(0, (_nState.timeLeft / _nState.totalTime) * 100);
      timerFill.style.width = pct + '%';

      if (_nState.timeLeft <= _nState.totalTime * 0.33) timerFill.className = 'timer-fill danger';
      else if (_nState.timeLeft <= _nState.totalTime * 0.6) timerFill.className = 'timer-fill warning';

      if (_nState.timeLeft <= 0) {
        clearInterval(_nState.timerInterval);
        if (!_nState.answered) _nHandleAnswer(null, null);
      }
    }, 100);
  } else {
    timerBar.style.display = 'none';
  }
}

// ─── Handle Answer ────────────────────────────────────────────────────────────

function _nHandleAnswer(selectedValue, clickedBtn) {
  if (_nState.answered) return;
  _nState.answered = true;
  clearInterval(_nState.timerInterval);

  const q         = _nState.exercises[_nState.index];
  const isTimeout = selectedValue === null && clickedBtn === null;
  const isCorrect = !isTimeout && selectedValue === q.correctValue;
  if (isCorrect) _nState.score++;

  // Record to Firestore
  if (typeof recordAnswer === 'function' && typeof isLoggedIn === 'function' &&
      isLoggedIn() && q.itemId) {
    const resultType = isTimeout ? 'timeout' : (isCorrect ? 'correct' : 'wrong');
    recordAnswer(_nState.subject, q.itemId, resultType).catch(console.error);
  }

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === q.correctValue) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn) {
      btn.classList.add('wrong');
    }
  });

  setTimeout(() => _nShowFeedback(isCorrect, q), 500);
}

function _nHandleDontKnow() {
  if (_nState.answered) return;
  _nState.answered = true;
  clearInterval(_nState.timerInterval);
  _nState.dontKnowCount++;

  const q = _nState.exercises[_nState.index];
  document.querySelectorAll('.answer-btn').forEach(btn => { btn.disabled = true; });

  if (typeof recordAnswer === 'function' && typeof isLoggedIn === 'function' &&
      isLoggedIn() && q.itemId) {
    recordAnswer(_nState.subject, q.itemId, 'dont_know').catch(console.error);
  }

  setTimeout(() => _nShowFeedback(false, q, true), 300);
}

// ─── Show Feedback ────────────────────────────────────────────────────────────

function _nShowFeedback(isCorrect, q, isDontKnow = false) {
  _nCurrentWord = q.danishWord || '';

  const overlay     = document.getElementById('feedback-overlay');
  overlay.className = 'feedback-overlay ' + (isCorrect ? 'success' : 'failure');

  document.getElementById('feedback-icon').textContent = isCorrect ? '✓' : (isDontKnow ? '🤔' : '✗');

  if (q.type === 'pronunciation') {
    document.getElementById('feedback-title').textContent = isCorrect ? 'Great work!' : 'Keep practicing!';
  } else {
    document.getElementById('feedback-title').textContent = isCorrect ? 'Correct!' : (isDontKnow ? "Let's learn!" : 'Incorrect');
  }

  const subtitleEl    = document.getElementById('feedback-subtitle');
  const correctEl     = document.getElementById('feedback-correct');
  const infoContainer = document.getElementById('noun-info-container');
  const ttsBtn        = document.getElementById('tts-btn');
  const ttsLabel      = document.getElementById('tts-noun-label');

  // Always show the noun info card (all 4 forms + TTS per row — great for pronunciation too)
  infoContainer.style.display = 'block';
  infoContainer.innerHTML     = _nBuildInfoCard(q.nounData);

  if (q.type === 'pronunciation') {
    subtitleEl.textContent = isCorrect ? '' : 'Listen again and study the forms:';
    correctEl.textContent  = '';
  } else if (isCorrect) {
    subtitleEl.textContent = '';
    correctEl.textContent  = '';
  } else {
    subtitleEl.textContent = 'The correct answer is:';
    const correct = q.options.find(o => o.value === q.correctValue);
    correctEl.textContent  = correct ? correct.label : q.correctValue;
  }

  if (_nState.audio) {
    if (ttsBtn)   ttsBtn.style.display   = '';
    if (ttsLabel) ttsLabel.style.display = '';
  }
  if (ttsLabel) ttsLabel.textContent = _nCurrentWord;

  if (_nState.audio) _nPlayTTS();
}

// ─── Next Question ────────────────────────────────────────────────────────────

function nextQuestion() {
  const overlay = document.getElementById('feedback-overlay');
  if (overlay.classList.contains('hidden')) return;
  _nStopTTS();
  overlay.className = 'feedback-overlay hidden';

  _nState.index++;
  if (_nState.index >= _nState.exercises.length) {
    _nShowSummary();
  } else {
    _nRenderQuestion();
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function _nShowSummary() {
  document.getElementById('exercise-view').style.display  = 'none';
  document.getElementById('feedback-overlay').className   = 'feedback-overlay hidden';

  const summary = document.getElementById('summary-view');
  summary.style.display = 'flex';

  const total      = _nState.exercises.length;
  const wrongCount = total - _nState.score - _nState.dontKnowCount;
  const pct        = Math.round((_nState.score / total) * 100);

  document.getElementById('score-number').textContent = _nState.score;
  document.getElementById('score-total').textContent  = '/ ' + total;
  document.getElementById('score-pct').textContent    = pct + '%';

  let msg = '';
  if (pct === 100)    msg = '🏆 Perfect score!';
  else if (pct >= 80) msg = '🎉 Great job!';
  else if (pct >= 60) msg = '👍 Good effort!';
  else if (pct >= 40) msg = '📚 Keep practicing!';
  else                msg = '💪 Don\'t give up!';

  document.getElementById('summary-msg').textContent = msg;

  // Session breakdown — logged-in users only
  const breakdown = document.getElementById('session-breakdown');
  if (breakdown && typeof isLoggedIn === 'function' && isLoggedIn()) {
    breakdown.style.display = '';
    const dkHtml = _nState.dontKnowCount > 0
      ? `<span class="breakdown-item dk-item">🤔 ${_nState.dontKnowCount} don't know</span>`
      : '';
    breakdown.innerHTML = `
      <div class="breakdown-row">
        <span class="breakdown-item correct-item">✓ ${_nState.score} correct</span>
        <span class="breakdown-item wrong-item">✗ ${wrongCount} wrong</span>
        ${dkHtml}
      </div>
      <p class="breakdown-note">Progress saved ✓</p>
    `;
  } else if (breakdown) {
    breakdown.style.display = 'none';
  }
}

function _nShowEmptyState(mode) {
  document.getElementById('exercise-view').style.display = 'none';

  const emptyView = document.getElementById('empty-state-view');
  emptyView.style.display = 'flex';

  if (mode === 'review') {
    document.getElementById('empty-icon').textContent = '🎉';
    document.getElementById('empty-msg').textContent  =
      'Nothing to review right now! Come back later or switch to Learn mode.';
  } else {
    document.getElementById('empty-icon').textContent = '🌱';
    document.getElementById('empty-msg').textContent  =
      'No new items left in this set. Switch to Review or Mixed mode.';
  }
}
