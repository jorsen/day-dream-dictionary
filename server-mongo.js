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

// CORS configuration - permissive for all origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

// Middleware
// Explicit CORS headers middleware to ensure every response (including OPTIONS)
// includes the required CORS headers. This avoids missing headers on some
// error or proxy responses in hosted environments.
app.use((req, res, next) => {
  const allowed = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : ['*'];
  const origin = req.headers.origin;
  const allowOrigin = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  // If the browser sends credentials, reflect origin and allow credentials
  if (allowOrigin !== '*') res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(__dirname));

// Connect to MongoDB with retry
async function connect() {
  let retries = 5;
  let lastError;
  while (retries > 0) {
    try {
      console.log(`⏳ Connecting to MongoDB (attempt ${6-retries}/5)...`);
      const client = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await client.connect();
      db = client.db(MONGODB_DB);
      console.log('✅ MongoDB connected');
     
      // Create indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true }).catch(() => {});
      await db.collection('dreams').createIndex({ user_id: 1, created_at: -1 }).catch(() => {});
      return; // Success
    } catch (err) {
      lastError = err;
      retries--;
      console.error(`❌ Attempt failed (${retries} retries left): ${err.message}`);
      if (retries > 0) {
        console.log('⏳ Retrying in 3 seconds...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  
  // All retries exhausted
  throw new Error(`MongoDB connection failed after retries: ${lastError?.message || 'Unknown error'}`);
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

// Middleware: Check database connection
function checkDB(req, res, next) {
  if (!db) {
    console.error('Database not connected!');
    return res.status(503).json({ error: 'Database not connected. Server starting up.' });
  }
  next();
}

// Generate a simple dynamic mock interpretation based on the dream text
function generateMockInterpretation(text, opts = {}) {
  const { type = 'basic' } = opts;
  const raw = (text || '').toLowerCase();
  const words = raw.match(/\b[a-z]{3,}\b/g) || [];
  const stop = new Set(['the','and','you','for','with','that','this','are','was','were','but','your','have','has','had','not','from','they','them','their','what','who','when','where']);
  const freqs = {};
  for (const w of words) if (!stop.has(w)) freqs[w] = (freqs[w] || 0) + 1;
  const entries = Object.entries(freqs).sort((a,b) => b[1]-a[1]);
  // Decide how many themes to extract by interpretation type
  const themeCount = type === 'deep' ? 5 : type === 'premium' ? 6 : 3;
  const themes = entries.slice(0, themeCount).map(e => e[0]).filter(Boolean);

  // Normalize themes to be human-friendly short phrases
  const normalizedThemes = themes.map(t => t.replace(/[-_]/g, ' ').trim()).map(t => {
    // Expand some common tokens to friendlier words
    if (t === 'dreams' || t === 'dream') return 'dreaming';
    if (t === 'testing') return 'testing/analysis';
    if (t === 'self') return 'self';
    return t;
  }).slice(0,3);

  const symbolMap = {
    'water': 'Emotions and the unconscious',
    'fire': 'Passion, transformation, or destruction',
    'flying': 'Freedom and escape',
    'horse': 'Strength and drive',
    'teeth': 'Anxiety about appearance or loss',
    'death': 'Transition and change',
    'house': 'Self or family life',
    'baby': 'New beginnings',
  };

  const pickSymbols = [];
  for (const t of themes) {
    const meaning = symbolMap[t] || `Related to ${t}`;
    const significance = themes.indexOf(t) === 0 ? 'high' : themes.indexOf(t) <= 2 ? 'medium' : 'low';
    pickSymbols.push({ symbol: t, meaning, significance });
  }

  if (pickSymbols.length === 0) {
    pickSymbols.push({ symbol: 'journey', meaning: 'Personal growth and exploration', significance: 'medium' });
  }

  // Emotional tone detection
  const emotionalTone = raw.includes('sad') || raw.includes('cry') ? 'sad' : raw.includes('happy') || raw.includes('joy') ? 'joyful' : 'reflective';

  // Tailor output by interpretation `type`
  let personalInsight = '';
  let guidance = '';
  if (normalizedThemes.length) {
    if (type === 'basic') {
      personalInsight = `Your dream mentions ${normalizedThemes.join(', ')} — this may show what occupies your thoughts.`;
      guidance = `Notice how ${normalizedThemes[0]} appears in your day-to-day life and reflect on small steps you could take.`;
    } else if (type === 'deep') {
      personalInsight = `The repeated motifs of ${normalizedThemes.join(', ')} suggest deeper patterns and possible emotional drivers.`;
      guidance = `Journal about when you feel connected to ${normalizedThemes[0]} and consider specific changes to align your actions with those feelings.`;
    } else { // premium
      personalInsight = `A close look at ${normalizedThemes.join(', ')} points to both conscious goals and unconscious motivations — exploring these can be transformative.`;
      guidance = `Try a focused reflection: map recent events tied to ${normalizedThemes[0]}, set one measurable goal, and revisit in two weeks to observe change.`;
    }
  } else {
    personalInsight = `This dream points to emotions and themes worth reflecting on.`;
    guidance = `Spend time journaling how the dream made you feel and any parallels to your daily life.`;
  }

  return {
    mainThemes: normalizedThemes.length ? normalizedThemes : ['introspection','emotion'],
    emotionalTone,
    symbols: pickSymbols,
    personalInsight,
    guidance,
    type
  };
}

// Routes

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: db ? 'connected' : 'disconnected' });
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

app.get('/api/v1/debug/stats', async (req, res) => {
  try {
    const userCount = await db.collection('users').countDocuments();
    const dreamCount = await db.collection('dreams').countDocuments();
    res.json({ 
      database: 'connected',
      users: userCount, 
      dreams: dreamCount,
      message: userCount === 0 ? 'No users in database. Try signup first or run migration.' : 'Ready'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth: Signup
app.post('/api/v1/auth/signup', checkDB, async (req, res) => {
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
      emailVerified: false,
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

// Auth: Demo login — creates demo user if not exists, then logs in
app.post('/api/v1/auth/demo', checkDB, async (req, res) => {
  const DEMO_EMAIL = 'sample1@gmail.com';
  const DEMO_PASSWORD = 'sample';
  const DEMO_NAME = 'Demo User';

  try {
    const users = db.collection('users');
    let user = await users.findOne({ email: DEMO_EMAIL });

    if (!user) {
      const userId = `demo_user_${Date.now()}`;
      await users.insertOne({
        _id: userId,
        email: DEMO_EMAIL,
        password: hashPassword(DEMO_PASSWORD),
        displayName: DEMO_NAME,
        created_at: new Date()
      });
      user = await users.findOne({ email: DEMO_EMAIL });
    }

    const token = generateToken(user._id);
    res.json({
      accessToken: token,
      user: { id: user._id, email: user.email, display_name: user.displayName }
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Auth: Get current user
app.get('/api/v1/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: req.user_id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified || false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Create
app.post('/api/v1/dreams', checkDB, authMiddleware, async (req, res) => {
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

// Dreams: Get all for user (paginated)
app.get('/api/v1/dreams', checkDB, authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const collection = db.collection('dreams');
    const [dreams, total] = await Promise.all([
      collection.find({ user_id: req.user_id }).sort({ created_at: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments({ user_id: req.user_id })
    ]);

    res.json({
      dreams: dreams.map(d => ({ id: d._id.toString(), ...d })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dreams: Interpret
app.post('/api/v1/dreams/interpret', checkDB, authMiddleware, async (req, res) => {
  try {
    const { dream_text } = req.body;
    if (!dream_text) return res.status(400).json({ error: 'Dream text required' });

    const metadata = req.body.metadata || {};
    const interpretationType = metadata.interpretation_type || metadata.interpretationType || 'basic';

    // Get current monthly usage and subscription BEFORE generating anything
    const monthlyUsage = await getMonthlyUsage(req.user_id);
    const profile = await db.collection('profiles').findOne({ user_id: req.user_id }) || {};
    const userSub = profile.subscription || {
      plan: 'basic',
      monthlyLimits: { basic: 20, deep: 5 }
    };

    const typeKey = interpretationType === 'deep' ? 'deep' : 'basic';
    const currentUsage = monthlyUsage[typeKey] || 0;
    const limit = userSub.monthlyLimits?.[typeKey] || (typeKey === 'deep' ? 5 : 20);

    // Block request if limit is reached
    if (currentUsage >= limit) {
      return res.status(429).json({
        error: `Monthly ${typeKey} interpretation limit reached (${limit}/${limit})`,
        limitExceeded: true,
        creditsRemaining: {
          basic: Math.max(0, (userSub.monthlyLimits?.basic || 20) - monthlyUsage.basic),
          deep: Math.max(0, (userSub.monthlyLimits?.deep || 5) - monthlyUsage.deep)
        },
        monthlyUsage: { basic: monthlyUsage.basic, deep: monthlyUsage.deep }
      });
    }

    const interpretation = generateMockInterpretation(dream_text, { type: interpretationType });

    const dream = {
      _id: new ObjectId(),
      user_id: req.user_id,
      dream_text,
      interpretation,
      created_at: new Date()
    };

    await db.collection('dreams').insertOne(dream);
    
    // Calculate remaining credits for this month
    const newUsage = monthlyUsage;
    newUsage[typeKey] = (newUsage[typeKey] || 0) + 1;
    const basicRemaining = Math.max(0, (userSub.monthlyLimits?.basic || 20) - newUsage.basic);
    const deepRemaining = Math.max(0, (userSub.monthlyLimits?.deep || 5) - newUsage.deep);
    
    console.log('Interpret request:', { input: dream_text.slice(0,200), type: interpretationType, usage: newUsage });
    
    res.json({
      id: dream._id.toString(),
      dream_text,
      interpretation,
      created_at: dream.created_at.toISOString(),
      creditsRemaining: {
        basic: basicRemaining,
        deep: deepRemaining,
        display: `${basicRemaining} basic / ${deepRemaining} deep remaining`
      },
      monthlyUsage: {
        basic: newUsage.basic,
        deep: newUsage.deep
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // ===== Profile Endpoints =====

  // Get profile
  app.get('/api/v1/profile', authMiddleware, checkDB, async (req, res) => {
    try {
      const profile = await db.collection('profiles').findOne({ user_id: req.user_id });
      
      // Get dream stats for subscription validation
      const dreamCount = await db.collection('dreams').countDocuments({ user_id: req.user_id });
      
      // Get monthly usage
      const monthlyUsage = await getMonthlyUsage(req.user_id);
      
      // Default subscription data (Basic plan - paid version with good limits)
      const defaultSubscription = {
        plan: 'basic',
        planName: 'Basic Plan',
        planType: 'basic',
        price: 4.99,
        status: 'active',
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyLimits: {
          basic: 20,
          deep: 5
        },
        monthlyUsage: {
          basic: monthlyUsage.basic,
          deep: monthlyUsage.deep
        },
        monthlyRemaining: {
          basic: Math.max(0, 20 - monthlyUsage.basic),
          deep: Math.max(0, 5 - monthlyUsage.deep)
        },
        features: ['20_basic_interpretations', '5_deep_interpretations', 'unlimited_history', 'pdf_export', 'no_ads']
      };
      
      const subscription = profile?.subscription || defaultSubscription;
      
      // Ensure monthly usage and remaining are always calculated
      if (!subscription.monthlyUsage) {
        subscription.monthlyUsage = {
          basic: monthlyUsage.basic,
          deep: monthlyUsage.deep
        };
      }
      if (!subscription.monthlyRemaining) {
        subscription.monthlyRemaining = {
          basic: Math.max(0, (subscription.monthlyLimits?.basic || 20) - monthlyUsage.basic),
          deep: Math.max(0, (subscription.monthlyLimits?.deep || 5) - monthlyUsage.deep)
        };
      }
      
      const credits = profile?.credits || 'unlimited';
      
      if (profile) {
        return res.json({ 
          profile: {
            ...profile,
            subscription,
            credits,
            dream_count: dreamCount
          } 
        });
      }
      
      return res.json({ 
        profile: { 
          user_id: req.user_id, 
          display_name: 'User', 
          locale: 'en', 
          preferences: {},
          subscription,
          credits,
          dream_count: dreamCount
        } 
      });
    } catch (err) {
      console.error('Profile fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch profile', message: err.message });
    }
  });

  // Helper: Get monthly usage for user
  async function getMonthlyUsage(userId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const dreamsThisMonth = await db.collection('dreams')
      .find({
        user_id: userId,
        created_at: { $gte: startOfMonth, $lte: endOfMonth }
      }).toArray();
    
    let basicUsed = 0;
    let deepUsed = 0;
    dreamsThisMonth.forEach(d => {
      if (d.interpretation && d.interpretation.type) {
        if (d.interpretation.type === 'deep') deepUsed++;
        else if (d.interpretation.type === 'basic') basicUsed++;
      }
    });
    
    return { basic: basicUsed, deep: deepUsed };
  }

  // Get dream statistics with real-time credit info
  app.get('/api/v1/dreams/stats', authMiddleware, checkDB, async (req, res) => {
    try {
      const dreamCollection = db.collection('dreams');
      
      // Get all dreams for the user
      const userDreams = await dreamCollection.find({ user_id: req.user_id }).toArray();
      
      // Get user credits and subscription
      const profile = await db.collection('profiles').findOne({ user_id: req.user_id }) || {};
      const userSub = profile.subscription || {
        plan: 'basic',
        monthlyLimits: { basic: 20, deep: 5 }
      };
      
      // Get monthly usage
      const monthlyUsage = await getMonthlyUsage(req.user_id);
      
      // Calculate remaining credits for this month
      const basicRemaining = Math.max(0, (userSub.monthlyLimits?.basic || 20) - monthlyUsage.basic);
      const deepRemaining = Math.max(0, (userSub.monthlyLimits?.deep || 5) - monthlyUsage.deep);
      
      // Calculate total credits used ever
      let totalCreditsUsed = 0;
      userDreams.forEach(d => {
        if (d.interpretation && d.interpretation.type) {
          const typeMap = { basic: 1, deep: 3, premium: 5 };
          totalCreditsUsed += typeMap[d.interpretation.type] || 1;
        }
      });
      
      const totalDreams = userDreams.length;
      const totalInterpretations = userDreams.filter(d => d.interpretation).length;
      const dreamsThisMonth = monthlyUsage.basic + monthlyUsage.deep;
      
      res.json({
        stats: {
          totalDreams,
          total_dreams: totalDreams,
          totalInterpretations,
          total_interpretations: totalInterpretations,
          thisMonth: dreamsThisMonth,
          this_month: dreamsThisMonth,
          creditsUsed: totalCreditsUsed,
          credits_used: totalCreditsUsed,
          monthlyUsage: {
            basic: monthlyUsage.basic,
            deep: monthlyUsage.deep
          },
          monthlyRemaining: {
            basic: basicRemaining,
            deep: deepRemaining
          },
          creditsRemaining: `${basicRemaining} basic / ${deepRemaining} deep`
        }
      });
    } catch (err) {
      console.error('Dream stats error:', err);
      res.status(500).json({ error: 'Failed to fetch stats', message: err.message });
    }
  });

  // Update profile
  app.put('/api/v1/profile', authMiddleware, checkDB, async (req, res) => {
    try {
      const { display_name, locale, preferences } = req.body;
      const update = { updated_at: new Date().toISOString() };
      if (display_name) update.display_name = display_name;
      if (locale) update.locale = locale;
      if (preferences) update.preferences = preferences;
      const result = await db.collection('profiles').updateOne({ user_id: req.user_id }, { $set: update }, { upsert: true });
      res.json({ message: 'Profile updated', modified: result.modifiedCount || 0 });
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Failed to update profile', message: err.message });
    }
  });

  // Update user details (displayName, email)
  app.patch('/api/v1/user', checkDB, authMiddleware, async (req, res) => {
    try {
      const { displayName, email } = req.body;
      if (!displayName && !email) return res.status(400).json({ error: 'No fields to update' });
      const update = {};
      if (displayName) update.displayName = displayName.trim();
      if (email) {
        const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim(), _id: { $ne: req.user_id } });
        if (existing) return res.status(409).json({ error: 'Email already in use' });
        update.email = email.toLowerCase().trim();
      }
      await db.collection('users').updateOne({ _id: req.user_id }, { $set: update });
      const user = await db.collection('users').findOne({ _id: req.user_id });
      res.json({ message: 'Account updated', user: { id: user._id, email: user.email, displayName: user.displayName } });
    } catch (err) {
      console.error('User update error:', err);
      res.status(500).json({ error: 'Failed to update account', message: err.message });
    }
  });

  // Change password
  app.post('/api/v1/auth/change-password', checkDB, authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword are required' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      const user = await db.collection('users').findOne({ _id: req.user_id });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.password !== hashPassword(currentPassword)) return res.status(401).json({ error: 'Current password is incorrect' });
      await db.collection('users').updateOne({ _id: req.user_id }, { $set: { password: hashPassword(newPassword) } });
      res.json({ message: 'Password updated' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ error: 'Failed to change password', message: err.message });
    }
  });

  // Send email verification token
  app.post('/api/v1/auth/send-verification', checkDB, authMiddleware, async (req, res) => {
    try {
      const user = await db.collection('users').findOne({ _id: req.user_id });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.emailVerified) return res.status(400).json({ error: 'Email is already verified' });

      const crypto = require('crypto');
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.collection('verification_tokens').deleteMany({ user_id: req.user_id, type: 'email' });
      await db.collection('verification_tokens').insertOne({ token, user_id: req.user_id, type: 'email', expires_at: expiresAt });

      const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${baseUrl}/verify-email.html?token=${token}`;
      res.json({ message: 'Verification token created', verifyUrl });
    } catch (err) {
      console.error('Send verification error:', err);
      res.status(500).json({ error: 'Failed to create verification token', message: err.message });
    }
  });

  // Verify email via token
  app.get('/api/v1/auth/verify-email', checkDB, async (req, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: 'Token is required' });

      const record = await db.collection('verification_tokens').findOne({ token, type: 'email' });
      if (!record) return res.status(400).json({ error: 'Invalid or expired verification token' });
      if (new Date() > new Date(record.expires_at)) {
        await db.collection('verification_tokens').deleteOne({ token });
        return res.status(400).json({ error: 'Verification token has expired. Please request a new one.' });
      }

      await db.collection('users').updateOne({ _id: record.user_id }, { $set: { emailVerified: true } });
      await db.collection('verification_tokens').deleteOne({ token });
      res.json({ message: 'Email verified successfully' });
    } catch (err) {
      console.error('Verify email error:', err);
      res.status(500).json({ error: 'Failed to verify email', message: err.message });
    }
  });

  // Get credits
  app.get('/api/v1/profile/credits', authMiddleware, checkDB, async (req, res) => {
    try {
      const creditDoc = await db.collection('credits').findOne({ user_id: req.user_id });
      if (creditDoc) return res.json(creditDoc);
      return res.json({ user_id: req.user_id, balance: 0, lifetime_earned: 0 });
    } catch (err) {
      console.error('Credits fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch credits', message: err.message });
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
  console.log('🚀 Starting app...');
  console.log(`📡 Connecting to MongoDB: ${MONGODB_URI.substring(0, 50)}...`);
  
  try {
    await connect();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('App cannot start without database connection.');
    process.exit(1);
  }
  
  if (!db) {
    console.error('Database connection failed (db is null)');
    process.exit(1);
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌙 Day Dream Dictionary API`);
    console.log(`📍 Listening on port ${PORT}`);
    console.log(`🔗 http://0.0.0.0:${PORT}/health`);
    console.log(`💾 MongoDB: ${MONGODB_DB}\n`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
