# The Giving Index — Deploy, Login, Save Charities Design

## Summary

Fix existing bugs, add sign-up and Firestore-backed saved charities, polish the UI, add code comments, and deploy the frontend to Firebase Hosting with the NLP backend on Render.

## Priority Note

Firestore security rules expire on 2026-03-22 (2 days from today). The Firestore rules update (Section 2) must be deployed before any other work that touches Firestore, to avoid the app breaking if implementation takes more than 2 days.

## 0. Firebase SDK Strategy

Currently, `login.js` uses ESM imports with bare specifiers (`import { initializeApp } from "firebase/app"`), which only work via CDN import maps or a bundler. The project has no build step.

**Approach:** Use Firebase CDN with ES module imports consistently across all files. All scripts (`login.js`, `home.js`, `saved.js`) will use `type="module"` and import Firebase from the CDN (e.g., `https://www.gstatic.com/firebasejs/11.x.x/firebase-app.js`). Create a shared `firebase-config.js` module that initializes the Firebase app and exports `auth` and `db` (Firestore) instances, so each page just imports what it needs.

This means:
- `index.html` must change `<script src="home.js" defer>` to `<script type="module" src="home.js">`
- `home.html` already uses `<script type="module" src="saved.js">`, so no change needed there
- All JS files import from `firebase-config.js` instead of initializing Firebase independently
- `charitydatabase.json` must be moved into `public/` so it's accessible via `fetch('./charitydatabase.json')` when served by Firebase Hosting

## 1. Bug Fixes & Core Functionality

### Charity Loading Bug
`home.js` declares `charities = []` but never fetches `charitydatabase.json`. Add a `fetch('./charitydatabase.json')` call on page load to populate the array before matching can occur.

### Back Button Bug
`index.html` has a `<button id="backToInput">` but `home.js` has no event listener for it. Wire it up to navigate back to Step 1.

### Paginated Results
All 100 charities are scored in memory (the dataset is small). Display the top 10 matched charities initially. A "See more..." button at the bottom renders the next 10 from the in-memory sorted array, repeating until all results are shown. The button disappears when no more results remain. Clicking "Start Over" resets pagination state along with everything else.

### Sign-Up Flow
`login.html` already has a `<a id="signupLink">Sign up</a>` element. Wire this up to toggle the form between Sign In and Sign Up modes (add a confirm password field in sign-up mode). Sign-up uses Firebase `createUserWithEmailAndPassword()`. Both sign-in and sign-up redirect to `index.html` (the wizard) — this is the logical landing page since new users have no saved charities, and returning users likely want to discover more. This includes changing the existing sign-in redirect from `home.html` to `index.html`.

### Logout
Add a logout button in the header/nav area on both `index.html` and `home.html`. On click: calls Firebase `signOut()`, clears `sessionStorage`, and redirects to `login.html`.

### Loading UX for NLP Requests
Show a loading spinner/message while charity results are being fetched from the NLP backend. Add a timeout (30 seconds) with a user-friendly error message if the backend doesn't respond, along with a note that the first request may be slow.

## 2. Firestore Migration & Security

### Data Structure
Replace localStorage with Firestore. Each saved charity is a document in a user subcollection:

```
users/{userId}/savedCharities/{charityId}
  - id: number
  - name: string
  - mission: string
  - url: string
  - savedAt: timestamp
```

### Security Rules (DEPLOY FIRST)
Replace the expiring open-access rules with scoped rules:
- Users can only read/write documents under `users/{userId}/*`
- Must be authenticated (`request.auth != null`)
- `request.auth.uid` must match `{userId}` in the path
- No expiration date

### Auth Guards
Use `firebase.auth().onAuthStateChanged()` as the authoritative auth check on page load. If no authenticated user, redirect to `login.html`. Store `userId` in `sessionStorage` as a convenience for quick checks, but always verify the Firebase Auth session before Firestore operations.

## 3. UI Polish & Code Comments

### UI Cleanup
Same broad design, cleaner execution:
- Improve spacing and padding consistency across all pages
- Better font sizing hierarchy and line heights
- Refined charity card styling (subtle shadows, cleaner borders)
- Smoother transitions between wizard steps
- Better form styling on login (input focus states, button hover effects)
- Cleaner tag styling for values in Step 1
- Natural-feeling "See more..." button at the bottom of results
- Loading spinner for NLP requests

### Code Comments
Add general section-level comments in all JS files explaining what each block of code does. Not line-by-line annotations — broad comments like:
```js
// Firebase authentication setup
// Handle form submission and validate inputs
// Fetch charity data and calculate similarity scores
```

## 4. Deployment

### Firebase Hosting (Frontend)
- Initialize Firebase Hosting if not already configured
- Set `firebase.json` to serve the `public/` directory
- Move `charitydatabase.json` into `public/`
- Deploy with `firebase deploy --only hosting`

### Render (NLP Backend)
- Add `requirements.txt` with: flask, flask-cors, sentence-transformers
- Update `nlp_server.py` to read port from `PORT` environment variable (Render assigns this)
- Remove debug mode for production
- Keep `CORS(app)` allowing all origins (sufficient for this project's scope)
- Define the NLP API URL as a named constant at the top of `home.js` (with a comment for switching between local and production), and update it to the deployed Render URL

### Trade-off
Render free tier spins down after inactivity. First request after idle may take 30-60 seconds while the sentence-transformers model loads. The loading spinner (Section 1) mitigates UX impact.

## Out of Scope
- Weighted scoring: `calculateWeightedScore()` currently ignores rank weights and returns raw similarity. This is a pre-existing design decision — all keywords are sent as a flat list to the NLP endpoint. Fixing this would require changes to the matching algorithm and is not part of this work.

## Files Modified

| File | Changes |
|------|---------|
| `public/firebase-config.js` | New file — shared Firebase app/auth/Firestore initialization |
| `public/login.html` | Add sign-up toggle UI, confirm password field |
| `public/login.js` | Refactor to use shared config, add sign-up logic, fix redirect to index.html, code comments |
| `public/index.html` | Change script to type="module", add logout button in header |
| `public/home.js` | Fix charity loading, back button, paginated results, Firestore save, auth guard with onAuthStateChanged, logout, loading spinner, code comments |
| `public/home.html` | Add logout button in header |
| `public/saved.js` | Migrate from localStorage to Firestore, use shared config, code comments |
| `public/style.css` | UI polish (spacing, typography, cards, forms, transitions, spinner) |
| `public/charitydatabase.json` | Move from project root into public/ |
| `firestore.rules` | Scoped per-user security rules (deploy first) |
| `nlp_server.py` | Read PORT from env, remove debug mode, code comments |
| `requirements.txt` | New file — Python dependencies for Render |
| `firebase.json` | New file or update — Firebase Hosting configuration |
