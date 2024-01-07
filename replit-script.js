//------------------------------
// script.js 164 ---------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------


// script.js
document.addEventListener('DOMContentLoaded', () => {
    const numberContainer = document.getElementById('numberContainer');
    const numberDisplay = document.createElement('div'); // Create a new element for the number
    numberContainer.prepend(numberDisplay); // Prepend the number display element

    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    function displayNumber() {
        numberDisplay.textContent = generateRandomNumber();
    }

    displayNumber();

    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    // Send vote to the server
    function sendVote(type, number) {
        fetch('/' + type + '?number=' + number, { method: 'POST' })
            .then(response => response.json())
            .then(data => console.log(data))
            .catch(error => console.error('Error:', error));
    }

    if (likeButton) {
        likeButton.addEventListener('click', () => {
            const currentNumber = numberDisplay.textContent;
            sendVote('like', currentNumber);
            displayNumber();
        });
    }

    if (dislikeButton) {
        dislikeButton.addEventListener('click', () => {
            const currentNumber = numberDisplay.textContent;
            sendVote('dislike', currentNumber);
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