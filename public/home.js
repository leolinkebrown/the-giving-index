let userValues = [];
let charities = [];

/* =========================
   DOM ELEMENTS
========================= */

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

/* =========================
   STEP NAVIGATION
========================= */

function showStep(step) {
  [step1, step2, step3].forEach(s => s.classList.remove("active"));
  step.classList.add("active");
}

/* =========================
   STEP 1: ADD VALUES
========================= */

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

/* =========================
   STEP 2: RANK VALUES
========================= */

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

/* =========================
   SEMANTIC NLP (BACKEND)
========================= */

async function calculateSemanticSimilarity(keywords, mission) {
  const response = await fetch("http://127.0.0.1:5000/similarity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keywords: keywords.map(k => k.word),
      mission: mission
    })
  });

  const data = await response.json();
  return data.similarity;
}

/* =========================
   WEIGHTED SCORING
========================= */

function getWeightedKeywords() {
  const ranked = [...rankingList.children].map(i => i.textContent);
  const maxWeight = ranked.length;

  return ranked.map((word, index) => ({
    word,
    weight: maxWeight - index
  }));
}

async function calculateWeightedScore(charity, keywords) {
  const similarity = await calculateSemanticSimilarity(keywords, charity.mission);
  return similarity; // already normalised
}

/* =========================
   FIND & DISPLAY RESULTS
========================= */

findCharitiesBtn.addEventListener("click", async () => {
  if (charities.length === 0) {
    alert("Charity data still loading");
    return;
  }

  const weightedKeywords = getWeightedKeywords();
  const results = [];

  for (const charity of charities) {
    const score = await calculateWeightedScore(charity, weightedKeywords);
    results.push({ ...charity, score });
  }

  results.sort((a, b) => b.score - a.score);
  displayCharities(results);
  showStep(step3);
});

function getSavedCharities() {
  const userId = sessionStorage.getItem("userId") || "guest";
  try {
    const raw = localStorage.getItem(`savedCharities_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCharity(charity) {
  const userId = sessionStorage.getItem("userId") || "guest";
  const saved = getSavedCharities();
  if (saved.some(s => s.url === charity.url && s.name === charity.name)) return;
  saved.push(charity);
  localStorage.setItem(`savedCharities_${userId}`, JSON.stringify(saved));
}

function displayCharities(results) {
  charitiesList.innerHTML = "";
  const saved = getSavedCharities();

  results.forEach(c => {
    const card = document.createElement("div");
    card.className = "charity-card";
    const isSaved = saved.some(s => s.url === c.url && s.name === c.name);

    card.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.mission}</p>
      <a href="${c.url}" target="_blank" rel="noopener">${c.url}</a>
      <strong>Match: ${(c.score * 100).toFixed(1)}%</strong>
      <button type="button" class="btn-save ${isSaved ? "saved" : ""}">${isSaved ? "Saved to Home ✓" : "Add to My Charities"}</button>
    `;

    const btn = card.querySelector(".btn-save");
    btn.addEventListener("click", () => {
      if (btn.classList.contains("saved")) return;
      saveCharity({ name: c.name, mission: c.mission, url: c.url, score: c.score });
      btn.classList.add("saved");
      btn.textContent = "Saved to Home ✓";
    });

    charitiesList.appendChild(card);
  });
}

/* =========================
   RESET
========================= */

document.getElementById("startOver").addEventListener("click", () => {
  userValues = [];
  renderValues();
  valueInput.value = "";
  proceedToRanking.disabled = true;
  findCharitiesBtn.disabled = true;
  showStep(step1);
});
