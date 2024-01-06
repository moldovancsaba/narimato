//------------------------------
// script.js -------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

import { handleLike, handleDislike } from './firebase-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const numberContainer = document.getElementById('numberContainer');
    const numberDisplay = document.createElement('div'); 
    numberContainer.prepend(numberDisplay);

    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    function displayNumber() {
        numberDisplay.textContent = generateRandomNumber();
    }

    displayNumber();

    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    if (likeButton) {
        likeButton.addEventListener('click', () => {
            const number = numberDisplay.textContent;
            handleLike(number);
            displayNumber();
        });
    }

    if (dislikeButton) {
        dislikeButton.addEventListener('click', () => {
            const number = numberDisplay.textContent;
            handleDislike(number);
            displayNumber();
        });
    }
});

//------------------------------
// END OF CODE -----------------
//------------------------------
// CREATED BY MOL⬤