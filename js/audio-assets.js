'use strict';

function _audioAssetFileName(text) {
  return `${text.replace(/[%<>:"/\\|?*]/g, character => encodeURIComponent(character))}.mp3`;
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
