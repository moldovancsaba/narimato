//------------------------------
// firebase-logic.js
//------------------------------
// CODE STARTS HERE
//------------------------------

import { getFirestore, collection, doc, setDoc, updateDoc, increment } from "firebase/firestore"; 

// Initialize Firestore
const db = getFirestore();

// Function to handle Like
async function handleLike(number) {
    const numberRef = doc(db, "numbers", String(number));
    await setDoc(numberRef, { likes: increment(1) }, { merge: true });
}

// Function to handle Dislike
async function handleDislike(number) {
    const numberRef = doc(db, "numbers", String(number));
    await setDoc(numberRef, { dislikes: increment(1) }, { merge: true });
}

// Export the functions to be used in other scripts
export { handleLike, handleDislike };

//------------------------------
// END OF CODE
//------------------------------
// CREATED BY MOLDOVAN
//------------------------------
// CODE BY GPT
//------------------------------