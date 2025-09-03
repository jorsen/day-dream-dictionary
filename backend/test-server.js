// Simple test server to verify basic functionality
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Day Dream Dictionary API is running (Test Mode)',
    version: 'v1',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/v1/test', (req, res) => {
  res.json({
    message: 'API is working!',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║     🌙 Day Dream Dictionary TEST Server 🌙          ║
║                                                      ║
║     Port: ${PORT}                                   ║
║     Health: http://localhost:${PORT}/health         ║
║     Test: http://localhost:${PORT}/api/v1/test      ║
║                                                      ║
║     Server is running in TEST MODE                  ║
║     Some features may be limited                    ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);
});