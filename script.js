//------------------------------
// script.js 155 ---------------
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
// CREATED BY MOLDOVAN ---------
//------------------------------
// JAVASCRIPT BY GPT -----------
//------------------------------