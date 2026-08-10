'use strict';

let idiomState = {
  exercises: [], index: 0, score: 0, answered: false, audio: true, subject: 'talemaader',
};

function idiomShuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function idiomEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function idiomTtsButton(text) {
  return `<button class="tts-mini" onclick="event.stopPropagation();idiomPlayTTS(${idiomEscape(JSON.stringify(text))})">🔊</button>`;
}

function idiomInfoCard(item) {
  return `
    <div class="conj-row"><span class="conj-label">Literal</span><span class="conj-value">${idiomEscape(item.literal_translation)}</span><span class="tts-mini-gap"></span></div>
    <div class="conj-row"><span class="conj-label">Meaning</span><span class="conj-value">${idiomEscape(item.meaning_english)}</span><span class="tts-mini-gap"></span></div>
    <div class="noun-example">
      <span class="noun-example-label">Example</span>
      <div class="noun-example-content">
        <span class="noun-example-text">${idiomEscape(item.example_danish)}</span>
        ${idiomTtsButton(item.example_danish)}
      </div>
    </div>`;
}

let idiomAssetPlayer = null;
function idiomPlayTTS(text) {
  const speak = text || document.getElementById('idiom-tts-label')?.textContent;
  if (!speak) return;
  idiomStopTTS();
  const btn = document.getElementById('tts-btn');
  const setPlaying = playing => btn && btn.classList.toggle('playing', playing);
  const fallback = () => {
    if (!window.speechSynthesis) { setPlaying(false); return; }
    const utterance = new SpeechSynthesisUtterance(speak);
    utterance.lang = 'da-DK'; utterance.rate = 0.85;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  };
  idiomAssetPlayer = playAudioAsset(speak, {
    onStart: () => setPlaying(true), onEnd: () => setPlaying(false), onFallback: fallback,
  });
}

function idiomStopTTS() {
  idiomAssetPlayer?.stop(); idiomAssetPlayer = null;
  window.speechSynthesis?.cancel();
  document.getElementById('tts-btn')?.classList.remove('playing');
}

async function initIdiomsExercise() {
  const raw = sessionStorage.getItem('talemaaderConfig');
  if (!raw) { window.location.href = 'talemaader-config.html'; return; }
  const config = JSON.parse(raw);
  const data = await fetch('js/talemaader-data.json').then(response => {
    if (!response.ok) throw new Error(`Could not load idiom data (${response.status})`);
    return response.json();
  });
  const count = config.count === 'all' ? data.length : (parseInt(config.count, 10) || 10);
  const useAdaptive = config.practiceMode &&
    typeof isLoggedIn === 'function' && isLoggedIn();
  let exercises = data;
  if (useAdaptive) {
    const progressMap = await loadProgress('talemaader');
    exercises = selectAdaptiveItems(data, progressMap, config.practiceMode, count);
    if (exercises.length === 0) {
      document.getElementById('exercise-view').style.display = 'none';
      document.getElementById('empty-state-view').style.display = 'flex';
      document.getElementById('empty-msg').textContent =
        config.practiceMode === 'review'
          ? 'No idioms are due for review right now.'
          : 'You have practiced all available idioms.';
      return;
    }
  } else {
    exercises = idiomShuffle(data).slice(0, count);
  }
  idiomState = {
    exercises, index: 0, score: 0, answered: false,
    audio: config.audio !== 'off', subject: 'talemaader',
  };
  document.getElementById('tts-btn').style.display = idiomState.audio ? '' : 'none';
  idiomRenderQuestion();
}

function idiomRenderQuestion() {
  const item = idiomState.exercises[idiomState.index];
  idiomState.answered = false;
  document.getElementById('progress-fill').style.width =
    `${(idiomState.index / idiomState.exercises.length) * 100}%`;
  document.getElementById('progress-text').textContent =
    `${idiomState.index + 1} / ${idiomState.exercises.length}`;
  document.getElementById('question-prompt').textContent = 'Can you say what this means?';
  document.getElementById('question-text').textContent = item.danish;
  const grid = document.getElementById('answer-grid');
  grid.className = 'answer-grid';
  grid.innerHTML = '';
  const hear = document.createElement('button');
  hear.className = 'answer-btn pronunciation-play-btn';
  hear.innerHTML = '🔊 &nbsp;Tap to hear, then rate yourself';
  hear.onclick = () => {
    idiomPlayTTS(item.danish);
    grid.innerHTML = '';
    grid.className = 'answer-grid four-options';
    [
      ['🤔 Don’t know', 'dont_know'], ['😓 Hard', 'hard'],
      ['🙂 Good', 'good'], ['😄 Easy', 'easy'],
    ].forEach(([label, value]) => {
      const button = document.createElement('button');
      button.className = 'answer-btn'; button.textContent = label;
      button.onclick = () => idiomHandleAnswer(value);
      grid.appendChild(button);
    });
  };
  grid.appendChild(hear);
}

function idiomHandleAnswer(resultType) {
  if (idiomState.answered) return;
  idiomState.answered = true;
  const item = idiomState.exercises[idiomState.index];
  if (resultType === 'good' || resultType === 'easy') idiomState.score++;
  if (typeof isLoggedIn === 'function' && isLoggedIn()) {
    recordAnswer(idiomState.subject, String(item.id), resultType).catch(console.error);
  }
  idiomShowFeedback(item, resultType);
}

function idiomShowFeedback(item, resultType) {
  document.getElementById('feedback-overlay').className =
    `feedback-overlay idiom-feedback ${resultType === 'dont_know' ? 'failure' : 'success'}`;
  document.getElementById('feedback-icon').textContent =
    resultType === 'dont_know' ? '🤔' : '✓';
  document.getElementById('feedback-title').textContent =
    resultType === 'dont_know' ? 'Let’s learn!' : 'Saved!';
  document.getElementById('feedback-subtitle').textContent = 'Expression details:';
  document.getElementById('idiom-info-container').innerHTML = idiomInfoCard(item);
  document.getElementById('idiom-info-container').style.display = 'block';
  document.getElementById('idiom-tts-label').textContent = item.danish;
  document.getElementById('tts-btn').style.display = idiomState.audio ? '' : 'none';
  if (idiomState.audio) idiomPlayTTS(item.danish);
}

function idiomNextQuestion() {
  const overlay = document.getElementById('feedback-overlay');
  if (overlay.classList.contains('hidden')) return;
  idiomStopTTS(); overlay.className = 'feedback-overlay hidden';
  idiomState.index++;
  if (idiomState.index >= idiomState.exercises.length) idiomShowSummary();
  else idiomRenderQuestion();
}

function idiomShowSummary() {
  document.getElementById('exercise-view').style.display = 'none';
  document.getElementById('summary-view').style.display = 'flex';
  const total = idiomState.exercises.length;
  document.getElementById('score-number').textContent = idiomState.score;
  document.getElementById('score-total').textContent = `/ ${total}`;
  document.getElementById('score-pct').textContent = `${Math.round(idiomState.score / total * 100)}%`;
  document.getElementById('summary-msg').textContent = '📚 Keep building your expression vocabulary!';
}

window.addEventListener('load', () => {
  twemoji.parse(document.body, { folder: 'svg', ext: '.svg' });
  initAuth(() => { renderAuthButton(); initIdiomsExercise(); },
           () => { renderAuthButton(); initIdiomsExercise(); });
});
