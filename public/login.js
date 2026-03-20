// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDpkQ1drURiEpt_KSlSlXWZy26hFSD0nEI",
  authDomain: "charity-project-5fc71.firebaseapp.com",
  projectId: "charity-project-5fc71",
  storageBucket: "charity-project-5fc71.firebasestorage.app",
  messagingSenderId: "542041302670",
  appId: "1:542041302670:web:0ae74f93a0669fa2e94bdf",
  measurementId: "G-CKTQFVH6K7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Analytics only runs in browser environment
let analytics;
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Analytics init skipped:", e.message);
  }
}

/* =========================
   DOM & FORM HANDLING
========================= */

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

function showError(message) {
  loginError.textContent = message;
  loginError.classList.add("show");
}

function clearError() {
  loginError.textContent = "";
  loginError.classList.remove("show");
}

function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtn.textContent = loading ? "Signing in…" : "Sign In";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  setLoading(true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    sessionStorage.setItem("userId", user.uid);
    window.location.href = "home.html";
  } catch (error) {
    setLoading(false);
    const errorCode = error.code;
    const errorMessage = error.message;

    // Human-readable messages for common Firebase Auth errors
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential": "Invalid email or password. Please try again.",
      "auth/too-many-requests": "Too many failed attempts. Please try again later.",
      "auth/network-request-failed": "Network error. Please check your connection."
    };

    showError(messages[errorCode] || errorMessage || "Sign in failed. Please try again.");
  }
});
