//------------------------------
// firebase-logic.js
//------------------------------
// CODE STARTS HERE
//------------------------------

import { getFirestore, collection, doc, setDoc, increment } from "firebase/firestore"; 

const db = getFirestore();

async function handleLike(number) {
    const numberRef = doc(db, "numbers", String(number));
    await setDoc(numberRef, { 
        likes: increment(1),
        score: increment(1)  // Increment score by 1 for a like
    }, { merge: true });
}

async function handleDislike(number) {
    const numberRef = doc(db, "numbers", String(number));
    await setDoc(numberRef, { 
        dislikes: increment(1),
        score: increment(-1)  // Decrement score by 1 for a dislike
    }, { merge: true });
}

export { handleLike, handleDislike };

//------------------------------
// END OF CODE
//------------------------------
// CREATED BY MOLDOVAN
//------------------------------
// CODE BY GPT
//------------------------------