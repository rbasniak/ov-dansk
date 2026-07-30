'use strict';

function _audioAssetFileName(text) {
  let stem = text.replace(/[%<>:"/\\|?*]/g, character => encodeURIComponent(character));
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) {
    stem = [...stem].map(character => `%${character.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`).join('');
  }
  return `${stem}.mp3`;
}

function _audioAssetUrl(text) {
  return new URL(`assets/${encodeURIComponent(_audioAssetFileName(text))}`, document.baseURI).href;
}

function playAudioAsset(text, { onStart, onEnd, onFallback }) {
  if (!text || typeof Audio === 'undefined') {
    onFallback?.();
    return null;
  }

  const audio = new Audio(_audioAssetUrl(text));
  let stopped = false;
  let completed = false;

  const complete = callback => {
    if (stopped || completed) return;
    completed = true;
    callback?.();
  };

  audio.addEventListener('playing', () => {
    if (!stopped) onStart?.();
  }, { once: true });
  audio.addEventListener('ended', () => complete(onEnd), { once: true });
  audio.addEventListener('error', () => complete(onFallback), { once: true });
  audio.play().catch(() => complete(onFallback));

  return {
    stop() {
      stopped = true;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    },
  };
}
