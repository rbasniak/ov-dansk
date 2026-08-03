'use strict';

const LISTEN_GAP_MS = 1000;
const LISTEN_BETWEEN_WORDS_MS = 800;

let _separatorAudioContext = null;
let _separatorResolve = null;

function _listenDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _getSeparatorAudioContext() {
  if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
    return null;
  }

  if (!_separatorAudioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    _separatorAudioContext = new Context();
  }

  return _separatorAudioContext;
}

function _stopWordSeparator() {
  if (_separatorResolve) {
    _separatorResolve();
    _separatorResolve = null;
  }
}

function _playWordSeparatorAsync() {
  return new Promise(resolve => {
    _separatorResolve = resolve;
    const ctx = _getSeparatorAudioContext();

    if (!ctx) {
      _separatorResolve = null;
      _listenDelay(450).then(resolve);
      return;
    }

    const finish = () => {
      if (_separatorResolve !== resolve) {
        return;
      }
      _separatorResolve = null;
      resolve();
    };

    const playTone = (frequency, startTime, duration, volume) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.01);
    };

    const startPlayback = () => {
      const now = ctx.currentTime;
      playTone(523.25, now, 0.16, 0.1);
      playTone(659.25, now + 0.2, 0.2, 0.12);
      setTimeout(finish, 480);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(startPlayback).catch(finish);
    } else {
      startPlayback();
    }
  });
}

async function _playBetweenWordsSeparator(onStep) {
  onStep?.({ kind: 'separator', label: 'Next word' });
  await _playWordSeparatorAsync();
  await _listenDelay(LISTEN_BETWEEN_WORDS_MS);
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
    _stopWordSeparator();
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
        await _playBetweenWordsSeparator(onStep);
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
      _stopWordSeparator();
    },
  };
}
