// Firebase imports for auth guard, logout, and Firestore save
import { auth, db, onAuthStateChanged } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// TF-IDF module for client-side fallback and hybrid scoring
import { buildCorpusIndex, tfidfBatchScore } from "./tfidf.js";

// Levenshtein search module for fuzzy charity search
import { searchCharities } from "./search.js";

// NLP backend URL, switch to localhost for local development
// const BATCH_API_URL = "http://127.0.0.1:5000/batch-similarity";
const BATCH_API_URL = "https://the-giving-index.onrender.com/batch-similarity";

let userValues = [];
let charities = [];
let currentResults = [];
let visibleCount = 0;
let corpusIndex = null;
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
    // Precompute TF-IDF corpus index for client-side scoring
    corpusIndex = buildCorpusIndex(charities);
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
    errorMessage.classList.add("show");
    return;
  }

  if (userValues.includes(value)) {
    errorMessage.textContent = "Value already added";
    errorMessage.classList.add("show");
    return;
  }

  userValues.push(value);
  valueInput.value = "";
  errorMessage.textContent = "";
  errorMessage.classList.remove("show");

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
  userValues.forEach((v, index) => {
    const tag = document.createElement("span");
    tag.className = "value-tag";
    tag.innerHTML = `${v}<button type="button" class="remove-value" aria-label="Remove ${v}">&times;</button>`;

    // Remove value on x click
    tag.querySelector(".remove-value").addEventListener("click", () => {
      userValues.splice(index, 1);
      renderValues();
      proceedToRanking.disabled = userValues.length < 2;
    });

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

  // Compute client-side TF-IDF scores for all charities
  const tfidfScores = corpusIndex
    ? tfidfBatchScore(weightedKeywords, corpusIndex)
    : charities.map(() => 0);

  try {
    // Send all missions in one batch request with weighted keywords
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(BATCH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: weightedKeywords,
        missions: charities.map(c => c.mission)
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json();

    // Blend NLP semantic scores (70%) with TF-IDF lexical scores (30%)
    const results = charities.map((charity, i) => ({
      ...charity,
      score: 0.7 * (data.scores[i] || 0) + 0.3 * tfidfScores[i]
    }));

    results.sort((a, b) => b.score - a.score);

    // Store results and show first page
    currentResults = results;
    visibleCount = 0;
    charitiesList.innerHTML = "";
    showMoreResults();
  } catch (error) {
    // If the API fails, fall back to TF-IDF only so the app still works
    console.warn("NLP API unavailable, using TF-IDF fallback:", error.message);

    const results = charities.map((charity, i) => ({
      ...charity,
      score: tfidfScores[i]
    }));

    results.sort((a, b) => b.score - a.score);

    currentResults = results;
    visibleCount = 0;
    charitiesList.innerHTML = "";
    showMoreResults();
  }
});

// ── Paginated results — show 10 at a time ──

function showMoreResults() {
  const nextBatch = currentResults.slice(visibleCount, visibleCount + PAGE_SIZE);
  nextBatch.forEach(c => {
    const card = document.createElement("div");
    card.className = "charity-card";

    const pct = c.score * 100;
    const matchColor = c.score >= 0.4 ? "#059669" : c.score >= 0.2 ? "#b45309" : "#ef4444";
    const matchBg = c.score >= 0.4 ? "rgba(16,185,129,0.15)" : c.score >= 0.2 ? "rgba(234,179,8,0.15)" : "rgba(239,68,68,0.15)";

    card.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.mission}</p>
      <a href="${c.url}" target="_blank" rel="noopener" class="charity-link">${c.url}</a>
      <strong class="match-score" style="color:${matchColor};background:${matchBg}">Match: ${pct.toFixed(1)}%</strong>
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

// ── Quick Search — fuzzy charity search with Levenshtein distance ──

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
let searchTimeout = null;

searchInput.addEventListener("input", () => {
  // Debounce: wait 300ms after user stops typing before searching
  clearTimeout(searchTimeout);
  const searchQuery = searchInput.value.trim();

  if (!searchQuery) {
    searchResults.innerHTML = "";
    searchResults.style.display = "none";
    return;
  }

  searchTimeout = setTimeout(() => {
    if (charities.length === 0) return;

    const results = searchCharities(searchQuery, charities);
    searchResults.innerHTML = "";

    if (results.length === 0) {
      searchResults.style.display = "block";
      searchResults.innerHTML = '<p class="search-empty">No charities found matching your search.</p>';
      return;
    }

    searchResults.style.display = "grid";
    // Show top 5 search results
    results.slice(0, 5).forEach(c => {
      const card = document.createElement("div");
      card.className = "charity-card";
      card.innerHTML = `
        <h3>${c.name}</h3>
        <p>${c.mission}</p>
        <a href="${c.url}" target="_blank" rel="noopener" class="charity-link">${c.url}</a>
        <button type="button" class="btn-save">Add to My Charities</button>
      `;

      const btn = card.querySelector(".btn-save");
      btn.addEventListener("click", () => {
        if (btn.classList.contains("saved")) return;
        saveCharityToFirestore({ name: c.name, mission: c.mission, url: c.url, id: c.id });
        btn.classList.add("saved");
        btn.textContent = "Saved ✓";
      });

      searchResults.appendChild(card);
    });
  }, 300);
});
