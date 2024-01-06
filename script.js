//------------------------------
// script.js -------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

import { handleLike, handleDislike } from './firebase-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const numberContainer = document.getElementById('numberContainer');

    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    function displayNumber() {
        numberContainer.textContent = generateRandomNumber();
    }

    displayNumber();

    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    if (likeButton && dislikeButton) {
        likeButton.addEventListener('click', () => {
            const number = numberContainer.textContent;
            handleLike(number);
            displayNumber();
        });

        dislikeButton.addEventListener('click', () => {
            const number = numberContainer.textContent;
            handleDislike(number);
            displayNumber();
        });

        document.addEventListener('keydown', (event) => {
            if (event.code === 'ArrowRight') {
                const number = numberContainer.textContent;
                handleLike(number);
                displayNumber();
            } else if (event.code === 'ArrowLeft') {
                const number = numberContainer.textContent;
                handleDislike(number);
                displayNumber();
            }
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