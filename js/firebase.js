'use strict';

// ─── Firebase Configuration ───────────────────────────────────────────────────
// Replace these placeholder values with your Firebase project's config.
// See the "Firebase Setup" section at the bottom of README.md for instructions.
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyAmrttzr16EMpmmaNx8D7NUiwYjqo4996M',
  authDomain:        'ov-dansk.firebaseapp.com',
  projectId:         'ov-dansk',
  storageBucket:     'ov-dansk.firebasestorage.app',
  messagingSenderId: '749643252913',
  appId:             '1:749643252913:web:63f7c2f46815a35dfe0e90',
};

firebase.initializeApp(FIREBASE_CONFIG);

const _auth     = firebase.auth();
const _db       = firebase.firestore();
const _provider = new firebase.auth.GoogleAuthProvider();

let _currentUser = null;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getCurrentUser() { return _currentUser; }
function isLoggedIn()     { return !!_currentUser; }

// Call once per page to register auth state listener.
// Both callbacks fire exactly once on page load (cached state), then on changes.
function initAuth(onLogin, onLogout) {
  _auth.onAuthStateChanged(user => {
    _currentUser = user;
    if (user) onLogin  && onLogin(user);
    else      onLogout && onLogout();
  });
}

async function signInWithGoogle() {
  try { await _auth.signInWithPopup(_provider); }
  catch (e) { if (e.code !== 'auth/popup-closed-by-user') console.error('Sign-in error:', e); }
}

async function signOut() {
  try { await _auth.signOut(); }
  catch (e) { console.error('Sign-out error:', e); }
}

// ─── SM-2 with interval fuzz ─────────────────────────────────────────────────
// quality: 4 = correct answer, 1 = wrong / don't know, 0 = timeout
//
// Interval fuzz: ±25 % of the calculated interval (min 1 day, max 7 days).
// This spreads out future reviews so items don't cluster on the same date.
// Fuzz is NOT applied on resets (interval = 1) so the item always returns the
// next day after a mistake.
//
// Practical results with default easeFactor 2.5:
//   repetitions 1 → base 1 day  → always 1 day  (no fuzz)
//   repetitions 2 → base 6 days → range  4 – 8 days
//   repetitions 3 → base 15 days→ range 11 – 19 days
//   repetitions 4 → base ~37 days→ range ~30 – 44 days

function _applyFuzz(interval) {
  if (interval <= 1) return 1;
  const fuzz  = Math.min(7, Math.max(1, Math.round(interval * 0.25)));
  const delta = Math.round((Math.random() * 2 - 1) * fuzz);
  return Math.max(2, interval + delta);
}

function _sm2Update(existing, quality) {
  let { interval = 0, easeFactor = 2.5, repetitions = 0 } = existing;

  if (quality >= 3) {
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = _applyFuzz(6);
    else                        interval = _applyFuzz(Math.round(interval * easeFactor));
    repetitions++;
  } else {
    repetitions = 0;
    interval    = 1; // always back tomorrow after a mistake — no fuzz
  }

  easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor   = Math.max(1.3, easeFactor);

  return { interval, easeFactor, repetitions, nextReview: Date.now() + interval * 86400000 };
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

function _itemRef(subject, itemId) {
  const safeId = String(itemId).replace(/[/ ]/g, '_');
  return _db.collection('users').doc(_currentUser.uid)
            .collection('progress').doc(`${subject}_${safeId}`);
}

// Returns a map of { [itemId]: progressData } for the given subject.
async function loadProgress(subject) {
  if (!_currentUser) return {};
  try {
    const snap = await _db.collection('users').doc(_currentUser.uid)
                          .collection('progress')
                          .where('subject', '==', subject).get();
    const map = {};
    snap.forEach(doc => { map[doc.data().itemId] = doc.data(); });
    return map;
  } catch (e) {
    console.error('loadProgress:', e);
    return {};
  }
}

// resultType: 'correct' | 'wrong' | 'dont_know' | 'timeout'
async function recordAnswer(subject, itemId, resultType) {
  if (!_currentUser) return;
  const quality = { correct: 4, wrong: 1, dont_know: 1, timeout: 0 }[resultType] ?? 1;
  try {
    const ref  = _itemRef(subject, itemId);
    const snap = await ref.get();
    const old  = snap.exists ? snap.data() : {};
    const sm2  = _sm2Update(old, quality);
    await ref.set({
      subject, itemId, ...sm2,
      lastSeen:      Date.now(),
      correctCount:  (old.correctCount  || 0) + (resultType === 'correct'   ? 1 : 0),
      wrongCount:    (old.wrongCount    || 0) + (resultType === 'wrong'     ? 1 : 0),
      dontKnowCount: (old.dontKnowCount || 0) + (resultType === 'dont_know' ? 1 : 0),
    }, { merge: true });
  } catch (e) {
    console.error('recordAnswer:', e);
  }
}

// ─── Adaptive pool selection ──────────────────────────────────────────────────

function _fbShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Splits items into review (due) and new (never seen) buckets,
// then selects according to practice mode.
//
// items       – array of data objects; each must have an `.inf` or `.id` key
//               used as the itemId stored in Firestore.
// progressMap – result of loadProgress()
// mode        – 'mixed' | 'learn' | 'review'
// count       – integer or Infinity (use all available items)
function selectAdaptiveItems(items, progressMap, mode, count) {
  const now         = Date.now();
  const reviewItems = [];
  const newItems    = [];

  for (const item of items) {
    const id   = item.inf ?? item.id;
    const prog = progressMap[id];
    if (!prog || prog.repetitions === 0) newItems.push(item);
    else if (prog.nextReview <= now)     reviewItems.push(item);
    // else: scheduled for the future — skip for now
  }

  if (mode === 'learn')  return _fbShuffle(newItems).slice(0, count);
  if (mode === 'review') return _fbShuffle(reviewItems).slice(0, count);

  // mixed: guarantee ≥30 % from new items so the user always sees something new
  // even when the review backlog is large.
  const finite       = Number.isFinite(count);
  const newTarget    = finite ? Math.max(1, Math.ceil(count * 0.30)) : newItems.length;
  const reviewTarget = finite ? count - newTarget : reviewItems.length;

  const pickedReview = _fbShuffle(reviewItems).slice(0, reviewTarget);
  const pickedNew    = _fbShuffle(newItems).slice(0, newTarget);
  let   selected     = [...pickedReview, ...pickedNew];

  // Fill any shortfall from the other pool
  if (finite && selected.length < count) {
    const usedRevIds = new Set(pickedReview.map(i => i.inf ?? i.id));
    const usedNewIds = new Set(pickedNew.map(i => i.inf ?? i.id));
    const extras     = _fbShuffle([
      ...reviewItems.filter(i => !usedRevIds.has(i.inf ?? i.id)),
      ...newItems.filter(i    => !usedNewIds.has(i.inf ?? i.id)),
    ]);
    selected.push(...extras.slice(0, count - selected.length));
  }

  return _fbShuffle(selected).slice(0, finite ? count : Infinity);
}

// ─── Auth button UI ───────────────────────────────────────────────────────────
// Renders login / user widget into any element with id="auth-btn-container".

function renderAuthButton() {
  const container = document.getElementById('auth-btn-container');
  if (!container) return;

  if (_currentUser) {
    const firstName = (_currentUser.displayName || 'User').split(' ')[0];
    const photo     = _currentUser.photoURL;
    container.innerHTML = `
      <a href="progress.html" class="auth-btn auth-btn--user" title="View progress">
        ${photo
          ? `<img class="auth-avatar" src="${photo}" alt="">`
          : `<span class="auth-avatar auth-avatar--text">${firstName[0].toUpperCase()}</span>`}
        <span class="auth-name">${firstName}</span>
      </a>
      <button class="auth-btn auth-btn--icon" onclick="signOut()" title="Sign out" aria-label="Sign out">↩</button>
    `;
  } else {
    container.innerHTML = `
      <button class="auth-btn auth-btn--login" onclick="signInWithGoogle()">
        <svg viewBox="0 0 24 24" width="16" height="16" style="flex-shrink:0" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in
      </button>
    `;
  }
}

// ─── Progress stats ───────────────────────────────────────────────────────────
// mastered : repetitions ≥ 3  (3 correct in a row with increasing spacing)
// learning : 0 < repetitions < 3
// newCount : never practiced (no record or repetitions === 0)
// dueCount : nextReview ≤ now

function getProgressStats(progressMap, totalItems) {
  const now = Date.now();
  let mastered = 0, learning = 0, due = 0;

  for (const prog of Object.values(progressMap)) {
    const reps = prog.repetitions || 0;
    if (reps >= 3)      mastered++;
    else if (reps > 0)  learning++;
    if (reps > 0 && prog.nextReview <= now) due++;
  }

  return {
    mastered,
    learning,
    newCount: Math.max(0, totalItems - mastered - learning),
    dueCount: due,
    total:    totalItems,
  };
}

// Like getProgressStats but filters progressMap to only keys containing `substr`.
// Use suffix = '_en-to-da', '_da-to-en', '_group', '_pronunciation_' etc.
function getProgressStatsByType(progressMap, substr, totalItems) {
  const filtered = {};
  for (const [k, v] of Object.entries(progressMap)) {
    if (k.includes(substr)) filtered[k] = v;
  }
  return getProgressStats(filtered, totalItems);
}
