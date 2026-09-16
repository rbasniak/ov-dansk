'use strict';

let customState = {
  exercises: [], index: 0, score: 0, answered: false, audio: true,
  subject: 'custom', progressMap: {}, audioPlayer: null, audioGeneration: 0,
};

function customEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function customPlayTTS(text) {
  const speak = text || customState.exercises[customState.index]?.term;
  if (!speak) return;
  customStopTTS();
  const generation = customState.audioGeneration;
  const audio = new Audio();
  audio.referrerPolicy = 'no-referrer';
  audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=da&q=${encodeURIComponent(speak)}`;
  customState.audioPlayer = audio;
  audio.onerror = () => {
    if (generation !== customState.audioGeneration) return;
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(speak);
    utterance.lang = 'da-DK';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  };
  audio.play().catch(error => {
    if (generation !== customState.audioGeneration || error?.name === 'AbortError') return;
    audio.onerror();
  });
}

function customStopTTS() {
  customState.audioGeneration++;
  customState.audioPlayer?.pause();
  customState.audioPlayer = null;
  window.speechSynthesis?.cancel();
}

function customToggleCard() {
  const flipped = document.getElementById('custom-card-inner')?.classList.toggle('is-flipped');
  const answerGrid = document.getElementById('answer-grid');
  if (answerGrid) answerGrid.hidden = !flipped;
}

async function initCustomExercise() {
  const raw = sessionStorage.getItem('customConfig');
  if (!raw) {
    window.location.href = 'custom-config.html';
    return;
  }
  if (!isLoggedIn()) {
    window.location.href = 'custom-config.html';
    return;
  }
  const config = JSON.parse(raw);
  const data = await loadCustomWords();
  const count = config.count === 'all' ? data.length : (parseInt(config.count, 10) || 10);
  const progressMap = await loadProgress('custom');
  const exercises = selectAdaptiveItems(data, progressMap, config.practiceMode || 'mixed', count);

  if (exercises.length === 0) {
    document.getElementById('exercise-view').style.display = 'none';
    document.getElementById('empty-state-view').style.display = 'flex';
    document.getElementById('empty-msg').textContent =
      config.practiceMode === 'review'
        ? 'No saved terms are due for review right now.'
        : 'Save some words from the reading pages first.';
    return;
  }

  customState = {
    exercises, index: 0, score: 0, answered: false,
    audio: config.audio !== 'off', subject: 'custom', progressMap,
    audioPlayer: null, audioGeneration: 0,
  };
  document.getElementById('tts-btn').style.display = customState.audio ? '' : 'none';
  customRenderQuestion();
}

function customRenderQuestion() {
  const item = customState.exercises[customState.index];
  customState.answered = false;
  document.getElementById('progress-fill').style.width =
    `${(customState.index / customState.exercises.length) * 100}%`;
  document.getElementById('progress-text').textContent =
    `${customState.index + 1} / ${customState.exercises.length}`;
  document.getElementById('question-prompt').textContent = 'What does this mean?';
  document.getElementById('question-text').textContent = item.term;
  document.getElementById('question-meaning').textContent = item.meaning;
  document.getElementById('custom-card-inner').classList.remove('is-flipped');
  document.getElementById('question-tts-btn').style.display = customState.audio ? 'inline-flex' : 'none';
  document.getElementById('tts-label').textContent = item.term;
  if (customState.audio) customPlayTTS(item.term);

  const grid = document.getElementById('answer-grid');
  grid.className = 'answer-grid four-options';
  grid.hidden = true;
  grid.innerHTML = '';
  [
    ['I don’t know', 'dont_know', 'Again this session'],
    ['Hard', 'hard', 'Review today'],
    ['Good', 'good', customIntervalLabel(item, 4)],
    ['Easy', 'easy', customIntervalLabel(item, 5)],
  ].forEach(([label, value, detail]) => {
    const button = document.createElement('button');
    button.className = `answer-btn idiom-rating idiom-rating-${value}`;
    button.innerHTML = `${customEscape(label)}<small>${customEscape(detail)}</small>`;
    button.onclick = () => customHandleAnswer(value);
    grid.appendChild(button);
  });
}

function customIntervalLabel(item, quality) {
  const progress = customState.progressMap[String(item.id)] || {};
  return getReviewIntervalLabel(progress, quality);
}

function customHandleAnswer(resultType) {
  if (customState.answered) return;
  customState.answered = true;
  const item = customState.exercises[customState.index];
  if (resultType === 'good' || resultType === 'easy') customState.score++;
  if (resultType === 'dont_know' && !item._retried) {
    customState.exercises.push({ ...item, _retried: true });
  }
  recordAnswer(customState.subject, String(item.id), resultType).catch(console.error);
  customShowFeedback(item, resultType);
}

function customShowFeedback(item, resultType) {
  const overlay = document.getElementById('feedback-overlay');
  overlay.className = `feedback-overlay idiom-feedback ${resultType === 'dont_know' ? 'failure' : 'success'}`;
  document.getElementById('feedback-icon').textContent = resultType === 'dont_know' ? '🤔' : '✓';
  document.getElementById('feedback-title').textContent =
    resultType === 'dont_know' ? 'Let’s learn!' : 'Saved!';
  document.getElementById('feedback-subtitle').textContent = 'Your meaning:';
  document.getElementById('custom-info-container').innerHTML =
    `<div class="conj-row"><span class="conj-label">Meaning</span><span class="conj-value">${customEscape(item.meaning)}</span></div>`;
  document.getElementById('custom-info-container').style.display = 'block';
  document.getElementById('tts-label').textContent = item.term;
  document.getElementById('tts-btn').style.display = customState.audio ? '' : 'none';
  if (customState.audio) customPlayTTS(item.term);
}

function customNextQuestion() {
  const overlay = document.getElementById('feedback-overlay');
  if (overlay.classList.contains('hidden')) return;
  customStopTTS();
  overlay.className = 'feedback-overlay hidden';
  customState.index++;
  if (customState.index >= customState.exercises.length) customShowSummary();
  else customRenderQuestion();
}

function customShowSummary() {
  document.getElementById('exercise-view').style.display = 'none';
  document.getElementById('summary-view').style.display = 'flex';
  const total = customState.exercises.length;
  document.getElementById('score-number').textContent = customState.score;
  document.getElementById('score-total').textContent = `/ ${total}`;
  document.getElementById('score-pct').textContent = `${Math.round(customState.score / total * 100)}%`;
  document.getElementById('summary-msg').textContent = '📚 Keep reviewing your saved vocabulary!';
}

window.addEventListener('load', () => {
  window.twemoji?.parse?.(document.body, { folder: 'svg', ext: '.svg' });
  document.getElementById('custom-question-card')?.addEventListener('click', customToggleCard);
  initAuth(() => initCustomExercise(), () => { window.location.href = 'custom-config.html'; });
});
