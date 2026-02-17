#!/usr/bin/env node
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'daydream';

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI is required');
  process.exit(1);
}

let db;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));

// Connect to MongoDB
async function connect() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db(MONGODB_DB);
    console.log('✅ MongoDB connected');
   
    // Create indexes
    await Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('dreams').createIndex({ user_id: 1, created_at: -1 }),
      db.collection('profiles').createIndex({ user_id: 1 }, { unique: true }),
     ].catch(() => {}));
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

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

// Routes

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/v1', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Day Dream Dictionary API v1 (MongoDB)',
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

// Auth: Signup
app.post('/api/v1/auth/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    
    const users = db.collection('users');
    if (await users.findOne({ email })) {
      return res.status(409).json({ error: 'User exists' });
    }

    const userId = `user${Date.now()}`;
    await users.insertOne({
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
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await db.collection('users').findOne({ email });
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
    const user = await db.collection('users').findOne({ _id: req.user_id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, email: user.email, display_name: user.displayName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Create
app.post('/api/v1/dreams', authMiddleware, async (req, res) => {
  try {
    const { dream_text, interpretation, metadata } = req.body;
    if (!dream_text) return res.status(400).json({ error: 'Dream text required' });

    const dream = {
      _id: new ObjectId(),
      user_id: req.user_id,
      dream_text,
      interpretation: interpretation || null,
      metadata: metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.collection('dreams').insertOne(dream);
    res.status(201).json({ id: dream._id.toString(), ...dream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Get all for user
app.get('/api/v1/dreams', authMiddleware, async (req, res) => {
  try {
    const dreams = await db.collection('dreams')
      .find({ user_id: req.user_id })
      .sort({ created_at: -1 })
      .toArray();
    res.json({ dreams: dreams.map(d => ({ id: d._id.toString(), ...d })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Interpret
app.post('/api/v1/dreams/interpret', authMiddleware, async (req, res) => {
  try {
    const { dream_text } = req.body;
    if (!dream_text) return res.status(400).json({ error: 'Dream text required' });

    // Mock interpretation (replace with OpenRouter call)
    const interpretation = {
      mainThemes: ['transformation', 'freedom'],
      emotionalTone: 'hopeful',
      symbols: [
        { symbol: 'flying', meaning: 'Liberation' }
      ],
      personalInsight: 'You seek freedom.',
      guidance: 'Embrace change.'
    };

    const dream = {
      _id: new ObjectId(),
      user_id: req.user_id,
      dream_text,
      interpretation,
      created_at: new Date()
    };

    await db.collection('dreams').insertOne(dream);
    res.json({ id: dream._id.toString(), interpretation });
  } catch (err) {
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
  await connect();
  app.listen(PORT, () => {
    console.log(`\n🌙 Day Dream Dictionary API`);
    console.log(`📍 Listening on port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}/health`);
    console.log(`💾 MongoDB: ${MONGODB_DB}\n`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
