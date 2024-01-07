//------------------------------
// index.js --------------------
//------------------------------
// JAVASCRIPT STARTS HERE ------
//------------------------------

const express = require('express');
const Database = require('@replit/database');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Create a new database instance
const db = new Database();

// Enable CORS for all routes
app.use(cors());

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Endpoint to handle likes
app.post('/like', (req, res) => {
  const number = req.query.number;
  if (number) {
    db.get('likes').then(likes => {
      if (!likes) likes = {};
      likes[number] = (likes[number] || 0) + 1;
      db.set('likes', likes).then(() => {
        res.json({ status: 'success', number: number, likes: likes[number] });
      });
    });
  } else {
    res.json({ status: 'error', message: 'No number provided' });
  }
});

// Endpoint to handle dislikes
app.post('/dislike', (req, res) => {
  const number = req.query.number;
  if (number) {
    db.get('dislikes').then(dislikes => {
      if (!dislikes) dislikes = {};
      dislikes[number] = (dislikes[number] || 0) + 1;
      db.set('dislikes', dislikes).then(() => {
        res.json({ status: 'success', number: number, dislikes: dislikes[number] });
      });
    });
  } else {
    res.json({ status: 'error', message: 'No number provided' });
  }
});

// Endpoint to retrieve results
app.get('/results', (req, res) => {
  Promise.all([db.get('likes'), db.get('dislikes')]).then(values => {
    const [likes, dislikes] = values;
    res.json({ liked: likes, disliked: dislikes });
  });
});

// New endpoint to retrieve all data from the database
app.get('/alldata', (req, res) => {
  db.getAll().then(data => {
    res.json(data);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

//------------------------------
// END OF CODE -----------------
//------------------------------
// CREATED BY MOLDOVAN ---------
//------------------------------
// JAVASCRIPT BY GPT -----------
//------------------------------