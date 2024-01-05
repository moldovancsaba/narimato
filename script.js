//------------------------------
// script.js -------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

import { handleLike, handleDislike } from './firebase-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const numberContainer = document.getElementById('numberContainer');
    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    function displayNumber() {
        numberContainer.textContent = generateRandomNumber();
    }

    likeButton.addEventListener('click', () => {
        const number = numberContainer.textContent;
        handleLike(number); // Update like count in Firestore
        displayNumber();
    });

    dislikeButton.addEventListener('click', () => {
        const number = numberContainer.textContent;
        handleDislike(number); // Update dislike count in Firestore
        displayNumber();
    });

    document.addEventListener('keydown', (event) => {
        if (event.code === 'ArrowRight') {
            const number = numberContainer.textContent;
            handleLike(number); // Update like count in Firestore
            displayNumber();
        } else if (event.code === 'ArrowLeft') {
            const number = numberContainer.textContent;
            handleDislike(number); // Update dislike count in Firestore
            displayNumber();
        }
    });

    displayNumber();
});

//------------------------------
// END OF CODE -----------------
//------------------------------
// CREATED BY MOLDOVAN ---------
//------------------------------
// JAVASCRIPT BY GPT -----------
//------------------------------