//------------------------------
// firebase-logic.js
//------------------------------
// CODE STARTS HERE
//------------------------------

import { getFirestore, doc, updateDoc, increment } from "firebase/firestore"; 

const db = getFirestore();

async function handleLike(number) {
    const numberRef = doc(db, "numbers", number);
    await updateDoc(numberRef, { 
        likes: increment(1)
    });
}

async function handleDislike(number) {
    const numberRef = doc(db, "numbers", number);
    await updateDoc(numberRef, { 
        dislikes: increment(1)
    });
}

export { handleLike, handleDislike };

//------------------------------
// END OF CODE
//------------------------------
// CREATED BY MOLDOVAN
//------------------------------
// CODE BY GPT
//------------------------------