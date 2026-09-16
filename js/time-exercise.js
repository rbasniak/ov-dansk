'use strict';

var _ts = {
  exercises:     [],
  index:         0,
  score:         0,
  answered:      false,
  timerInterval: null,
  timeLeft:      0,
  totalTime:     0,
  audio:         true,
  currentTTS:    '',
};

function _tPlayTTS(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const ttsBtn = document.getElementById('tts-btn');
  const qBtn = document.getElementById('audio-play-btn');

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'da-DK';
  utter.rate = 0.85;

  const setPlaying = v => {
    if (ttsBtn) ttsBtn.classList.toggle('playing', v);
    if (qBtn) qBtn.classList.toggle('playing', v);
  };
  utter.onstart = () => setPlaying(true);
  utter.onend = () => setPlaying(false);
  utter.onerror = () => setPlaying(false);
  window.speechSynthesis.speak(utter);
}

function _tStopTTS() {
  window.speechSynthesis && window.speechSynthesis.cancel();
  ['tts-btn', 'audio-play-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('playing');
  });
}

function playQuestionAudio() {
  _tPlayTTS(_ts.currentTTS);
}

function playFeedbackTTS() {
  const q = _ts.exercises[_ts.index];
  if (q) _tPlayTTS(q.ttsText);
}

function _makeTQuestion(item) {
  const useDenEr = Math.random() < 0.3;
  const useLidt  = Math.random() < 0.5;   // for digital near-hour minutes: "lidt over/i" vs exact digits
  const isAnalog = item.type === 'analog';
  const correctValue = `${item.h}:${item.m}`;
  const correctHTML = isAnalog ? clockSVG(item.h, item.m) : digitalDisplayHTML(item.h, item.m);
  const distractors = isAnalog ? getAnalogDistractors(item.h, item.m) : getDigitalDistractors(item.h, item.m);
  const options = _timeShuffle([
    { value: correctValue, html: correctHTML },
    ...distractors.map(opt => ({
      value: `${opt.h}:${opt.m}`,
      html: isAnalog ? clockSVG(opt.h, opt.m) : digitalDisplayHTML(opt.h, opt.m)
    }))
  ]);

  return {
    type: item.type,
    h: item.h,
    m: item.m,
    useDenEr,
    ttsText: isAnalog
      ? analogTTS(item.h, item.m, useDenEr)
      : digitalTTS(item.h, item.m, useDenEr, useLidt),
    correctValue,
    correctHTML,
    options
  };
}

function _generateTExercises(config) {
  const count = parseInt(config.count, 10) || 10;
  return generateTimePool(count).map(_makeTQuestion);
}

function initTimeExercise() {
  const raw = sessionStorage.getItem('timeConfig');
  if (!raw) { window.location.href = 'time-config.html'; return; }
  const config = JSON.parse(raw);

  _ts.exercises = _generateTExercises(config);
  _ts.index = 0;
  _ts.score = 0;
  _ts.answered = false;
  _ts.totalTime = config.timeLimit ? parseInt(config.timeLimit, 10) : 0;
  _ts.audio = config.audio !== 'off';

  _tRenderQuestion();
}

function _tRenderQuestion() {
  const q = _ts.exercises[_ts.index];
  _ts.answered = false;
  _tStopTTS();

  const pct = (_ts.index / _ts.exercises.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${_ts.index + 1} / ${_ts.exercises.length}`;

  const promptEl = document.getElementById('question-prompt');
  const audioArea = document.getElementById('audio-question-area');
  const hintEl = document.getElementById('audio-tap-hint');
  promptEl.textContent = '🔊 What time do you hear?';
  audioArea.style.display = 'flex';
  if (hintEl) hintEl.textContent = 'Tap to hear again';
  _ts.currentTTS = q.ttsText;
  setTimeout(() => _tPlayTTS(_ts.currentTTS), 350);

  const grid = document.getElementById('answer-grid');
  grid.innerHTML = '';
  grid.className = 'answer-grid ' + (q.type === 'analog' ? 'clock-options' : 'digital-options');

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.innerHTML = opt.html;
    btn.dataset.value = opt.value;
    btn.addEventListener('click', () => _tHandleAnswer(opt.value, btn));
    grid.appendChild(btn);
  });

  clearInterval(_ts.timerInterval);
  const timerBar = document.getElementById('timer-bar');
  const timerFill = document.getElementById('timer-fill');

  if (_ts.totalTime > 0) {
    timerBar.style.display = 'block';
    _ts.timeLeft = _ts.totalTime;
    timerFill.style.width = '100%';
    timerFill.className = 'timer-fill';

    _ts.timerInterval = setInterval(() => {
      _ts.timeLeft -= 0.1;
      const p = Math.max(0, (_ts.timeLeft / _ts.totalTime) * 100);
      timerFill.style.width = p + '%';
      if (_ts.timeLeft <= _ts.totalTime * 0.33) timerFill.className = 'timer-fill danger';
      else if (_ts.timeLeft <= _ts.totalTime * 0.60) timerFill.className = 'timer-fill warning';
      if (_ts.timeLeft <= 0) {
        clearInterval(_ts.timerInterval);
        if (!_ts.answered) _tHandleAnswer(null, null);
      }
    }, 100);
  } else {
    timerBar.style.display = 'none';
  }
}

function _tHandleAnswer(selectedValue, clickedBtn) {
  if (_ts.answered) return;
  _ts.answered = true;
  clearInterval(_ts.timerInterval);

  const q = _ts.exercises[_ts.index];
  const isCorrect = selectedValue === q.correctValue;
  if (isCorrect) _ts.score++;

  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === q.correctValue) btn.classList.add('correct');
    else if (btn === clickedBtn) btn.classList.add('wrong');
  });

  setTimeout(() => _tShowFeedback(isCorrect, q), 500);
}

function _tShowFeedback(isCorrect, q) {
  _tStopTTS();
  const overlay = document.getElementById('feedback-overlay');
  overlay.className = 'feedback-overlay ' + (isCorrect ? 'success' : 'failure');

  document.getElementById('feedback-icon').textContent = isCorrect ? '✓' : '✗';
  document.getElementById('feedback-title').textContent = isCorrect ? 'Correct!' : 'Incorrect';
  document.getElementById('feedback-subtitle').textContent = isCorrect ? '' : 'The correct answer was:';
  document.getElementById('feedback-correct-display').innerHTML = q.correctHTML;

  const ttsBtn = document.getElementById('tts-btn');
  if (ttsBtn) ttsBtn.style.display = _ts.audio ? '' : 'none';

  if (_ts.audio) _tPlayTTS(q.ttsText);
}

function nextQuestion() {
  const overlay = document.getElementById('feedback-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  _tStopTTS();
  overlay.className = 'feedback-overlay hidden';
  _ts.index++;
  if (_ts.index >= _ts.exercises.length) {
    _tShowSummary();
  } else {
    _tRenderQuestion();
  }
}

function _tShowSummary() {
  document.getElementById('exercise-view').style.display = 'none';
  document.getElementById('feedback-overlay').className = 'feedback-overlay hidden';
  const summary = document.getElementById('summary-view');
  summary.style.display = 'flex';

  const total = _ts.exercises.length;
  const pct = Math.round((_ts.score / total) * 100);
  document.getElementById('score-number').textContent = _ts.score;
  document.getElementById('score-total').textContent = '/ ' + total;
  document.getElementById('score-pct').textContent = pct + '%';

  let msg;
  if (pct === 100) msg = '🏆 Perfect score!';
  else if (pct >= 80) msg = '🎉 Great job!';
  else if (pct >= 60) msg = '👍 Good effort!';
  else if (pct >= 40) msg = '📚 Keep practicing!';
  else msg = '💪 Don\'t give up!';
  document.getElementById('summary-msg').textContent = msg;
}

function playAgain() {
  window.location.href = 'time-exercise.html';
}
