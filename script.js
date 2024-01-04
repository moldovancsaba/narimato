//------------------------------
// script.js -------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

// Wait for the DOM to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {
    // Get the HTML elements for displaying the number and handling button clicks
    const numberContainer = document.getElementById('numberContainer');
    const likeButton = document.getElementById('likeButton');
    const dislikeButton = document.getElementById('dislikeButton');

    // Arrays to store the liked and disliked numbers
    let likedNumbers = [];
    let dislikedNumbers = [];

    // Function to generate a random number between 0 and 999
    function generateRandomNumber() {
        return Math.floor(Math.random() * 1000);
    }

    // Function to display the generated number in the number container
    function displayNumber() {
        numberContainer.textContent = generateRandomNumber();
    }

    // Event listeners for the like and dislike buttons
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

    // Function to update the console with liked and disliked numbers
    function updateResults() {
        console.log("Liked Numbers: ", likedNumbers);
        console.log("Disliked Numbers: ", dislikedNumbers);
    }

    // Display the first random number when the page loads
    displayNumber();
});

// Event listener for keyboard events to handle right and left arrow keys
document.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowRight') {
        // Handle "like" for the right arrow key
        likedNumbers.push(numberContainer.textContent);
        displayNumber();
        updateResults();
    } else if (event.code === 'ArrowLeft') {
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