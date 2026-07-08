import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Public Firebase config for "sinceronewsapp"
const firebaseConfig = {
  apiKey: "AIzaSyAYLg_SlM_8NgYYJhTOLk1Mz4OuSt3JIQc",
  authDomain: "sinceronewsapp.firebaseapp.com",
  projectId: "sinceronewsapp",
  storageBucket: "sinceronewsapp.firebasestorage.app",
  messagingSenderId: "689265991241",
  appId: "1:689265991241:web:c0d8fdec2b87857da6e998",
  measurementId: "G-EZBS5BKQ0T"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configure Local Persistence for user login sessions
setPersistence(auth, browserLocalPersistence)
  .catch((err) => {
    console.error("[Firebase Client] Error setting session persistence:", err);
  });

export default app;
