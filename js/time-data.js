'use strict';

const _H12 = ['', 'et', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv'];
const _H24 = [
  'nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve',
  'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten',
  'tyve', 'enogtyve', 'toogtyve', 'treogtyve'
];
const _ONES_EN = [
  '', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni',
  'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten',
  'seksten', 'sytten', 'atten', 'nitten'
];
const _ONES_ET = [
  '', 'et', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni',
  'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten',
  'seksten', 'sytten', 'atten', 'nitten'
];
const _TENS = ['', '', 'tyve', 'tredive', 'fyrre', 'halvtreds', 'tres', 'halvfjerds', 'firs', 'halvfems'];
const ANALOG_MINUTES = [0, 1, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58, 59];

function _timeShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _pad2(n) {
  return String(n).padStart(2, '0');
}

function _normHour24(h) {
  return ((h % 24) + 24) % 24;
}

function _clockValue(h, m) {
  return `${h}:${m}`;
}

function _splitCompoundWord(word) {
  return word.replace(/([a-zæøå])(og)([a-zæøå])/gi, '$1 og $3');
}

function _numberWord(n, ones) {
  if (n === 0) return 'nul';
  if (n < 20) return ones[n];
  if (n < 100) {
    const u = n % 10;
    const t = Math.floor(n / 10);
    return u === 0 ? _TENS[t] : ones[u] + 'og' + _TENS[t];
  }
  return String(n);
}

function _spacedNumberWord(n, ones) {
  return _splitCompoundWord(_numberWord(n, ones));
}

// useLidt: when true, say "lidt over/i" for near-hour minutes;
//          when false, read the exact digits instead (both are valid Danish)
function digitalTTS(h, m, useDenEr, useLidt) {
  const hour = _normHour24(h);
  const mins = Math.max(0, Math.min(59, m));
  const nextHour = (hour + 1) % 24;
  const prefix = useDenEr ? 'Den er' : 'Klokken er';

  if (mins === 0) return `${prefix} ${_H24[hour]} nul nul`;

  if (mins <= 2) {
    if (useLidt) return `${prefix} lidt over ${_H24[hour]}`;
    return `${prefix} ${_H24[hour]} nul ${_ONES_EN[mins]}`;
  }

  if (mins >= 58) {
    if (useLidt) return `${prefix} lidt i ${_H24[nextHour]}`;
    return `${prefix} ${_H24[hour]} ${_spacedNumberWord(mins, _ONES_EN)}`;
  }

  if (mins <= 9) return `${prefix} ${_H24[hour]} nul ${_H24[mins]}`;
  return `${prefix} ${_H24[hour]} ${_spacedNumberWord(mins, _ONES_EN)}`;
}

function analogTTS(h, m, useDenEr) {
  const hour = _normHour24(h);
  const mins = Math.max(0, Math.min(59, m));
  const hour12 = (hour % 12) || 12;
  const nextHour12 = ((hour + 1) % 12) || 12;
  const prefix = useDenEr ? 'Den er' : 'Klokken er';

  if (mins === 0) return `Klokken er ${_H12[hour12]}`;
  if (mins <= 2) return `${prefix} lidt over ${_H12[hour12]}`;
  if (mins === 15) return `${prefix} kvart over ${_H12[hour12]}`;
  if (mins === 30) return `${prefix} halv ${_H12[nextHour12]}`;
  if (mins === 45) return `${prefix} kvart i ${_H12[nextHour12]}`;
  if (mins >= 58) return `${prefix} lidt i ${_H12[nextHour12]}`;

  if (mins < 30) {
    return `${prefix} ${_spacedNumberWord(mins, _ONES_ET)} minutter over ${_H12[hour12]}`;
  }

  return `${prefix} ${_spacedNumberWord(60 - mins, _ONES_ET)} minutter i ${_H12[nextHour12]}`;
}

function _clockPoint(cx, cy, r, deg) {
  const rad = deg * Math.PI / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad)
  };
}

function clockSVG(h, m) {
  const cx = 50;
  const cy = 50;
  const hourDeg = ((_normHour24(h) % 12) * 30) + (m * 0.5);
  const minuteDeg = m * 6;
  const hourEnd = _clockPoint(cx, cy, 28, hourDeg);
  const minuteEnd = _clockPoint(cx, cy, 38, minuteDeg);
  const ticks = [];

  for (let i = 0; i < 12; i++) {
    const isQuarter = i % 3 === 0;
    const start = _clockPoint(cx, cy, isQuarter ? 40 : 43, i * 30);
    const end = _clockPoint(cx, cy, 47, i * 30);
    ticks.push(
      `<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="#94a3b8" stroke-width="${isQuarter ? '2.5' : '1.5'}" stroke-linecap="round" />`
    );
  }

  return (
    `<svg viewBox="0 0 100 100" class="clock-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<circle cx="50" cy="50" r="47" fill="#1e293b" stroke="#3f4f66" stroke-width="2" />` +
      ticks.join('') +
      `<line x1="50" y1="50" x2="${hourEnd.x.toFixed(2)}" y2="${hourEnd.y.toFixed(2)}" stroke="#f1f5f9" stroke-width="5" stroke-linecap="round" />` +
      `<line x1="50" y1="50" x2="${minuteEnd.x.toFixed(2)}" y2="${minuteEnd.y.toFixed(2)}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" />` +
      `<circle cx="50" cy="50" r="4" fill="#f1f5f9" />` +
    `</svg>`
  );
}

function digitalDisplayHTML(h, m) {
  return (
    `<div class="digital-clock">` +
      `<span class="dc-hours">${_pad2(h)}</span><span class="dc-colon">:</span><span class="dc-mins">${_pad2(m)}</span>` +
    `</div>`
  );
}

function getAnalogDistractors(h, m) {
  const candidates = [];
  const target = _clockValue(h, m);
  const minuteIndex = ANALOG_MINUTES.indexOf(m);
  const mirrorMinute = (m > 0 && m < 60) ? 60 - m : null;

  function add(hour, mins) {
    const hh = _normHour24(hour);
    if (!ANALOG_MINUTES.includes(mins)) return;
    const key = _clockValue(hh, mins);
    if (key !== target) candidates.push({ h: hh, m: mins });
  }

  if (mirrorMinute !== null) add(h, mirrorMinute);
  [1, -1, 2, -2].forEach(delta => add(h + delta, m));

  if (minuteIndex !== -1) {
    [-1, 1].forEach(delta => {
      const idx = minuteIndex + delta;
      if (idx >= 0 && idx < ANALOG_MINUTES.length) add(h, ANALOG_MINUTES[idx]);
    });
  }

  if (mirrorMinute !== null) {
    [1, -1].forEach(delta => add(h + delta, mirrorMinute));
  }

  const out = [];
  const used = new Set([target]);
  _timeShuffle(candidates);

  for (const item of candidates) {
    const key = _clockValue(item.h, item.m);
    if (!used.has(key)) {
      used.add(key);
      out.push(item);
      if (out.length === 3) return out;
    }
  }

  while (out.length < 3) {
    const item = { h: _randInt(0, 23), m: ANALOG_MINUTES[_randInt(0, ANALOG_MINUTES.length - 1)] };
    const key = _clockValue(item.h, item.m);
    if (!used.has(key)) {
      used.add(key);
      out.push(item);
    }
  }

  return out;
}

function getDigitalDistractors(h, m) {
  const candidates = [];
  const target = _clockValue(h, m);

  function add(hour, mins) {
    if (hour < 0 || hour > 23 || mins < 0 || mins > 59) return;
    const key = _clockValue(hour, mins);
    if (key !== target) candidates.push({ h: hour, m: mins });
  }

  [5, 10, 15, 20].forEach(delta => {
    add(h, m + delta);
    add(h, m - delta);
  });
  [1, 2].forEach(delta => {
    add(h + delta, m);
    add(h - delta, m);
  });
  add(Math.max(0, Math.min(23, m)), Math.max(0, Math.min(59, h)));

  const out = [];
  const used = new Set([target]);
  _timeShuffle(candidates);

  for (const item of candidates) {
    const key = _clockValue(item.h, item.m);
    if (!used.has(key)) {
      used.add(key);
      out.push(item);
      if (out.length === 3) return out;
    }
  }

  while (out.length < 3) {
    const item = { h: _randInt(0, 23), m: _randInt(0, 59) };
    const key = _clockValue(item.h, item.m);
    if (!used.has(key)) {
      used.add(key);
      out.push(item);
    }
  }

  return out;
}

function generateTimePool(count) {
  const total = Math.max(1, parseInt(count, 10) || 10);
  const analogCount = Math.floor(total / 2);
  const digitalCount = total - analogCount;
  const pool = [];
  const used = new Set();

  function add(type, h, m) {
    const key = _clockValue(h, m);
    if (used.has(key)) return false;
    used.add(key);
    pool.push({ type, h, m });
    return true;
  }

  while (pool.length < analogCount) {
    add('analog', _randInt(0, 23), ANALOG_MINUTES[_randInt(0, ANALOG_MINUTES.length - 1)]);
  }

  while (pool.length < analogCount + digitalCount) {
    add('digital', _randInt(0, 23), _randInt(0, 59));
  }

  return _timeShuffle(pool);
}
