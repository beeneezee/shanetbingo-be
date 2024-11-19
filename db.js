const mysql = require('mysql');

// Set up the connection to the MySQL database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',           // Replace with your MySQL username
    password: '',            // Replace with your MySQL password
    database: 'shanet_bingo'
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to the shanet_bingo database');
});

// Export the connection to be used in other files
module.exports = db;
