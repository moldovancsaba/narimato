//------------------------------
// script.js 156 ---------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

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

    if (likeButton) {
        likeButton.addEventListener('click', () => {
            displayNumber();
        });
    }

    if (dislikeButton) {
        dislikeButton.addEventListener('click', () => {
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