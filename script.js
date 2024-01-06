//------------------------------
// script.js -------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

import { handleLike, handleDislike } from './firebase-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const numberContainer = document.getElementById('numberContainer');
    const numberDisplay = document.createElement('div'); // Create a new element for the number
    numberContainer.prepend(numberDisplay); // Prepend the number display element

    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    function displayNumber() {
        numberDisplay.textContent = generateRandomNumber(); // Update only the number display element
    }

    displayNumber();

    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    if (likeButton) {
        likeButton.addEventListener('click', () => {
            const number = numberDisplay.textContent;
            handleLike(number); // Update like count in the database
            displayNumber();
        });
    }

    if (dislikeButton) {
        dislikeButton.addEventListener('click', () => {
            const number = numberDisplay.textContent;
            handleDislike(number); // Update dislike count in the database
            displayNumber();
        });
    }
});

//------------------------------
// END OF CODE -----------------
//------------------------------
// CREATED BY MOLDOVAN ---------
//------------------------------
// JAVASCRIPT BY GPT -----------
//------------------------------