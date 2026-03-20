// Check auth - redirect to login if not logged in
const userId = sessionStorage.getItem("userId");
if (!userId) {
  window.location.href = "login.html";
}

const STORAGE_KEY = "savedCharities";

function getStorageKey() {
  return `${STORAGE_KEY}_${userId}`;
}

function getSavedCharities() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCharities(list) {
  localStorage.setItem(getStorageKey(), JSON.stringify(list));
}

const savedCharitiesList = document.getElementById("savedCharitiesList");
const emptyState = document.getElementById("emptyState");

function renderSavedCharities() {
  const saved = getSavedCharities();

  if (saved.length === 0) {
    savedCharitiesList.innerHTML = "";
    savedCharitiesList.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";
  savedCharitiesList.style.display = "grid";
  savedCharitiesList.innerHTML = "";

  saved.forEach((c, index) => {
    const card = document.createElement("div");
    card.className = "charity-card";
    card.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.mission}</p>
      <a href="${c.url}" target="_blank" rel="noopener" class="charity-link">${c.url}</a>
      ${c.score != null ? `<strong>Match: ${(c.score * 100).toFixed(1)}%</strong>` : ""}
      <button type="button" class="btn-save btn-remove" data-index="${index}">Remove</button>
    `;

    card.querySelector(".btn-remove").addEventListener("click", () => {
      const list = getSavedCharities();
      list.splice(index, 1);
      saveCharities(list);
      renderSavedCharities();
    });

    savedCharitiesList.appendChild(card);
  });
}

renderSavedCharities();
