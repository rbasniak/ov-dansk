'use strict';

/* ── State ───────────────────────────────────────────────────── */
var _ns = {
  exercises:    [],
  index:        0,
  score:        0,
  answered:     false,
  timerInterval: null,
  timeLeft:     0,
  totalTime:    0,
  audio:        true,
  exerciseType: 'audio-to-num',
  currentTTS:   '',
};

/* ── TTS ─────────────────────────────────────────────────────── */
function _nPlayTTS(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const ttsBtn  = document.getElementById('tts-btn');
  const qBtn    = document.getElementById('audio-play-btn');

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang  = 'da-DK';
  utter.rate  = 0.85;

  const setPlaying = v => {
    if (ttsBtn) ttsBtn.classList.toggle('playing', v);
    if (qBtn)   qBtn.classList.toggle('playing', v);
  };
  utter.onstart = () => setPlaying(true);
  utter.onend   = () => setPlaying(false);
  utter.onerror = () => setPlaying(false);
  window.speechSynthesis.speak(utter);
}

function _nStopTTS() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  ['tts-btn', 'audio-play-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('playing');
  });
}

// Called by the question-area play button
function playQuestionAudio() {
  _nPlayTTS(_ns.currentTTS);
}

// Called by the feedback-overlay TTS button
function playFeedbackTTS() {
  const q = _ns.exercises[_ns.index];
  if (q) _nPlayTTS(q.ttsText);
}

/* ── Exercise Generation ─────────────────────────────────────── */
function _makeQuestion(n, type) {
  const distractors = getNumberDistractors(n);
  const allNums     = [n, ...distractors];

  if (type === 'audio-to-num') {
    // Hear Danish audio → pick correct numeral
    const options = _numShuffle(allNums.map(x => ({ label: String(x), value: String(x) })));
    return { type, number: n, ttsText: danishNumberTTS(n), correctValue: String(n), options };
  } else {
    // See numeral → pick correct written Danish form
    const options = _numShuffle(allNums.map(x => ({ label: danishNumber(x), value: danishNumber(x) })));
    return { type, number: n, ttsText: danishNumberTTS(n), correctValue: danishNumber(n), options };
  }
}

function _generateExercises(config) {
  const count = parseInt(config.count, 10) || 10;
  const type  = config.exerciseType || 'audio-to-num';
  const pool  = generateNumberPool(count);
  return pool.map(n => _makeQuestion(n, type));
}

/* ── Init ────────────────────────────────────────────────────── */
function initNumbersExercise() {
  const raw = sessionStorage.getItem('numberConfig');
  if (!raw) { window.location.href = 'numbers-config.html'; return; }
  const config = JSON.parse(raw);

  _ns.exercises    = _generateExercises(config);
  _ns.index        = 0;
  _ns.score        = 0;
  _ns.answered     = false;
  _ns.totalTime    = config.timeLimit ? parseInt(config.timeLimit, 10) : 0;
  _ns.audio        = config.audio !== 'off';
  _ns.exerciseType = config.exerciseType || 'audio-to-num';

  _nRenderQuestion();
}

/* ── Render Question ─────────────────────────────────────────── */
function _nRenderQuestion() {
  const q = _ns.exercises[_ns.index];
  _ns.answered = false;
  _nStopTTS();

  // Progress bar
  const pct = (_ns.index / _ns.exercises.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${_ns.index + 1} / ${_ns.exercises.length}`;

  // Show appropriate question area
  const audioArea   = document.getElementById('audio-question-area');
  const digitArea   = document.getElementById('digit-question-area');
  const digitDisplay = document.getElementById('digit-display');
  const promptEl    = document.getElementById('question-prompt');

  if (q.type === 'audio-to-num') {
    promptEl.textContent      = '🔊 What number do you hear?';
    audioArea.style.display   = 'flex';
    digitArea.style.display   = 'none';
    _ns.currentTTS = q.ttsText;
    // Always autoplay for audio-to-num — the exercise requires hearing the number
    const hintEl = document.getElementById('audio-tap-hint');
    if (hintEl) hintEl.textContent = 'Tap to hear again';
    setTimeout(() => _nPlayTTS(_ns.currentTTS), 350);
  } else {
    promptEl.textContent      = 'How is this number written in Danish?';
    audioArea.style.display   = 'none';
    digitArea.style.display   = 'block';
    digitDisplay.textContent  = q.number;
  }

  // Answer buttons
  const grid = document.getElementById('answer-grid');
  grid.innerHTML = '';
  grid.className = 'answer-grid' +
    (q.type === 'audio-to-num' ? ' num-options' : ' written-options');

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className       = 'answer-btn';
    btn.textContent     = opt.label;
    btn.dataset.value   = opt.value;
    btn.addEventListener('click', () => _nHandleAnswer(opt.value, btn));
    grid.appendChild(btn);
  });

  // Timer
  clearInterval(_ns.timerInterval);
  const timerBar  = document.getElementById('timer-bar');
  const timerFill = document.getElementById('timer-fill');

  if (_ns.totalTime > 0) {
    timerBar.style.display = 'block';
    _ns.timeLeft           = _ns.totalTime;
    timerFill.style.width  = '100%';
    timerFill.className    = 'timer-fill';

    _ns.timerInterval = setInterval(() => {
      _ns.timeLeft -= 0.1;
      const p = Math.max(0, (_ns.timeLeft / _ns.totalTime) * 100);
      timerFill.style.width = p + '%';
      if      (_ns.timeLeft <= _ns.totalTime * 0.33) timerFill.className = 'timer-fill danger';
      else if (_ns.timeLeft <= _ns.totalTime * 0.60) timerFill.className = 'timer-fill warning';
      if (_ns.timeLeft <= 0) {
        clearInterval(_ns.timerInterval);
        if (!_ns.answered) _nHandleAnswer(null, null);
      }
    }, 100);
  } else {
    timerBar.style.display = 'none';
  }
}

/* ── Answer Handling ─────────────────────────────────────────── */
function _nHandleAnswer(selectedValue, clickedBtn) {
  if (_ns.answered) return;
  _ns.answered = true;
  clearInterval(_ns.timerInterval);

  const q         = _ns.exercises[_ns.index];
  const isCorrect = selectedValue === q.correctValue;
  if (isCorrect) _ns.score++;

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === q.correctValue) btn.classList.add('correct');
    else if (btn === clickedBtn)              btn.classList.add('wrong');
  });

  setTimeout(() => _nShowFeedback(isCorrect, q), 500);
}

/* ── Feedback ────────────────────────────────────────────────── */
function _nShowFeedback(isCorrect, q) {
  _nStopTTS();
  const overlay = document.getElementById('feedback-overlay');
  overlay.className = 'feedback-overlay ' + (isCorrect ? 'success' : 'failure');

  document.getElementById('feedback-icon').textContent  = isCorrect ? '✓' : '✗';
  document.getElementById('feedback-title').textContent = isCorrect ? 'Correct!' : 'Incorrect';

  // Always show numeral + Danish text
  document.getElementById('feedback-number').textContent = q.number;
  document.getElementById('feedback-danish').textContent = danishNumber(q.number);

  // Subtitle (only on wrong answer)
  document.getElementById('feedback-subtitle').textContent = isCorrect ? '' : 'The correct answer was:';

  // TTS button visibility
  const ttsBtn = document.getElementById('tts-btn');
  if (ttsBtn) ttsBtn.style.display = _ns.audio ? '' : 'none';

  if (_ns.audio) _nPlayTTS(q.ttsText);
}

/* ── Navigation ──────────────────────────────────────────────── */
function nextQuestion() {
  const overlay = document.getElementById('feedback-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  _nStopTTS();
  overlay.className = 'feedback-overlay hidden';
  _ns.index++;
  if (_ns.index >= _ns.exercises.length) {
    _nShowSummary();
  } else {
    _nRenderQuestion();
  }
}

function _nShowSummary() {
  document.getElementById('exercise-view').style.display  = 'none';
  document.getElementById('feedback-overlay').className   = 'feedback-overlay hidden';
  const summary = document.getElementById('summary-view');
  summary.style.display = 'flex';

  const total = _ns.exercises.length;
  const pct   = Math.round((_ns.score / total) * 100);
  document.getElementById('score-number').textContent = _ns.score;
  document.getElementById('score-total').textContent  = '/ ' + total;
  document.getElementById('score-pct').textContent    = pct + '%';

  let msg;
  if      (pct === 100) msg = '🏆 Perfect score!';
  else if (pct >= 80)   msg = '🎉 Great job!';
  else if (pct >= 60)   msg = '👍 Good effort!';
  else if (pct >= 40)   msg = '📚 Keep practicing!';
  else                  msg = '💪 Don\'t give up!';
  document.getElementById('summary-msg').textContent = msg;
}
