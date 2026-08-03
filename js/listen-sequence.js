'use strict';

const LISTEN_GAP_MS = 1000;
const LISTEN_BETWEEN_WORDS_MS = 1500;

function _listenDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _speakBrowserAsync(text, lang) {
  return new Promise(resolve => {
    if (!text || !window.speechSynthesis) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = lang;
    utter.rate  = 0.85;
    utter.onend   = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

function _playDanishMp3Async(text) {
  return new Promise(resolve => {
    if (!text) {
      resolve();
      return;
    }

    let player = playAudioAsset(text, {
      onEnd:      () => resolve(),
      onFallback: () => _speakBrowserAsync(text, 'da-DK').then(resolve),
    });

    if (!player) {
      _speakBrowserAsync(text, 'da-DK').then(resolve);
    }
  });
}

function _verbGroupSpeech(group) {
  if (group === 'ede') {
    return 'Conjugation group: ede';
  }
  if (group === 'te') {
    return 'Conjugation group: te';
  }
  return 'Conjugation group: irregular';
}

function _nounGroupSpeech(noun) {
  const parts = [`Gender: ${noun.gender} noun`];
  if (noun.pluralClass) {
    const labels = {
      er:        'Class 1, ending in er',
      e:         'Class 2, ending in e',
      zero:      'Class 3, unchanged plural',
      umlaut:    'Vowel change plural',
      irregular: 'Irregular plural',
    };
    parts.push(`Plural class: ${labels[noun.pluralClass] || noun.pluralClass}`);
  }
  return parts.join('. ');
}

function buildVerbListenPlan(verb) {
  const steps = [
    { kind: 'mp3', label: 'Danish', text: verb.inf },
    { kind: 'gap' },
    { kind: 'mp3', label: 'Danish', text: verb.inf },
    { kind: 'gap' },
    { kind: 'en',  label: 'Meaning', text: verb.meaning },
    { kind: 'gap' },
    { kind: 'en',  label: 'Group', text: _verbGroupSpeech(verb.group) },
  ];

  const forms = [
    { label: 'Imperative',  text: verb.imp },
    { label: 'Present',     text: verb.present },
    { label: 'Past',        text: verb.past },
    { label: 'Perfect',     text: verb.perfect },
  ].filter(x => x.text && x.text !== '—');

  for (const form of forms) {
    steps.push({ kind: 'gap' });
    steps.push({ kind: 'mp3', label: form.label, text: form.text });
  }

  return steps;
}

function buildNounListenPlan(noun) {
  const steps = [
    { kind: 'mp3', label: 'Danish', text: noun.da },
    { kind: 'gap' },
    { kind: 'mp3', label: 'Danish', text: noun.da },
    { kind: 'gap' },
    { kind: 'en',  label: 'Meaning', text: noun.meaning },
    { kind: 'gap' },
    { kind: 'en',  label: 'Group', text: _nounGroupSpeech(noun) },
  ];

  if (noun.danish_example) {
    steps.push({ kind: 'gap' });
    steps.push({ kind: 'mp3', label: 'Example', text: noun.danish_example });
  }

  const forms = [
    { label: 'Definite',        text: noun.definiteSg },
    { label: 'Plural',          text: noun.plural },
    { label: 'Definite plural', text: noun.definitePl },
  ].filter(x => x.text);

  for (const form of forms) {
    steps.push({ kind: 'gap' });
    steps.push({ kind: 'mp3', label: form.label, text: form.text });
  }

  return steps;
}

class ListenSequenceRunner {
  constructor() {
    this._cancelled = false;
    this._player    = null;
  }

  cancel() {
    this._cancelled = true;
    this._player?.stop();
    this._player = null;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  get cancelled() {
    return this._cancelled;
  }

  async run(steps, onStep) {
    for (const step of steps) {
      if (this._cancelled) {
        return;
      }

      onStep?.(step);

      if (step.kind === 'gap') {
        await _listenDelay(LISTEN_GAP_MS);
      } else if (step.kind === 'mp3') {
        await _playDanishMp3Async(step.text);
      } else if (step.kind === 'en') {
        await _speakBrowserAsync(step.text, 'en-US');
      }
    }
  }
}

function startListenReviewSession({ items, buildPlan, onItemStart, onStep, onComplete }) {
  let stopped       = false;
  let currentRunner = null;
  let skipRequested = false;

  async function playAll() {
    for (let i = 0; i < items.length; i++) {
      if (stopped) {
        return;
      }

      const item = items[i];
      onItemStart?.(item, i, items.length);
      skipRequested = false;

      currentRunner = new ListenSequenceRunner();
      await currentRunner.run(buildPlan(item), onStep);
      currentRunner = null;

      if (stopped) {
        return;
      }

      if (skipRequested) {
        skipRequested = false;
        continue;
      }

      if (i < items.length - 1) {
        await _listenDelay(LISTEN_BETWEEN_WORDS_MS);
      }
    }

    if (!stopped) {
      onComplete?.();
    }
  }

  playAll();

  return {
    skip() {
      if (stopped) {
        return;
      }
      skipRequested = true;
      currentRunner?.cancel();
    },
    stop() {
      stopped = true;
      currentRunner?.cancel();
    },
  };
}
