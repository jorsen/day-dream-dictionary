#!/usr/bin/env node
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory storage (local dev fallback)
const storage = {
  users: new Map(),
  dreams: new Map(),
  profiles: new Map()
};

// CORS configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(__dirname));
app.options('*', cors(corsOptions));

// Helpers
function generateToken(userId) {
  return `jwt-${userId}-${Date.now()}`;
}

function hashPassword(pwd) {
  return Buffer.from(pwd).toString('base64');
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const match = token.match(/^jwt-(.+?)-/);
  if (!match) return res.status(401).json({ error: 'Invalid token' });
  req.user_id = match[1];
  next();
}

// Helper: Check in-memory storage
function checkDB(req, res, next) {
  // In-memory mode always ready
  next();
}

// Routes

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: 'memory' });
});

app.get('/api/v1', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Day Dream Dictionary API v1 (IN-MEMORY MODE)',
    mode: 'development',
    endpoints: [
      'POST /api/v1/auth/signup',
      'POST /api/v1/auth/login',
      'GET /api/v1/auth/me',
      'POST /api/v1/dreams',
      'GET /api/v1/dreams',
      'POST /api/v1/dreams/interpret',
    ]
  });
});

app.get('/api/v1/debug/stats', async (req, res) => {
  res.json({ 
    database: 'memory',
    users: storage.users.size, 
    dreams: storage.dreams.size,
    mode: 'development'
  });
});

// Auth: Signup
app.post('/api/v1/auth/signup', checkDB, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    
    if (storage.users.has(email)) {
      return res.status(409).json({ error: 'User exists' });
    }

    const userId = `user${Date.now()}`;
    storage.users.set(email, {
      _id: userId,
      email,
      password: hashPassword(password),
      displayName: displayName || email.split('@')[0],
      created_at: new Date()
    });

    const token = generateToken(userId);
    res.status(201).json({
      accessToken: token,
      user: { id: userId, email, display_name: displayName || email.split('@')[0] }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Auth: Login
app.post('/api/v1/auth/login', checkDB, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = storage.users.get(email);
    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    res.json({
      accessToken: token,
      user: { id: user._id, email: user.email, display_name: user.displayName }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Auth: Get current user
app.get('/api/v1/auth/me', authMiddleware, async (req, res) => {
  try {
    let user = null;
    for (const [email, u] of storage.users.entries()) {
      if (u._id === req.user_id) {
        user = u;
        break;
      }
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, email: user.email, display_name: user.displayName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Create
app.post('/api/v1/dreams', checkDB, authMiddleware, async (req, res) => {
  try {
    const { dream_text, interpretation, metadata } = req.body;
    if (!dream_text) return res.status(400).json({ error: 'Dream text required' });

    const dreamId = `dream${Date.now()}`;
    const dream = {
      _id: dreamId,
      user_id: req.user_id,
      dream_text,
      interpretation: interpretation || null,
      metadata: metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    };

    storage.dreams.set(dreamId, dream);
    res.status(201).json({ id: dreamId, ...dream });
  } catch (err) {
    console.error('Dream create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Get all for user
app.get('/api/v1/dreams', checkDB, authMiddleware, async (req, res) => {
  try {
    const dreams = Array.from(storage.dreams.values())
      .filter(d => d.user_id === req.user_id)
      .sort((a, b) => b.created_at - a.created_at);
    res.json({ dreams: dreams.map(d => ({ id: d._id, ...d })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Interpret
app.post('/api/v1/dreams/interpret', checkDB, authMiddleware, async (req, res) => {
  try {
    const { dream_text } = req.body;
    if (!dream_text) return res.status(400).json({ error: 'Dream text required' });

    // Mock interpretation with proper structure
    const interpretation = {
      mainThemes: ['transformation', 'freedom', 'self-discovery'],
      emotionalTone: 'hopeful and introspective',
      symbols: [
        { symbol: 'flying', meaning: 'Liberation and transcendence', significance: 'high' },
        { symbol: 'sky', meaning: 'Limitless possibilities', significance: 'high' },
        { symbol: 'journey', meaning: 'Personal growth and exploration', significance: 'medium' }
      ],
      personalInsight: 'This dream suggests you are going through a period of personal transformation and seeking freedom in some aspect of your life.',
      guidance: 'Embrace the changes ahead with confidence and trust your intuition. The dream encourages you to explore new possibilities.'
    };
    
    res.json({
      id: `dream-${Date.now()}`,
      dream_text,
      interpretation,
      created_at: new Date().toISOString(),
      mode: 'mock'
    });
  } catch (err) {
    console.error('Interpretation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
async function start() {
  console.log('🚀 Starting app in IN-MEMORY mode...');
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌙 Day Dream Dictionary API (DEV MODE)`);
    console.log(`📍 Listening on port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}/health`);
    console.log(`💾 Storage: In-Memory (local testing)\n`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
