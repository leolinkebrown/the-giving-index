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
