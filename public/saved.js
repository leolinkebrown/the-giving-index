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
