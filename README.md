# 🇩🇰 Danish Practice

A mobile-first web app for practising Danish vocabulary, hosted on GitHub Pages.

**Live app → [rbasniak.github.io/ov-dansk](https://rbasniak.github.io/ov-dansk)**

---

## Subjects & Exercise Types

### 📝 Verbs

Practise using the **top 100** or **top 500** most common Danish verbs.

| Exercise type | Description |
|---------------|-------------|
| 🇬🇧 → 🇩🇰 Translate to Danish | See the English meaning, pick the correct Danish infinitive |
| 🇩🇰 → 🇬🇧 Translate to English | See a Danish verb, pick its English meaning |
| 🗂 Conjugation group | Classify the verb as **-ede**, **-te**, or **Irregular** |
| 🗣 Pronunciation | Each tense form (infinitive, imperative, present, past, perfect) is shown individually — speak it aloud, tap to hear it, then self-assess |

**Smart distractors**
- EN→DA: wrong answers are visually similar verbs (e.g. *at tale / at tage / at tro*)
- DA→EN: wrong answers have related meanings (e.g. *believe / think / mean / seem*)
- Conjugation group: questions are balanced ~⅓ from each conjugation class

---

### 📖 Nouns

Practise using nouns organised by **semantic category** (food, animals, body, etc.). You can select one or more categories per session.

| Exercise type | Description |
|---------------|-------------|
| 🇬🇧 → 🇩🇰 Translate to Danish | See the English meaning, pick the correct Danish noun |
| 🇩🇰 → 🇬🇧 Translate to English | See a Danish noun, pick its English meaning |
| ⚥ Gender | Is this noun **en** or **et**? |
| 🗂 Plural class | Classify the noun: **-er**, **-e**, **unchanged**, **vowel change**, or **irregular** |
| 🗣 Pronunciation | Each form (indefinite, definite, plural, definite plural) is shown individually — speak it aloud, tap to hear it, then self-assess. Mass nouns only have 2 forms. |

**Feedback card**: after every answer, a full info card is shown with all four noun forms and individual 🔊 buttons for each — good reinforcement even on correct answers.

---

### 🔢 Numbers

Randomly generated Danish number exercises.

| Exercise type | Description |
|---------------|-------------|
| 🔊 Hear the number | Listen to a Danish number (TTS), pick the correct numeral |
| 🔢 Find the written form | See a numeral, pick how it is written in Danish |

**Adaptive tracking by pattern, not by exact number**: the number space (1–9999) is too large to track individual values with spaced repetition — a given exact number rarely repeats. Instead, numbers are classified into **13 pattern buckets** that map onto the real sources of confusion in Danish:

`1–9` · `10–19 (teens)` · one bucket per tens-word (`tyve`, `tredive`, `fyrre`, `halvtreds`, `tres`, `halvfjerds`, `firs`, `halvfems` — the `halv-` group especially) · round hundreds · hundreds+remainder · thousands.

When signed in, each bucket is tracked with the same SM-2 algorithm as verbs/nouns (independently per exercise type). Session generation is **weighted**, not purely random — buckets that are new, due for review, or historically error-prone are sampled more often, while mastered/no-due buckets appear less. Anonymous users (or "no practice mode") still get fully random numbers as before.

---

## Adaptive Learning & Progress Tracking

### What is tracked

When signed in with Google, every answer you give is saved to Firestore and used to drive **spaced repetition (SM-2 algorithm)**. The following items are tracked **independently**:

**Verbs** (one Firestore document per verb per exercise type):
- `at hente` — Danish→English
- `at hente` — English→Danish
- `at hente` — Conjugation group
- `at hente` — Pronunciation (infinitive)
- `at hente` — Pronunciation (imperative)
- `at hente` — Pronunciation (present)
- `at hente` — Pronunciation (past)
- `at hente` — Pronunciation (perfect)

**Nouns** (one document per noun per exercise type):
- `hund` — Danish→English
- `hund` — English→Danish
- `hund` — Gender
- `hund` — Plural class
- `hund` — Pronunciation (indefinite)
- `hund` — Pronunciation (definite)
- `hund` — Pronunciation (plural)
- `hund` — Pronunciation (definite plural)

Knowing a word in one exercise type has **no effect** on any other type.

### What is NOT tracked

- **Unauthenticated sessions** — anonymous users can use the full app but nothing is saved
- Numbers are tracked by **pattern bucket**, not by exact value (see the Numbers section above) — no practice mode selected means fully random, untracked numbers

### Practice modes (logged-in only)

| Mode | Behaviour |
|------|-----------|
| 🔀 Mixed *(default)* | 70 % items due for review + 30 % new items, always guaranteed |
| 🌱 Learn | Only items you have never seen before |
| 🔁 Review | Only items that are due according to the spaced-repetition schedule |

### Mastery & spaced repetition

An item is considered **mastered** once you have answered it correctly **3 times in a row**, spaced out over time. The review intervals use the **SM-2 algorithm** with ±25 % randomised fuzz to prevent items clustering on the same date:

| Correct streak | Base interval | Actual range |
|---------------|---------------|--------------|
| 1st correct | 1 day | always 1 day |
| 2nd correct | 6 days | 4 – 8 days |
| 3rd correct *(mastered)* | 15 days | 11 – 19 days |
| 4th correct | ~37 days | ~30 – 44 days |

Any wrong answer or "I don't know" resets the streak and schedules the item for the next day.

### "I don't know" button

Logged-in users see a **💡 I don't know** button on every non-pronunciation question. Tapping it:
- Counts as a wrong answer for the spaced-repetition algorithm
- Shows the correct answer immediately (without guessing)
- Does **not** count toward the score

This is useful when you genuinely don't know — guessing and accidentally getting it right would mislead the algorithm into thinking you've learned it.

### Progress page

The **My Progress** page (accessible from the user avatar in the header) shows a breakdown by subject and exercise type:
- **Mastered** — 3 correct in a row *(green)*
- **Learning** — seen at least once *(blue)*
- **New** — never practiced
- **Due** — scheduled for review today

---

## Session options

All subjects share these configurable options:

| Option | Values |
|--------|--------|
| Number of questions | 10 / 20 / 50 / ALL |
| Time per question | No limit / 30 s / 15 s |
| Audio | On (auto-play TTS after each answer) / Off |

---

## Tech stack

Pure HTML / CSS / JavaScript — no build step, no framework, no dependencies except:
- [Twemoji](https://github.com/twitter/twemoji) — cross-platform emoji rendering
- Web Speech API — Danish TTS (`da-DK`, built into all modern browsers)
- [Firebase](https://firebase.google.com) — Google Auth + Firestore (optional; app works fully without it for anonymous users)

---

## Project structure

```
ov-dansk/
├── index.html                Home page (subject cards)
├── verbs-config.html         Verb exercise configuration
├── exercise.html             Verb exercise runner + summary
├── nouns-config.html         Noun exercise configuration
├── nouns-exercise.html       Noun exercise runner + summary
├── numbers-config.html       Number exercise configuration
├── numbers-exercise.html     Number exercise runner + summary
├── progress.html             Progress dashboard (logged-in users)
├── css/
│   └── style.css             All styles — dark theme, mobile-first
└── js/
    ├── firebase.js           Firebase config, auth, SM-2, Firestore helpers
    ├── config-prefs.js       localStorage persistence for config settings
    ├── verbs-data.js         Verb entries + distractor clusters
    ├── exercise.js           Verb exercise logic
    ├── nouns-data.js         Noun entries by category
    ├── nouns-exercise.js     Noun exercise logic
    ├── numbers-data.js       Number generation + distractor logic
    └── numbers-exercise.js   Number exercise logic
```

---

## Firebase Setup

To enable adaptive learning (progress tracking, spaced repetition), you need a free Firebase project.

### 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**
2. Enter a project name (e.g. `ov-dansk`) and follow the wizard (you can disable Google Analytics)

### 2. Enable Google Authentication

1. In the Firebase console, go to **Authentication → Sign-in method**
2. Enable **Google** as a provider
3. Set your email as the support email and save

### 3. Create the Firestore database

1. Go to **Firestore Database → Create database**
2. Choose **Start in production mode** and select a region (e.g. `europe-west1`)
3. After creation, go to the **Rules** tab and replace the content with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

4. Click **Publish**

### 4. Register the web app and get the config

1. In **Project Settings** (gear icon) → **Your apps**, click **Add app → Web** (`</>`)
2. Register the app (nickname e.g. `ov-dansk-web`); no need to set up Firebase Hosting
3. Copy the `firebaseConfig` object shown

### 5. Paste the config into the project

Open `js/firebase.js` and replace the placeholder values in `FIREBASE_CONFIG`:

```js
const FIREBASE_CONFIG = {
  apiKey:            'YOUR_ACTUAL_API_KEY',
  authDomain:        'your-project-id.firebaseapp.com',
  projectId:         'your-project-id',
  storageBucket:     'your-project-id.appspot.com',
  messagingSenderId: '123456789',
  appId:             '1:123456789:web:abc123...',
};
```

### 6. Add your domain to the authorised list

1. In **Authentication → Settings → Authorised domains**
2. Add `rbasniak.github.io` (or whatever domain you use)

That's it — deploy to GitHub Pages and sign in with Google to start tracking progress.

---

## Deploying to GitHub Pages

1. Go to **Settings → Pages** in this repository
2. Set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`
3. Save — the app will be live at `https://rbasniak.github.io/ov-dansk`

