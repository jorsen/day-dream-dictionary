const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'task-manager.html'));
});

// API endpoint for tasks (optional - for future enhancements)
app.get('/api/tasks', (req, res) => {
    // This could be enhanced to read from a database later
    res.sendFile(path.join(__dirname, 'tasks.md'));
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Day Dream Dictionary is running' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Day Dream Dictionary server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the application`);
});