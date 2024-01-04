//------------------------------
// script.js -------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------


document.addEventListener('DOMContentLoaded', () => {
    const numberContainer = document.getElementById('numberContainer');
    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    let likedNumbers = [];
    let dislikedNumbers = [];

    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    function displayNumber() {
        numberContainer.textContent = generateRandomNumber();
    }

    likeButton.addEventListener('click', () => {
        likedNumbers.push(numberContainer.textContent);
        displayNumber();
        updateResults();
    });

    dislikeButton.addEventListener('click', () => {
        dislikedNumbers.push(numberContainer.textContent);
        displayNumber();
        updateResults();
    });

    function updateResults() {
        console.log("Liked Numbers: ", likedNumbers);
        console.log("Disliked Numbers: ", dislikedNumbers);
    }

    displayNumber(); // Display the first random number on load
});

// Add a new event listener for keyboard events
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
        // Handle "like" for the right arrow key
        likedNumbers.push(numberContainer.textContent);
        displayNumber();
        updateResults();
    } else if (event.key === 'ArrowLeft') {
        // Handle "dislike" for the left arrow key
        dislikedNumbers.push(numberContainer.textContent);
        displayNumber();
        updateResults();
    }
});

//------------------------------
// END OF CODE -----------------
//------------------------------
// CREATED BY MOLDOVAN ---------
//------------------------------
// JAVASCRIPT BY GPT -----------
//------------------------------