# 🇩🇰 Danish Practice

A mobile-first web app for practising Danish vocabulary, hosted on GitHub Pages.

**Live app → [rbasniak.github.io/danish-exercises](https://rbasniak.github.io/danish-exercises)**

---

## Features

### Subjects
| Subject | Status |
|---------|--------|
| 📝 Verbs | ✅ Available |
| 🔠 Nouns | 🔜 Coming soon |
| 💬 Phrases | 🔜 Coming soon |

### Verb exercises

Three exercise modes using the **top 100 most common Danish verbs**:

| Mode | Description |
|------|-------------|
| 🇬🇧 → 🇩🇰 Translate to Danish | See the English meaning, pick the correct Danish infinitive |
| 🇩🇰 → 🇬🇧 Translate to English | See a Danish verb, pick its English meaning |
| 🗂 Conjugation Group | Classify the verb as **-ede**, **-te**, or **Irregular** |

### Smart distractors
- **EN→DA mode**: wrong answers are visually similar verbs (e.g. *at tale / at tage / at tro / at tænke*), so you really have to think
- **DA→EN mode**: wrong answers have similar meanings (e.g. *believe / think / mean / seem*)
- **Group mode**: questions are balanced ~⅓ from each conjugation class

### Other options
- **Question count**: 5 / 10 / 15 / 20
- **Time limit per question**: No limit / 30 s / 15 s
- **Audio**: auto-play Danish TTS pronunciation after each answer (uses the Web Speech API with `da-DK` locale); can be turned off for silent practice

### Feedback screen
After each answer a full-screen overlay shows ✓ or ✗, the correct answer, and (in group mode) the past-tense form as a reinforcement hint. A 🔊 button lets you replay the pronunciation; tapping anywhere else advances to the next question.

---

## Tech stack

Pure HTML / CSS / JavaScript — no build step, no framework, no dependencies except:
- [Twemoji](https://github.com/twitter/twemoji) — cross-platform emoji rendering (flags, icons)
- Web Speech API — Danish TTS (built into all modern browsers)

---

## Project structure

```
danish-exercises/
├── index.html           Home page (subject cards)
├── verbs-config.html    Exercise configuration
├── exercise.html        Exercise runner + summary screen
├── css/
│   └── style.css        All styles — dark theme, mobile-first
└── js/
    ├── verbs-data.js    100 verb entries + writing/meaning similarity clusters
    └── exercise.js      Exercise generation, timer, TTS, scoring logic
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

1. Go to **Settings → Pages** in this repository
2. Set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`
3. Save — the app will be live at `https://rbasniak.github.io/danish-exercises`
