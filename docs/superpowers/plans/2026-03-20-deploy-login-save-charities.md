# The Giving Index — Deploy, Login & Save Charities Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, add sign-up/logout, migrate saved charities to Firestore, add paginated results, polish UI, and deploy to Firebase Hosting + Render.

**Architecture:** Vanilla HTML/CSS/JS frontend served by Firebase Hosting. Shared `firebase-config.js` module exports Firebase app, auth, and Firestore instances. Flask NLP backend deployed on Render. All JS files use ES module imports via Firebase CDN.

**Tech Stack:** Firebase Auth, Firestore, Firebase Hosting, Flask, sentence-transformers, vanilla JS (ES modules)

**Spec:** `docs/superpowers/specs/2026-03-20-deploy-login-save-charities-design.md`

---

## Chunk 1: Foundation & Security

### Task 1: Update Firestore Security Rules (URGENT — rules expire 2026-03-22)

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Replace firestore.rules with scoped per-user rules**

Replace the entire contents of `firestore.rules` with:

```
rules_version='2'

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 2: Deploy rules immediately**

Run: `firebase deploy --only firestore:rules`
Expected: "Deploy complete!" message. Rules are now live and won't expire.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "fix: replace expiring Firestore rules with scoped per-user auth rules"
```

---

### Task 2: Create shared Firebase config module

**Files:**
- Create: `public/firebase-config.js`

- [ ] **Step 1: Create `public/firebase-config.js`**

```js
// Shared Firebase configuration and service initialization
// All pages import auth and db from this module instead of initializing independently

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDpkQ1drURiEpt_KSlSlXWZy26hFSD0nEI",
  authDomain: "charity-project-5fc71.firebaseapp.com",
  projectId: "charity-project-5fc71",
  storageBucket: "charity-project-5fc71.firebasestorage.app",
  messagingSenderId: "542041302670",
  appId: "1:542041302670:web:0ae74f93a0669fa2e94bdf",
  measurementId: "G-CKTQFVH6K7"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, onAuthStateChanged };
```

- [ ] **Step 2: Commit**

```bash
git add public/firebase-config.js
git commit -m "feat: add shared Firebase config module with auth and Firestore exports"
```

---

### Task 3: Move charitydatabase.json into public/

**Files:**
- Move: `charitydatabase.json` → `public/charitydatabase.json`

- [ ] **Step 1: Move the file**

Run: `mv charitydatabase.json public/charitydatabase.json`

- [ ] **Step 2: Commit**

```bash
git add charitydatabase.json public/charitydatabase.json
git commit -m "chore: move charitydatabase.json into public/ for Firebase Hosting"
```

---

## Chunk 2: Login Page — Sign-Up & Shared Config

### Task 4: Refactor login.html for sign-up toggle and confirm password

**Files:**
- Modify: `public/login.html`

- [ ] **Step 1: Add confirm password field and move script inside body**

In `login.html`, add a confirm password form group after the password group (hidden by default), and move the script tag inside `</body>`. Replace everything from line 20 through the end of the file with:

```html
            <form id="loginForm" class="login-form">
                <div class="form-group">
                    <label for="loginEmail" class="form-label">Email</label>
                    <input type="email" id="loginEmail" class="form-input" placeholder="you@example.com" required autocomplete="email">
                </div>
                <div class="form-group">
                    <label for="loginPassword" class="form-label">Password</label>
                    <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required autocomplete="current-password">
                </div>
                <div class="form-group" id="confirmPasswordGroup" style="display: none;">
                    <label for="confirmPassword" class="form-label">Confirm Password</label>
                    <input type="password" id="confirmPassword" class="form-input" placeholder="••••••••" autocomplete="new-password">
                </div>
                <div id="loginError" class="error-message" role="alert"></div>
                <button type="submit" id="loginBtn" class="btn-login">Sign In</button>
            </form>

            <p class="login-footer">
                Don't have an account? <a href="#" class="signup-link" id="signupLink">Sign up</a>
            </p>
        </div>
    </div>
    <script type="module" src="login.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify login.html renders correctly**

Open `public/login.html` in a browser. Confirm the form looks the same as before (confirm password is hidden).

- [ ] **Step 3: Commit**

```bash
git add public/login.html
git commit -m "feat: add confirm password field and sign-up toggle UI to login page"
```

---

### Task 5: Refactor login.js — shared config, sign-up, redirect fix

**Files:**
- Modify: `public/login.js`

- [ ] **Step 1: Rewrite login.js to use shared config and add sign-up**

Replace the entire contents of `public/login.js` with:

```js
// Firebase authentication — sign-in and sign-up logic
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";

// DOM elements
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const confirmPassword = document.getElementById("confirmPassword");
const confirmPasswordGroup = document.getElementById("confirmPasswordGroup");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const signupLink = document.getElementById("signupLink");
const loginSubtitle = document.querySelector(".login-subtitle");
const loginFooter = document.querySelector(".login-footer");

let isSignUpMode = false;

// Display error message to user
function showError(message) {
  loginError.textContent = message;
  loginError.classList.add("show");
}

// Clear any displayed error
function clearError() {
  loginError.textContent = "";
  loginError.classList.remove("show");
}

// Toggle button loading state
function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtn.textContent = loading
    ? (isSignUpMode ? "Creating account…" : "Signing in…")
    : (isSignUpMode ? "Sign Up" : "Sign In");
}

// Toggle between sign-in and sign-up modes
function toggleMode() {
  isSignUpMode = !isSignUpMode;
  clearError();

  confirmPasswordGroup.style.display = isSignUpMode ? "block" : "none";
  confirmPassword.required = isSignUpMode;
  loginBtn.textContent = isSignUpMode ? "Sign Up" : "Sign In";
  loginSubtitle.textContent = isSignUpMode
    ? "Create an account to start finding charities"
    : "Sign in to find charities that align with your values";
  loginFooter.innerHTML = isSignUpMode
    ? 'Already have an account? <a href="#" class="signup-link" id="signupLink">Sign in</a>'
    : 'Don\'t have an account? <a href="#" class="signup-link" id="signupLink">Sign up</a>';

  // Re-attach click handler to the new link element
  document.getElementById("signupLink").addEventListener("click", (e) => {
    e.preventDefault();
    toggleMode();
  });
}

// Attach sign-up/sign-in toggle
signupLink.addEventListener("click", (e) => {
  e.preventDefault();
  toggleMode();
});

// Handle form submission for both sign-in and sign-up
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  // Validate confirm password in sign-up mode
  if (isSignUpMode) {
    if (password !== confirmPassword.value) {
      showError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      showError("Password must be at least 6 characters.");
      return;
    }
  }

  setLoading(true);

  try {
    const userCredential = isSignUpMode
      ? await createUserWithEmailAndPassword(auth, email, password)
      : await signInWithEmailAndPassword(auth, email, password);

    const user = userCredential.user;
    sessionStorage.setItem("userId", user.uid);
    window.location.href = "index.html";
  } catch (error) {
    setLoading(false);

    // Human-readable messages for common Firebase Auth errors
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential": "Invalid email or password. Please try again.",
      "auth/too-many-requests": "Too many failed attempts. Please try again later.",
      "auth/network-request-failed": "Network error. Please check your connection.",
      "auth/email-already-in-use": "An account with this email already exists.",
      "auth/weak-password": "Password must be at least 6 characters."
    };

    showError(messages[error.code] || error.message || "Something went wrong. Please try again.");
  }
});
```

- [ ] **Step 2: Test sign-in and sign-up in browser**

Open `public/login.html`. Test:
1. Click "Sign up" — confirm password field appears, button says "Sign Up"
2. Click "Sign in" — confirm password field hides, button says "Sign In"
3. Sign in with existing account — redirects to `index.html`
4. Sign up with new account — redirects to `index.html`

- [ ] **Step 3: Commit**

```bash
git add public/login.js
git commit -m "feat: add sign-up flow, use shared Firebase config, fix redirect to index.html"
```

---

## Chunk 3: Wizard Page — Bug Fixes, Auth, Logout, Firestore Save

### Task 6: Rewrite home.js with all fixes and features

**Files:**
- Modify: `public/home.js`
- Modify: `public/index.html`

- [ ] **Step 1: Update index.html — add logout button and change script to module**

In `public/index.html`, replace the header section (lines 14-18) with:

```html
        <header class="hero">
            <div class="hero-nav">
                <a href="home.html" class="btn-outline btn-small">My Saved Charities</a>
                <button id="logoutBtn" class="btn-outline btn-small">Log Out</button>
            </div>
            <h1 class="hero-title">The Giving Index</h1>
            <p class="hero-subtitle">Tell us what matters to you, and we'll connect you with causes that align with your values</p>
        </header>
```

And replace the script tag (line 64) with:

```html
    <script type="module" src="home.js"></script>
```

- [ ] **Step 2: Rewrite home.js with all fixes**

Replace the entire contents of `public/home.js` with:

```js
// Firebase imports for auth guard, logout, and Firestore save
import { auth, db, onAuthStateChanged } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// NLP backend URL — update to Render URL after deployment (Task 11)
const API_URL = "http://127.0.0.1:5000/similarity";

let userValues = [];
let charities = [];
let currentResults = [];
let visibleCount = 0;
const PAGE_SIZE = 10;

// ── DOM elements ──

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");

const valueInput = document.getElementById("valueInput");
const addValueBtn = document.getElementById("addValueBtn");
const valuesList = document.getElementById("valuesList");
const errorMessage = document.getElementById("errorMessage");

const proceedToRanking = document.getElementById("proceedToRanking");
const rankingList = document.getElementById("rankingList");
const findCharitiesBtn = document.getElementById("findCharities");

const charitiesList = document.getElementById("charitiesList");

// ── Auth guard — redirect to login if not authenticated ──

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    sessionStorage.setItem("userId", user.uid);
  }
});

// ── Logout ──

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.removeItem("userId");
  window.location.href = "login.html";
});

// ── Load charity data from JSON ──

async function loadCharities() {
  try {
    const response = await fetch("./charitydatabase.json");
    charities = await response.json();
  } catch (error) {
    console.error("Failed to load charity data:", error);
  }
}

loadCharities();

// ── Step navigation ──

function showStep(step) {
  [step1, step2, step3].forEach(s => s.classList.remove("active"));
  step.classList.add("active");
}

// ── Step 1: Add values ──

addValueBtn.addEventListener("click", () => {
  const value = valueInput.value.trim().toLowerCase();

  if (!value) {
    errorMessage.textContent = "Please enter a value";
    return;
  }

  if (userValues.includes(value)) {
    errorMessage.textContent = "Value already added";
    return;
  }

  userValues.push(value);
  valueInput.value = "";
  errorMessage.textContent = "";

  renderValues();
  proceedToRanking.disabled = userValues.length < 2;
});

// Allow pressing Enter to add a value
valueInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addValueBtn.click();
  }
});

function renderValues() {
  valuesList.innerHTML = "";
  userValues.forEach(v => {
    const tag = document.createElement("span");
    tag.className = "value-tag";
    tag.textContent = v;
    valuesList.appendChild(tag);
  });
}

proceedToRanking.addEventListener("click", () => {
  renderRanking();
  showStep(step2);
});

// ── Step 2: Rank values via drag-and-drop ──

function renderRanking() {
  rankingList.innerHTML = "";

  userValues.forEach(value => {
    const item = document.createElement("div");
    item.className = "ranking-item";
    item.textContent = value;
    item.draggable = true;

    item.addEventListener("dragstart", dragStart);
    item.addEventListener("dragover", dragOver);
    item.addEventListener("drop", drop);

    rankingList.appendChild(item);
  });

  findCharitiesBtn.disabled = false;
}

let draggedItem = null;

function dragStart() {
  draggedItem = this;
}

function dragOver(e) {
  e.preventDefault();
}

function drop(e) {
  e.preventDefault();
  if (draggedItem !== this) {
    const items = [...rankingList.children];
    const draggedIndex = items.indexOf(draggedItem);
    const droppedIndex = items.indexOf(this);

    rankingList.insertBefore(
      draggedItem,
      draggedIndex < droppedIndex ? this.nextSibling : this
    );
  }
}

// Back button — return to Step 1
document.getElementById("backToInput").addEventListener("click", () => {
  showStep(step1);
});

// ── NLP similarity scoring ──

function getWeightedKeywords() {
  const ranked = [...rankingList.children].map(i => i.textContent);
  const maxWeight = ranked.length;

  return ranked.map((word, index) => ({
    word,
    weight: maxWeight - index
  }));
}

// ── Find charities and display results ──

findCharitiesBtn.addEventListener("click", async () => {
  if (charities.length === 0) {
    alert("Charity data still loading. Please try again.");
    return;
  }

  // Show loading spinner
  showStep(step3);
  charitiesList.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Finding your best charity matches...</p><p class="loading-note">This may take up to 30 seconds on first load</p></div>';

  const weightedKeywords = getWeightedKeywords();

  try {
    const results = [];
    for (const charity of charities) {
      // Per-request timeout of 30 seconds (handles Render cold starts)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: weightedKeywords.map(k => k.word),
          mission: charity.mission
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await response.json();
      results.push({ ...charity, score: data.similarity });
    }

    results.sort((a, b) => b.score - a.score);

    // Store results and show first page
    currentResults = results;
    visibleCount = 0;
    charitiesList.innerHTML = "";
    showMoreResults();
  } catch (error) {
    if (error.name === "AbortError") {
      charitiesList.innerHTML = '<div class="loading-error"><p>The server took too long to respond. It may be starting up — please try again in a moment.</p></div>';
    } else {
      charitiesList.innerHTML = '<div class="loading-error"><p>Something went wrong connecting to the matching service. Please check your connection and try again.</p></div>';
    }
  }
});

// ── Paginated results — show 10 at a time ──

function showMoreResults() {
  const nextBatch = currentResults.slice(visibleCount, visibleCount + PAGE_SIZE);
  nextBatch.forEach(c => {
    const card = document.createElement("div");
    card.className = "charity-card";

    card.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.mission}</p>
      <a href="${c.url}" target="_blank" rel="noopener" class="charity-link">${c.url}</a>
      <strong class="match-score">Match: ${(c.score * 100).toFixed(1)}%</strong>
      <button type="button" class="btn-save">Add to My Charities</button>
    `;

    // Save charity to Firestore on click
    const btn = card.querySelector(".btn-save");
    btn.addEventListener("click", () => {
      if (btn.classList.contains("saved")) return;
      saveCharityToFirestore({ name: c.name, mission: c.mission, url: c.url, id: c.id });
      btn.classList.add("saved");
      btn.textContent = "Saved ✓";
    });

    charitiesList.appendChild(card);
  });

  visibleCount += nextBatch.length;

  // Remove existing "See more" button if present
  const existingBtn = document.getElementById("seeMoreBtn");
  if (existingBtn) existingBtn.remove();

  // Add "See more" button if there are more results
  if (visibleCount < currentResults.length) {
    const seeMoreBtn = document.createElement("button");
    seeMoreBtn.id = "seeMoreBtn";
    seeMoreBtn.className = "btn-secondary see-more-btn";
    seeMoreBtn.textContent = `See more charities (${currentResults.length - visibleCount} remaining)`;
    seeMoreBtn.addEventListener("click", showMoreResults);
    charitiesList.after(seeMoreBtn);
  }
}

// ── Save charity to Firestore ──

async function saveCharityToFirestore(charity) {
  const userId = sessionStorage.getItem("userId");
  if (!userId) return;

  try {
    const savedRef = collection(db, "users", userId, "savedCharities");

    // Check for duplicates by charity name
    const existing = await getDocs(query(savedRef));
    const alreadySaved = existing.docs.some(d => d.data().name === charity.name);
    if (alreadySaved) return;

    await addDoc(savedRef, {
      ...charity,
      savedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to save charity:", error);
  }
}

// ── Reset / Start Over ──

document.getElementById("startOver").addEventListener("click", () => {
  userValues = [];
  currentResults = [];
  visibleCount = 0;
  renderValues();
  valueInput.value = "";
  proceedToRanking.disabled = true;
  findCharitiesBtn.disabled = true;

  // Remove "See more" button if present
  const seeMoreBtn = document.getElementById("seeMoreBtn");
  if (seeMoreBtn) seeMoreBtn.remove();

  showStep(step1);
});
```

- [ ] **Step 3: Test in browser**

1. Open `public/index.html` — should redirect to login if not authenticated
2. Log in → should land on index.html
3. Add 2+ values, rank them, click "Find My Charities"
4. Verify loading spinner appears
5. Verify results display (first 10) with "See more" button
6. Click "See more" — next 10 load
7. Save a charity — button changes to "Saved ✓"
8. Click logout — returns to login page
9. Click "Back" button in Step 2 — returns to Step 1

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/home.js
git commit -m "feat: rewrite wizard page — auth guard, charity loading, pagination, Firestore save, logout"
```

---

## Chunk 4: Saved Charities Page — Firestore Migration

### Task 7: Rewrite saved.js for Firestore and update home.html with logout

**Files:**
- Modify: `public/saved.js`
- Modify: `public/home.html`

- [ ] **Step 1: Update home.html — add logout button**

In `public/home.html`, replace the header section (lines 14-18) with:

```html
        <header class="hero hero-home">
            <div class="hero-nav">
                <a href="index.html" class="btn-primary btn-small find-charities-btn">Find More Charities</a>
                <button id="logoutBtn" class="btn-outline btn-small">Log Out</button>
            </div>
            <h1 class="hero-title">My Saved Charities</h1>
            <p class="hero-subtitle">Charities you've saved from your recommendations</p>
        </header>
```

- [ ] **Step 2: Rewrite saved.js to use Firestore**

Replace the entire contents of `public/saved.js` with:

```js
// Saved charities page — loads and manages charities from Firestore
import { auth, db, onAuthStateChanged } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  collection, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

const savedCharitiesList = document.getElementById("savedCharitiesList");
const emptyState = document.getElementById("emptyState");

// ── Auth guard — wait for auth state before loading data ──

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    sessionStorage.setItem("userId", user.uid);
    loadSavedCharities(user.uid);
  }
});

// ── Logout ──

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  sessionStorage.removeItem("userId");
  window.location.href = "login.html";
});

// ── Load saved charities from Firestore ──

async function loadSavedCharities(userId) {
  try {
    const savedRef = collection(db, "users", userId, "savedCharities");
    const snapshot = await getDocs(savedRef);

    const charities = snapshot.docs.map(d => ({
      docId: d.id,
      ...d.data()
    }));

    renderSavedCharities(charities, userId);
  } catch (error) {
    console.error("Failed to load saved charities:", error);
    savedCharitiesList.innerHTML = '<p class="loading-error">Failed to load your saved charities. Please try again.</p>';
  }
}

// ── Render saved charity cards ──

function renderSavedCharities(charities, userId) {
  if (charities.length === 0) {
    savedCharitiesList.innerHTML = "";
    savedCharitiesList.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  savedCharitiesList.style.display = "grid";
  savedCharitiesList.innerHTML = "";

  charities.forEach(c => {
    const card = document.createElement("div");
    card.className = "charity-card";
    card.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.mission}</p>
      <a href="${c.url}" target="_blank" rel="noopener" class="charity-link">${c.url}</a>
      <button type="button" class="btn-save btn-remove">Remove</button>
    `;

    // Remove charity from Firestore on click
    card.querySelector(".btn-remove").addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "users", userId, "savedCharities", c.docId));
        card.remove();

        // Show empty state if no charities left
        if (savedCharitiesList.children.length === 0) {
          savedCharitiesList.style.display = "none";
          emptyState.style.display = "block";
        }
      } catch (error) {
        console.error("Failed to remove charity:", error);
      }
    });

    savedCharitiesList.appendChild(card);
  });
}
```

- [ ] **Step 3: Test in browser**

1. Navigate to `home.html` while logged out — should redirect to login
2. Log in, save a charity from the wizard, then visit `home.html`
3. Verify saved charity appears
4. Click "Remove" — charity disappears
5. Refresh page — charity stays removed (Firestore, not localStorage)
6. Click logout — returns to login

- [ ] **Step 4: Commit**

```bash
git add public/home.html public/saved.js
git commit -m "feat: migrate saved charities from localStorage to Firestore, add logout"
```

---

## Chunk 5: UI Polish

### Task 8: Polish style.css for cleaner UI

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Replace style.css with polished version**

Replace the entire contents of `public/style.css` with the updated CSS below. Key changes:
- Better spacing and padding consistency
- Improved typography hierarchy (using Inter font from existing Google Fonts link)
- Refined card styling with subtle shadows on hover
- Better form input focus states with subtle blue glow
- Cleaner value tags
- Loading spinner and error styles
- "See more" button styling
- Hero nav layout for logout button
- Small button variant
- Smoother transitions

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary: #3b82f6;
    --primary-dark: #2563eb;
    --secondary: #10b981;
    --accent: #06b6d4;
    --bg: #ffffff;
    --bg-light: #f8fafc;
    --bg-card: #ffffff;
    --text: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --border-hover: #cbd5e1;
    --success: #10b981;
    --danger: #ef4444;
    --gradient: #10b981;
}

body {
    font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    background: var(--bg-light);
    color: var(--text);
    min-height: 100vh;
    padding: 2rem;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
}

.container {
    max-width: 880px;
    margin: 0 auto;
}

/* ── Hero Section ── */

.hero {
    text-align: center;
    padding: 3.5rem 2rem 2.5rem;
    background: var(--bg);
    margin-bottom: 2.5rem;
    border: 1px solid var(--border);
}

.hero-nav {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-bottom: 2rem;
}

.hero-title {
    font-size: 2.75rem;
    font-weight: 700;
    color: var(--gradient);
    margin-bottom: 0.75rem;
    letter-spacing: -0.03em;
}

.hero-subtitle {
    font-size: 1.125rem;
    color: var(--text-muted);
    max-width: 560px;
    margin: 0 auto;
    line-height: 1.7;
}

/* ── Steps ── */

.step {
    display: none;
    animation: fadeIn 0.4s ease-out;
}

.step.active {
    display: block;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}

.step-header {
    text-align: center;
    margin-bottom: 2.5rem;
}

.step-number {
    display: inline-block;
    width: 44px;
    height: 44px;
    background: var(--gradient);
    color: white;
    line-height: 44px;
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.75rem;
}

.step-header h2 {
    font-size: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: var(--text);
}

.step-header p {
    color: var(--text-muted);
    font-size: 1.05rem;
}

/* ── Input Section ── */

.input-section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 1.75rem;
    margin-bottom: 1.5rem;
}

.input-group {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
}

.value-input {
    flex: 1;
    padding: 0.875rem 1.25rem;
    background: var(--bg-light);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 0.95rem;
    font-family: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.value-input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--bg);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.value-input::placeholder {
    color: var(--text-muted);
}

.error-message {
    color: var(--danger);
    font-size: 0.875rem;
    margin-top: 0.25rem;
    margin-bottom: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.25s ease;
    pointer-events: none;
}

.error-message.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

/* ── Buttons ── */

.btn-primary, .btn-secondary, .btn-outline {
    padding: 0.875rem 1.75rem;
    border: none;
    font-size: 0.95rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.btn-small {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
}

.btn-primary {
    background: var(--gradient);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
}

.btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.btn-secondary {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    width: 100%;
    margin-top: 0.75rem;
}

.btn-secondary:hover:not(:disabled) {
    border-color: var(--border-hover);
    background: var(--bg-light);
}

.btn-outline {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
}

.btn-outline:hover {
    border-color: var(--border-hover);
    background: var(--bg-light);
}

.button-group {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
}

.button-group .btn-primary,
.button-group .btn-outline {
    flex: 1;
}

/* ── Values List ── */

.values-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
}

.value-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-light);
    border: 1px solid var(--border);
    font-size: 0.9rem;
    color: var(--text);
    animation: slideIn 0.25s ease;
    transition: border-color 0.2s ease;
}

.value-tag:hover {
    border-color: var(--border-hover);
}

@keyframes slideIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}

/* ── Ranking List ── */

.ranking-list {
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 1.25rem;
    margin-bottom: 1.5rem;
}

.ranking-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--bg-light);
    border: 1px solid var(--border);
    margin-bottom: 0.625rem;
    cursor: move;
    transition: all 0.2s ease;
    font-weight: 500;
}

.ranking-item:last-child {
    margin-bottom: 0;
}

.ranking-item:hover {
    border-color: var(--primary);
    background: var(--bg);
}

.ranking-item.dragging {
    opacity: 0.5;
    border-color: var(--primary);
}

/* ── Charities List ── */

.charities-list {
    display: grid;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
}

.charity-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 1.75rem;
    transition: all 0.2s ease;
    animation: fadeIn 0.3s ease-out;
}

.charity-card:hover {
    border-color: var(--border-hover);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.charity-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text);
}

.charity-card p {
    color: var(--text-muted);
    margin-bottom: 0.75rem;
    line-height: 1.6;
    font-size: 0.95rem;
}

.charity-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--primary);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.2s ease;
    word-break: break-all;
}

.charity-link:hover {
    color: var(--primary-dark);
    text-decoration: underline;
}

.match-score {
    display: inline-block;
    margin-top: 0.75rem;
    padding: 0.375rem 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    color: var(--secondary);
    font-weight: 600;
    font-size: 0.85rem;
}

/* ── Save / Remove Buttons ── */

.btn-save {
    display: block;
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-family: inherit;
    font-weight: 500;
    background: var(--bg);
    color: var(--primary);
    border: 1px solid var(--primary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-save:hover {
    background: rgba(59, 130, 246, 0.06);
}

.btn-save.saved {
    background: var(--success);
    color: white;
    border-color: var(--success);
    cursor: default;
}

.btn-save.saved:hover {
    background: var(--success);
}

.btn-remove {
    background: var(--bg) !important;
    color: var(--danger) !important;
    border-color: var(--danger) !important;
}

.btn-remove:hover {
    background: #fef2f2 !important;
}

/* ── See More Button ── */

.see-more-btn {
    margin-top: 0.5rem;
    color: var(--text-muted);
    font-size: 0.9rem;
}

/* ── Loading Spinner ── */

.loading-spinner {
    text-align: center;
    padding: 3rem 1rem;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    margin: 0 auto 1.25rem;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-spinner p {
    color: var(--text-muted);
    font-size: 1rem;
    margin-bottom: 0.25rem;
}

.loading-note {
    font-size: 0.85rem !important;
    color: var(--text-muted);
    opacity: 0.7;
}

.loading-error {
    text-align: center;
    padding: 2.5rem 1.5rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: var(--danger);
    font-size: 0.95rem;
    line-height: 1.6;
}

/* ── Home Page Hero ── */

.hero-home {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
}

.hero-home .hero-nav {
    width: 100%;
}

.find-charities-btn {
    margin-top: 0.25rem;
}

/* ── Empty State ── */

.empty-state {
    text-align: center;
    padding: 3rem 2rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
}

.empty-state p {
    color: var(--text-muted);
    margin-bottom: 1.25rem;
    font-size: 1.05rem;
}

/* ── Login Page ── */

.login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
}

.login-card {
    width: 100%;
    max-width: 420px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 2.5rem;
}

.login-header {
    text-align: center;
    margin-bottom: 2rem;
}

.login-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--gradient);
    margin-bottom: 0.375rem;
    letter-spacing: -0.03em;
}

.login-subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
}

.login-form {
    margin-bottom: 1.5rem;
}

.form-group {
    margin-bottom: 1.25rem;
}

.form-label {
    display: block;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 0.375rem;
    font-size: 0.9rem;
}

.form-input {
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--bg-light);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 0.95rem;
    font-family: inherit;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-input:focus {
    outline: none;
    border-color: var(--primary);
    background: var(--bg);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder {
    color: var(--text-muted);
}

.btn-login {
    width: 100%;
    padding: 0.875rem 1.75rem;
    background: var(--gradient);
    color: white;
    border: none;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-top: 0.5rem;
}

.btn-login:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
}

.btn-login:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.login-footer {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.9rem;
}

.signup-link {
    color: var(--primary);
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s ease;
}

.signup-link:hover {
    color: var(--primary-dark);
    text-decoration: underline;
}

/* ── Responsive ── */

@media (max-width: 768px) {
    body {
        padding: 1rem;
    }

    .hero {
        padding: 2.5rem 1.5rem 2rem;
    }

    .hero-title {
        font-size: 2rem;
    }

    .hero-subtitle {
        font-size: 1rem;
    }

    .input-group {
        flex-direction: column;
    }

    .button-group {
        flex-direction: column;
    }

    .hero-nav {
        flex-direction: column;
        align-items: stretch;
    }

    .login-container {
        padding: 1rem;
    }

    .login-card {
        padding: 1.75rem;
    }

    .login-title {
        font-size: 1.5rem;
    }
}
```

- [ ] **Step 2: Test all pages visually**

Open each page in the browser and verify:
1. Login page — clean form, focus glow on inputs, sign-up toggle works
2. Wizard — step transitions smooth, value tags clean, cards have subtle hover shadow
3. Loading spinner renders during charity search
4. "See more" button styled consistently
5. Saved charities page — cards and nav look consistent
6. Mobile responsive at 768px breakpoint

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "style: polish UI — better typography, spacing, focus states, loading spinner"
```

---

## Chunk 6: Code Comments & Deployment Prep

### Task 9: Add code comments to all JS files

**Files:**
- Modify: `public/firebase-config.js` (already has comments)
- Modify: `public/login.js` (already has comments)
- Modify: `public/home.js` (already has comments)
- Modify: `public/saved.js` (already has comments)

All JS files written in earlier tasks already include section-level comments. Verify each file has clear section comments and add any missing ones.

- [ ] **Step 1: Review all JS files for comment completeness**

Read through each file and verify section comments are present. The files written in Tasks 2, 5, 6, and 7 already include them. No changes expected unless gaps are found.

- [ ] **Step 2: Commit if any changes**

```bash
git add public/*.js
git commit -m "docs: verify section-level code comments across all JS files"
```

---

### Task 10: Prepare NLP backend for Render deployment

**Files:**
- Modify: `nlp_server.py`
- Create: `requirements.txt`

- [ ] **Step 1: Update nlp_server.py for production**

Replace the entire contents of `nlp_server.py` with:

```python
# NLP similarity backend for The Giving Index
# Encodes user keywords and charity missions using sentence-transformers
# and returns cosine similarity scores

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util

app = Flask(__name__)
CORS(app)

# Load the sentence transformer model (runs once at startup)
model = SentenceTransformer("all-MiniLM-L6-v2")


@app.route("/similarity", methods=["POST"])
def similarity():
    """Calculate cosine similarity between user keywords and a charity mission."""
    data = request.get_json()

    keywords = data.get("keywords", [])
    mission = data.get("mission", "")

    if not keywords or not mission:
        return jsonify({"similarity": 0.0})

    # Combine keywords into a single text for encoding
    keyword_text = " ".join(keywords)

    keyword_embedding = model.encode(keyword_text, convert_to_tensor=True)
    mission_embedding = model.encode(mission, convert_to_tensor=True)

    score = util.cos_sim(keyword_embedding, mission_embedding).item()

    return jsonify({"similarity": float(score)})


if __name__ == "__main__":
    # Use PORT env var for Render; default to 5000 for local development
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
```

- [ ] **Step 2: Create requirements.txt**

Create `requirements.txt` in the project root:

```
flask
flask-cors
sentence-transformers
```

- [ ] **Step 3: Test locally**

Run: `python nlp_server.py`
Expected: Server starts on port 5000. Test with:
```bash
curl -X POST http://localhost:5000/similarity \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["education", "children"], "mission": "Providing education to underprivileged children"}'
```
Expected: JSON response with similarity score between 0 and 1.

- [ ] **Step 4: Commit**

```bash
git add nlp_server.py requirements.txt
git commit -m "feat: prepare NLP server for Render deployment — PORT env var, requirements.txt"
```

---

### Task 11: Deploy to Firebase Hosting and Render

**Files:**
- Modify: `firebase.json` (create or update)
- Modify: `public/home.js` (update API_URL after Render deploy)

- [ ] **Step 1: Initialize Firebase Hosting (if needed)**

Run: `firebase init hosting`
- Select existing project `charity-project-5fc71`
- Public directory: `public`
- Single-page app: No
- Overwrite index.html: No

If `firebase.json` already exists, ensure it has:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

- [ ] **Step 2: Deploy Firestore rules**

Run: `firebase deploy --only firestore:rules`
Expected: "Deploy complete!"

- [ ] **Step 3: Deploy frontend to Firebase Hosting**

Run: `firebase deploy --only hosting`
Expected: "Deploy complete!" with a hosting URL like `https://charity-project-5fc71.web.app`

- [ ] **Step 4: Deploy NLP backend to Render**

1. Create a new Web Service on Render (https://render.com)
2. Connect the GitHub repository (or upload code)
3. Settings:
   - Build command: `pip install -r requirements.txt`
   - Start command: `python nlp_server.py`
   - Environment: Python
4. Note the deployed URL (e.g., `https://your-app.onrender.com`)

- [ ] **Step 5: Update API_URL in home.js**

In `public/home.js`, update the API_URL constant:

```js
const API_URL = "https://your-actual-render-app.onrender.com/similarity";
```

Keep the commented-out localhost line for local development reference.

- [ ] **Step 6: Redeploy frontend with updated URL**

Run: `firebase deploy --only hosting`

- [ ] **Step 7: End-to-end test on live site**

Visit the Firebase Hosting URL and test:
1. Sign up with a new account
2. Sign in with that account
3. Add values, rank them, find charities
4. Verify loading spinner, then results appear
5. Click "See more" for additional results
6. Save a charity
7. Navigate to saved charities — verify it appears
8. Remove the charity
9. Log out and back in — saved charities persist
10. Test on mobile viewport

- [ ] **Step 8: Commit final URL update**

```bash
git add public/home.js firebase.json
git commit -m "chore: configure Firebase Hosting and set production NLP API URL"
```
