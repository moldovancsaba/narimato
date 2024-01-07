// result.js
document.addEventListener('DOMContentLoaded', function() {
    fetch('/results')
      .then(response => response.json())
      .then(data => {
        const likedList = document.getElementById('liked-list');
        const dislikedList = document.getElementById('disliked-list');
  
        likedList.innerHTML = '';
        dislikedList.innerHTML = '';
  
        // Add the liked numbers
        for (const number in data.liked) {
          const listItem = document.createElement('li');
          listItem.textContent = `Number: ${number}, Likes: ${data.liked[number]}`;
          likedList.appendChild(listItem);
        }
  
        // Add the disliked numbers
        for (const number in data.disliked) {
          const listItem = document.createElement('li');
          listItem.textContent = `Number: ${number}, Dislikes: ${data.disliked[number]}`;
          dislikedList.appendChild(listItem);
        }
      })
      .catch(error => console.error('Error:', error));
  });