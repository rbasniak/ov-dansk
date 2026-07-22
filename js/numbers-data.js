'use strict';

/* ── Danish Number Conversion ────────────────────────────────── */

const _ONES = [
  '', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni',
  'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten',
  'seksten', 'sytten', 'atten', 'nitten'
];
const _TENS = [
  '', '', 'tyve', 'tredive', 'fyrre',
  'halvtreds', 'tres', 'halvfjerds', 'firs', 'halvfems'
];

function danishNumber(n) {
  if (n === 0) return 'nul';
  if (n < 20) return _ONES[n];
  if (n < 100) {
    const u = n % 10;
    const t = Math.floor(n / 10);
    return u === 0 ? _TENS[t] : _ONES[u] + 'og' + _TENS[t];
  }
  if (n < 1000) {
    const h    = Math.floor(n / 100);
    const rest = n % 100;
    const hStr = h === 1 ? 'hundrede' : _ONES[h] + ' hundrede';
    return rest === 0 ? hStr : hStr + ' og ' + danishNumber(rest);
  }
  if (n < 10000) {
    const th   = Math.floor(n / 1000);
    const rest = n % 1000;
    const tStr = th === 1 ? 'et tusind' : danishNumber(th) + ' tusind';
    if (rest === 0) return tStr;
    if (rest < 100) return tStr + ' og ' + danishNumber(rest);
    return tStr + ' ' + danishNumber(rest);
  }
  return String(n);
}

// For TTS: split compound "enogtyve" → "en og tyve" so speech sounds natural
function danishNumberTTS(n) {
  return danishNumber(n).replace(/([a-zæøå])(og)([a-zæøå])/gi, '$1 og $3');
}

/* ── Utilities ───────────────────────────────────────────────── */

function _numShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ── Distractor Generation ───────────────────────────────────── */

// For 50-99: same units digit across all five 50-99 decades makes
// halvtreds / halvfjerds / halvfems (and nearby firs / tres) confusable.
function _halvCandidates(n) {
  if (n < 50 || n > 99) return [];
  const units  = n % 10;
  const myTens = Math.floor(n / 10);
  const out = [];
  for (let t = 5; t <= 9; t++) {
    if (t === myTens) continue;
    out.push(t * 10 + units);
  }
  return out; // exactly 4 candidates
}

// Returns exactly 3 distractor numbers for n
function getNumberDistractors(n) {
  const used   = new Set([n]);
  const result = [];

  // Special rule for 50-99: use same units across all decades 50-90
  if (n >= 50 && n <= 99) {
    const halvC = _numShuffle(_halvCandidates(n));
    for (const c of halvC) {
      if (result.length === 3) break;
      if (!used.has(c)) { used.add(c); result.push(c); }
    }
  }

  // Fill remaining with proximity-based candidates
  if (result.length < 3) {
    const fill = [];

    if (n >= 1 && n <= 99) {
      for (let d = 1; d <= 20; d++) {
        if (n + d <= 99) fill.push(n + d);
        if (n - d >= 1)  fill.push(n - d);
      }
      // Same units, different tens
      for (let t = 0; t <= 9; t++) {
        const c = t * 10 + (n % 10);
        if (c >= 1 && c <= 99) fill.push(c);
      }
    } else if (n >= 100 && n <= 999) {
      for (const d of [10, 20, 50, 100, 200]) {
        if (n + d <= 999) fill.push(n + d);
        if (n - d >= 100) fill.push(n - d);
      }
      // Same remainder, different hundreds
      for (let h = 1; h <= 9; h++) fill.push(h * 100 + (n % 100));
    } else if (n >= 1000 && n <= 9999) {
      for (const d of [100, 250, 500, 1000]) {
        if (n + d <= 9999) fill.push(n + d);
        if (n - d >= 1000) fill.push(n - d);
      }
      for (let th = 1; th <= 9; th++) fill.push(th * 1000 + (n % 1000));
    }

    _numShuffle(fill);
    for (const c of fill) {
      if (result.length === 3) break;
      if (!used.has(c) && Number.isInteger(c) && c >= 1 && c <= 9999) {
        used.add(c);
        result.push(c);
      }
    }
  }

  // Last resort: random in same range
  while (result.length < 3) {
    let c;
    if (n < 100)       c = _randInt(1, 99);
    else if (n < 1000) c = _randInt(100, 999);
    else               c = _randInt(1000, 9999);
    if (!used.has(c)) { used.add(c); result.push(c); }
  }

  return result;
}

/* ── Number Buckets (for adaptive tracking) ──────────────────── */
// Numbers span ~10,000 possible values, so we can't track individual
// numbers with SM-2 the way we track words — a given exact number rarely
// repeats. Instead we track *patterns* (13 buckets) that map onto the
// actual sources of confusion in Danish numbers: the irregular teens,
// each tens-word (especially the halv- group), and hundred/thousand
// structure. Progress is stored per bucket (+ exercise type suffix),
// exactly like verbs/nouns.
const NUMBER_BUCKETS = [
  { id: 'ones',              label: '1–9',                 min: 1,   max: 9   },
  { id: 'teens',             label: '10–19 (teens)',       min: 10,  max: 19  },
  { id: 'tyve',              label: '20s (tyve)',          min: 20,  max: 29  },
  { id: 'tredive',           label: '30s (tredive)',       min: 30,  max: 39  },
  { id: 'fyrre',             label: '40s (fyrre)',         min: 40,  max: 49  },
  { id: 'halvtreds',         label: '50s (halvtreds)',     min: 50,  max: 59  },
  { id: 'tres',              label: '60s (tres)',          min: 60,  max: 69  },
  { id: 'halvfjerds',        label: '70s (halvfjerds)',    min: 70,  max: 79  },
  { id: 'firs',              label: '80s (firs)',          min: 80,  max: 89  },
  { id: 'halvfems',          label: '90s (halvfems)',      min: 90,  max: 99  },
  { id: 'hundreds-simple',   label: 'Round hundreds',      test: n => n >= 100  && n <= 999  && n % 100 === 0 },
  { id: 'hundreds-compound', label: 'Hundreds + remainder', test: n => n >= 100  && n <= 999  && n % 100 !== 0 },
  { id: 'thousands',         label: 'Thousands',           min: 1000, max: 9999 },
];

// Classifies a number into its bucket definition.
function classifyNumberBucket(n) {
  for (const b of NUMBER_BUCKETS) {
    if (b.test ? b.test(n) : (n >= b.min && n <= b.max)) return b;
  }
  return null;
}

// Generates a random number belonging to the given bucket, avoiding
// duplicates already present in `usedSet` (best-effort).
function _generateNumberInBucket(bucket, usedSet) {
  let n, tries = 0;
  do {
    if (bucket.id === 'hundreds-simple')        n = _randInt(1, 9) * 100;
    else if (bucket.id === 'hundreds-compound') n = _randInt(1, 9) * 100 + _randInt(1, 99);
    else                                        n = _randInt(bucket.min, bucket.max);
    tries++;
  } while (usedSet.has(n) && tries < 50);
  usedSet.add(n);
  return n;
}

// Weighted bucket selection driven by SM-2 progress (mirrors the intent of
// selectAdaptiveItems in firebase.js, adapted for a small fixed set of
// buckets that must be sampled *with replacement* to fill a full session).
//
// progressMap – result of loadProgress('numbers'), keyed by `${bucketId}_${type}`
// mode        – 'mixed' | 'learn' | 'review'
// type        – 'audio-to-num' | 'num-to-written' (used to build the itemId)
// count       – number of questions to generate
function selectNumberBuckets(progressMap, mode, type, count) {
  const now   = Date.now();
  const stats = NUMBER_BUCKETS.map(bucket => {
    const prog  = progressMap[`${bucket.id}_${type}`];
    const reps  = prog ? (prog.repetitions || 0) : 0;
    const isNew = !prog || reps === 0;
    const isDue = !isNew && prog.nextReview <= now;
    const total = prog ? (prog.correctCount || 0) + (prog.wrongCount || 0) + (prog.dontKnowCount || 0) : 0;
    const errorRate = total > 0 ? (prog.wrongCount + (prog.dontKnowCount || 0)) / total : 0.3;
    return { bucket, isNew, isDue, errorRate };
  });

  let pool;
  if (mode === 'learn') {
    pool = stats.filter(s => s.isNew);
  } else if (mode === 'review') {
    pool = stats.filter(s => s.isDue);
  } else {
    pool = stats;
  }
  if (pool.length === 0) pool = stats; // fallback: always have something to draw from

  function weight(s) {
    if (mode === 'learn')  return 1;
    if (mode === 'review') return 1 + s.errorRate * 3;
    // mixed: favour new buckets and due/weak buckets, but still let
    // not-yet-due buckets show up occasionally (weighted by difficulty).
    if (s.isNew) return 2.5;
    if (s.isDue) return 1.5 + s.errorRate * 3;
    return 0.4 + s.errorRate;
  }

  const weighted = pool.map(s => ({ ...s, w: weight(s) }));
  const totalW   = weighted.reduce((sum, s) => sum + s.w, 0);

  const chosen = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * totalW;
    let picked = weighted[weighted.length - 1];
    for (const s of weighted) {
      if (r < s.w) { picked = s; break; }
      r -= s.w;
    }
    chosen.push(picked.bucket);
  }
  return chosen;
}

// Builds an adaptive pool of { number, bucketId } for the given mode/count.
function generateAdaptiveNumberPool(progressMap, mode, type, count) {
  const used    = new Set();
  const buckets = selectNumberBuckets(progressMap, mode, type, count);
  return buckets.map(bucket => ({
    number:   _generateNumberInBucket(bucket, used),
    bucketId: bucket.id,
  }));
}

/* ── Number Pool Generation ──────────────────────────────────── */
// ~75% from 1-99, ~20% from 100-999, ~5% from 1000-9999
// 1000-9999 only when count >= 10 (min 1)
function generateNumberPool(count) {
  let n3, n2, n1;
  if (count < 10) {
    n3 = 0;
    n2 = Math.max(1, Math.round(count * 0.20));
    n1 = count - n2;
  } else {
    n3 = Math.max(1, Math.round(count * 0.05));
    n2 = Math.max(1, Math.round(count * 0.20));
    n1 = count - n2 - n3;
  }

  const pool = [];
  const used = new Set();

  function pickUnique(min, max) {
    let v, tries = 0;
    do { v = _randInt(min, max); tries++; } while (used.has(v) && tries < 300);
    used.add(v);
    pool.push(v);
  }

  for (let i = 0; i < n1; i++) pickUnique(1, 99);
  for (let i = 0; i < n2; i++) pickUnique(100, 999);
  for (let i = 0; i < n3; i++) pickUnique(1000, 9999);

  return _numShuffle(pool);
}
