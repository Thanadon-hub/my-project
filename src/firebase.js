// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCgqOhBAWJVYQK-MxByy4VD8UBF4BbJiKI",
  authDomain: "test1-fd8e9.firebaseapp.com",
  projectId: "test1-fd8e9",
  storageBucket: "test1-fd8e9.firebasestorage.app",
  messagingSenderId: "422145407157",
  appId: "1:422145407157:web:b9f390eede5da7ec01e6fc",
  measurementId: "G-BNKKLG77JJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ส่งออก app, db และ auth
export { app, db, auth };