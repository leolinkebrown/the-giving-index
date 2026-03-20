# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Giving Index** — a charity recommendation web app that matches users to charities based on ranked personal values using semantic NLP similarity.

## Running the Project

**NLP backend** (required for charity matching):
```bash
python nlp_server.py
```
Runs Flask on `http://127.0.0.1:5000`. Requires `flask`, `flask-cors`, and `sentence-transformers` installed.

**Frontend**: Open `public/index.html` directly in a browser, or serve the `public/` directory with any static file server. No build step.

## Architecture

### User Flow
1. `login.html` / `login.js` — Firebase email/password auth; stores `userId` in `sessionStorage`
2. `index.html` / `home.js` — 3-step wizard: (1) enter values → (2) drag-to-rank values → (3) view matched charities
3. `home.html` / `saved.js` — displays saved charities (redirects to login if not authenticated)

> Note: `index.html` loads `home.js`, and `home.html` loads `saved.js` — the filenames don't match their HTML counterparts.

### Charity Matching
- `charitydatabase.json` — static array of charities with `id`, `name`, `mission`, `url`
- `home.js:calculateSemanticSimilarity()` — POSTs ranked keywords + charity mission to the Flask `/similarity` endpoint
- `nlp_server.py` — encodes both texts with `all-MiniLM-L6-v2` and returns cosine similarity score
- Results are sorted by score descending and displayed as cards

### Data Persistence
Saved charities are stored in `localStorage` under the key `savedCharities_<userId>`. The `userId` comes from Firebase Auth via `sessionStorage`.

### Firebase
- Auth: email/password sign-in via Firebase SDK (ESM import in `login.js`)
- Firestore: configured (`firestore.rules`, `firestore.indexes.json`) but not actively used — all persistence is currently `localStorage`
- Firestore rules expire **2026-03-22** (open read/write until then)
