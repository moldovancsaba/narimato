//------------------------------
// firebase.js
//------------------------------
// CODE STARTS HERE
//------------------------------

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // Import Firestore

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD6pJbePHGsLEUanA1yM2_CGO8vUIY3A8M",
  authDomain: "play-narimato.firebaseapp.com",
  projectId: "play-narimato",
  storageBucket: "play-narimato.appspot.com",
  messagingSenderId: "114891157291",
  appId: "1:114891157291:web:98c7715b15784f00a8e46e",
  measurementId: "G-L970ZBSM2J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app); // Initialize Firestore

//------------------------------
// END OF CODE
//------------------------------
// CREATED BY MOLDOVAN
//------------------------------
// CODE BY GPT
//------------------------------