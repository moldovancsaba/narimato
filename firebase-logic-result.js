//------------------------------
// firebase-logic-results.js
//------------------------------
// CODE STARTS HERE
//------------------------------

import { getFirestore, collection, query, orderBy, limit, onSnapshot } from "firebase/firestore"; 

// Initialize Firestore
const db = getFirestore();

// Function to fetch and listen for top 10 numbers based on score
function fetchTopNumbers() {
    const numbersRef = collection(db, "numbers");
    const q = query(numbersRef, orderBy("score", "desc"), limit(10));

    onSnapshot(q, (snapshot) => {
        const numbersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Update the UI with these numbers
        updateTopNumbersUI(numbersList);
    });
}

function updateTopNumbersUI(numbersList) {
    // Example of updating the UI
    // Assuming there are two divs with IDs 'topLiked' and 'topDisliked'
    const topLikedDiv = document.getElementById('topLiked');
    const topDislikedDiv = document.getElementById('topDisliked');
    
    topLikedDiv.innerHTML = numbersList
        .filter(number => number.score > 0) // Filter liked numbers
        .map(number => `<p>${number.id}: ${number.score}</p>`)
        .join('');

    topDislikedDiv.innerHTML = numbersList
        .filter(number => number.score < 0) // Filter disliked numbers
        .map(number => `<p>${number.id}: ${number.score}</p>`)
        .join('');
}

// Fetch the top numbers on load
fetchTopNumbers();

// Export the functions to be used in other scripts
export { fetchTopNumbers };

//------------------------------
// END OF CODE
//------------------------------
// CREATED BY MOLDOVAN
//------------------------------
// CODE BY GPT
//------------------------------