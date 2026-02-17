require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB Setup
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'daydream';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!MONGODB_URI && IS_PRODUCTION) {
  console.error('Error: MONGODB_URI environment variable is not set in production.');
  process.exit(1);
}

let dbClient;
let db;

// In-memory fallback for local dev testing
const inMemoryData = {
  users: new Map(),
  dreams: new Map(),
  profiles: new Map(),
  subscriptions: new Map(),
  credits: new Map(),
  events: new Map()
};

// Force in-memory in dev, only use MongoDB if MONGODB_URI is explicitly set AND in production
const useInMemory = !MONGODB_URI || (process.env.NODE_ENV !== 'production' && !process.env.FORCE_MONGODB);

// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGIN || '*').split(','),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Initialize MongoDB connection
async function connectMongo() {
  if (useInMemory) {
    console.log('⚠️ Using in-memory storage (development mode)');
    return;
  }

  try {
    dbClient = new MongoClient(MONGODB_URI, { 
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      retryWrites: true 
    });
    await dbClient.connect();
    db = dbClient.db(MONGODB_DB);
    console.log('✅ Connected to MongoDB');
    
    // Create collections and indexes
    await initializeCollections();
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('⚠️ Falling back to in-memory storage');
  }
}

async function initializeCollections() {
  try {
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Create collections if they don't exist
    const requiredCollections = ['users', 'dreams', 'profiles', 'subscriptions', 'credits', 'events'];
    for (const col of requiredCollections) {
      if (!collectionNames.includes(col)) {
        await db.createCollection(col);
        console.log(`Created collection: ${col}`);
      }
    }

    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('dreams').createIndex({ user_id: 1, created_at: -1 });
    await db.collection('profiles').createIndex({ user_id: 1 }, { unique: true });
    console.log('✅ Indexes created');
  } catch (err) {
    console.warn('⚠️ Collection initialization warning:', err.message);
  }
}

// Helper: Generate mock JWT token
function generateToken(userId) {
  return `jwt-${userId}-${Date.now()}`;
}

// Helper: Hash password (simple - use bcrypt in production!)
function hashPassword(password) {
  return Buffer.from(password).toString('base64');
}

// DB Abstraction - works with MongoDB or in-memory
const dbAdapter = {
  async findOne(collection, query) {
    if (useInMemory) {
      const data = inMemoryData[collection];
      if (!data) return null;
      for (const [key, doc] of data.entries()) {
        if (Object.entries(query).every(([k, v]) => doc[k] === v)) {
          return doc;
        }
      }
      return null;
    }
    return db.collection(collection).findOne(query);
  },

  async findMany(collection, query, options = {}) {
    if (useInMemory) {
      const data = inMemoryData[collection];
      if (!data) return [];
      let results = Array.from(data.values()).filter(doc =>
        Object.entries(query).every(([k, v]) => doc[k] === v)
      );
      if (options.sort) {
        const [[field, order]] = Object.entries(options.sort);
        results.sort((a, b) => {
          if (order === -1) return b[field] > a[field] ? 1 : -1;
          return a[field] > b[field] ? 1 : -1;
        });
      }
      return results.slice(options.skip || 0, (options.skip || 0) + (options.limit || 100));
    }
    let q = db.collection(collection).find(query);
    if (options.sort) q = q.sort(options.sort);
    if (options.skip) q = q.skip(options.skip);
    if (options.limit) q = q.limit(options.limit);
    return q.toArray();
  },

  async insertOne(collection, doc) {
    if (useInMemory) {
      const id = doc._id || `${collection}-${Date.now()}`;
      inMemoryData[collection].set(id, { _id: id, ...doc });
      return { insertedId: id };
    }
    return db.collection(collection).insertOne(doc);
  },

  async updateOne(collection, filter, update, options = {}) {
    if (useInMemory) {
      let found = false;
      for (const [key, doc] of inMemoryData[collection].entries()) {
        if (Object.entries(filter).every(([k, v]) => doc[k] === v)) {
          Object.assign(doc, update.$set || update);
          found = true;
          break;
        }
      }
      if (!found && options.upsert) {
        const id = filter._id || `${collection}-${Date.now()}`;
        inMemoryData[collection].set(id, { _id: id, ...filter, ...(update.$set || update) });
        return { upsertedCount: 1, modifiedCount: 0 };
      }
      return { modifiedCount: found ? 1 : 0 };
    }
    return db.collection(collection).updateOne(filter, update, options);
  },

  async deleteOne(collection, filter) {
    if (useInMemory) {
      for (const [key, doc] of inMemoryData[collection].entries()) {
        if (Object.entries(filter).every(([k, v]) => doc[k] === v)) {
          inMemoryData[collection].delete(key);
          return { deletedCount: 1 };
        }
      }
      return { deletedCount: 0 };
    }
    return db.collection(collection).deleteOne(filter);
  }
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Day Dream Dictionary API (MongoDB)' });
});

// API root
app.get('/api/v1', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Day Dream Dictionary API v1 (MongoDB)',
    version: '1.0.0',
    storage: useInMemory ? 'in-memory (dev)' : 'MongoDB (production)',
    endpoints: [
      'POST /api/v1/auth/signup',
      'POST /api/v1/auth/login',
      'GET /api/v1/auth/me',
      'POST /api/v1/dreams',
      'GET /api/v1/dreams',
      'GET /api/v1/dreams/:id',
      'DELETE /api/v1/dreams/:id',
      'POST /api/v1/dreams/interpret',
      'GET /api/v1/profile',
      'PUT /api/v1/profile',
      'GET /api/v1/profile/credits'
    ]
  });
});

// Auth Middleware
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.substring(7);
  // Extract user_id from token format "jwt-{userId}-{timestamp}"
  const match = token.match(/^jwt-(.+?)-\d+$/);
  if (!match) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  req.user = { id: match[1] };
  next();
}

// ===== Auth Endpoints =====

// Signup
app.post('/api/v1/auth/signup', async (req, res) => {
  try {
    const { email, password, displayName, locale } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existing = await dbAdapter.findOne('users', { email });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const userId = `user-${Date.now()}`;
    const user = {
      _id: userId,
      email,
      password: hashPassword(password),
      displayName: displayName || email.split('@')[0],
      locale: locale || 'en',
      created_at: new Date().toISOString()
    };

    await dbAdapter.insertOne('users', user);

    // Create profile
    await dbAdapter.insertOne('profiles', {
      _id: `profile-${userId}`,
      user_id: userId,
      display_name: user.displayName,
      locale: user.locale,
      preferences: {},
      created_at: new Date().toISOString()
    });

    // Create credits entry
    await dbAdapter.insertOne('credits', {
      _id: `credits-${userId}`,
      user_id: userId,
      balance: 0,
      lifetime_earned: 0,
      updated_at: new Date().toISOString()
    });

    // Create subscription entry
    await dbAdapter.insertOne('subscriptions', {
      _id: `sub-${userId}`,
      user_id: userId,
      plan: 'free',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const token = generateToken(userId);
    return res.status(201).json({
      accessToken: token,
      token,
      user: {
        id: userId,
        email: user.email,
        display_name: user.displayName,
        locale: user.locale
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed', message: err.message });
  }
});

// Login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await dbAdapter.findOne('users', { email });

    if (!user || user.password !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    return res.json({
      accessToken: token,
      token,
      user: {
        id: user._id,
        email: user.email,
        display_name: user.displayName,
        locale: user.locale
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// Get current user
app.get('/api/v1/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await dbAdapter.findOne('users', { _id: req.user.id });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id,
      email: user.email,
      display_name: user.displayName,
      locale: user.locale
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', message: err.message });
  }
});

// ===== Dream Endpoints =====

// Create dream
app.post('/api/v1/dreams', authMiddleware, async (req, res) => {
  try {
    const { dream_text, interpretation, metadata } = req.body;

    if (!dream_text) {
      return res.status(400).json({ error: 'Dream text is required' });
    }

    const dream = {
      _id: `dream-${Date.now()}`,
      user_id: req.user.id,
      dream_text,
      interpretation: interpretation || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dbAdapter.insertOne('dreams', dream);
    res.status(201).json({
      id: dream._id,
      ...dream
    });
  } catch (err) {
    console.error('Create dream error:', err);
    res.status(500).json({ error: 'Failed to create dream', message: err.message });
  }
});

// Get all dreams for user
app.get('/api/v1/dreams', authMiddleware, async (req, res) => {
  try {
    const userDreams = await dbAdapter.findMany('dreams', { user_id: req.user.id }, {
      sort: { created_at: -1 },
      limit: 100
    });

    res.json({
      dreams: userDreams.map(d => ({
        id: d._id,
        ...d
      }))
    });
  } catch (err) {
    console.error('Get dreams error:', err);
    res.status(500).json({ error: 'Failed to fetch dreams', message: err.message });
  }
});

// Get single dream
app.get('/api/v1/dreams/:id', authMiddleware, async (req, res) => {
  try {
    const dream = await dbAdapter.findOne('dreams', { _id: req.params.id });

    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    if (dream.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      id: dream._id,
      ...dream
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dream', message: err.message });
  }
});

// Delete dream
app.delete('/api/v1/dreams/:id', authMiddleware, async (req, res) => {
  try {
    const dream = await dbAdapter.findOne('dreams', { _id: req.params.id });

    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    if (dream.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await dbAdapter.deleteOne('dreams', { _id: req.params.id });
    res.json({ message: 'Dream deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dream', message: err.message });
  }
});

// Interpret dream (mock - returns sample interpretation)
app.post('/api/v1/dreams/interpret', authMiddleware, async (req, res) => {
  try {
    const { dream_text } = req.body;

    if (!dream_text) {
      return res.status(400).json({ error: 'Dream text is required' });
    }

    // TODO: Call OpenRouter API for real interpretation
    // For now, return mock interpretation
    const mockInterpretation = {
      mainThemes: ['transformation', 'freedom'],
      emotionalTone: 'hopeful and introspective',
      symbols: [
        { symbol: 'flying', meaning: 'Liberation and transcendence' },
        { symbol: 'sky', meaning: 'Limitless possibilities' }
      ],
      personalInsight: 'You are seeking freedom and exploring new possibilities in your life.',
      guidance: 'Embrace the changes ahead with confidence and trust your intuition.'
    };

    // Save the dream with interpretation
    const dream = {
      _id: `dream-${Date.now()}`,
      user_id: req.user.id,
      dream_text,
      interpretation: mockInterpretation,
      metadata: { interpreted_at: new Date().toISOString() },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await dbAdapter.insertOne('dreams', dream);

    res.json({
      id: dream._id,
      dream_text,
      interpretation: mockInterpretation,
      created_at: dream.created_at
    });
  } catch (err) {
    console.error('Interpret dream error:', err);
    res.status(500).json({ error: 'Failed to interpret dream', message: err.message });
  }
});

// ===== Profile Endpoints =====

// Get profile
app.get('/api/v1/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await dbAdapter.findOne('profiles', { user_id: req.user.id });

    res.json(profile || {
      user_id: req.user.id,
      display_name: 'User',
      locale: 'en',
      preferences: {}
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile', message: err.message });
  }
});

// Update profile
app.put('/api/v1/profile', authMiddleware, async (req, res) => {
  try {
    const { display_name, locale, preferences } = req.body;

    const update = { updated_at: new Date().toISOString() };
    if (display_name) update.display_name = display_name;
    if (locale) update.locale = locale;
    if (preferences) update.preferences = preferences;

    const result = await dbAdapter.updateOne('profiles', { user_id: req.user.id }, { $set: update }, { upsert: true });

    res.json({ message: 'Profile updated', modified: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile', message: err.message });
  }
});

// Get credits
app.get('/api/v1/profile/credits', authMiddleware, async (req, res) => {
  try {
    const creditDoc = await dbAdapter.findOne('credits', { user_id: req.user.id });

    res.json(creditDoc || {
      user_id: req.user.id,
      balance: 0,
      lifetime_earned: 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch credits', message: err.message });
  }
});

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
async function startServer() {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`\n🌙 Day Dream Dictionary API (MongoDB)`);
    console.log(`📍 Server running on http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/v1`);
    console.log(`❤️ Health: http://localhost:${PORT}/health`);
    console.log('Storage mode:', useInMemory ? '🧠 In-Memory (Dev)' : '💾 MongoDB (Prod)');
    console.log('\nAvailable endpoints:');
    console.log('  POST /api/v1/auth/signup');
    console.log('  POST /api/v1/auth/login');
    console.log('  GET  /api/v1/auth/me');
    console.log('  POST /api/v1/dreams');
    console.log('  GET  /api/v1/dreams');
    console.log('  GET  /api/v1/dreams/:id');
    console.log('  DELETE /api/v1/dreams/:id');
    console.log('  POST /api/v1/dreams/interpret');
    console.log('  GET  /api/v1/profile');
    console.log('  PUT  /api/v1/profile');
    console.log('  GET  /api/v1/profile/credits\n');
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (dbClient) await dbClient.close();
  process.exit(0);
});

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
