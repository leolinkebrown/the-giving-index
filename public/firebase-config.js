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
