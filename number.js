//------------------------------
// number.js -------------------
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
});

//------------------------------
// END OF CODE -----------------
//------------------------------
