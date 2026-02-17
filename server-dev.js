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
  profiles: new Map(),
  subscriptions: new Map()
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

// Helper: Get monthly usage for user in dev mode
function getMonthlyUsageDevMode(userId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const dreamsThisMonth = Array.from(storage.dreams.values())
    .filter(d => 
      d.user_id === userId && 
      d.created_at >= startOfMonth && 
      d.created_at <= endOfMonth
    );
  
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

// Dynamic mock interpretation generator (same logic as production mock)
function generateMockInterpretation(text, opts = {}) {
  const { type = 'basic' } = opts;
  const raw = (text || '').toLowerCase();
  const words = raw.match(/\b[a-z]{3,}\b/g) || [];
  const stop = new Set(['the','and','you','for','with','that','this','are','was','were','but','your','have','has','had','not','from','they','them','their','what','who','when','where']);
  const freqs = {};
  for (const w of words) if (!stop.has(w)) freqs[w] = (freqs[w] || 0) + 1;
  const entries = Object.entries(freqs).sort((a,b) => b[1]-a[1]);
  const themeCount = type === 'deep' ? 5 : type === 'premium' ? 6 : 3;
  const themes = entries.slice(0, themeCount).map(e => e[0]).filter(Boolean);

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

  const emotionalTone = raw.includes('sad') || raw.includes('cry') ? 'sad' : raw.includes('happy') || raw.includes('joy') ? 'joyful' : 'reflective';

  const normalizedThemes = themes.map(t => t.replace(/[-_]/g, ' ').trim());

  let personalInsight = '';
  let guidance = '';
  if (normalizedThemes.length) {
    if (type === 'basic') {
      personalInsight = `Your dream mentions ${normalizedThemes.join(', ')} — this may show what occupies your thoughts.`;
      guidance = `Notice how ${normalizedThemes[0]} appears in your day-to-day life and reflect on small steps you could take.`;
    } else if (type === 'deep') {
      personalInsight = `The repeated motifs of ${normalizedThemes.join(', ')} suggest deeper patterns and possible emotional drivers.`;
      guidance = `Journal about when you feel connected to ${normalizedThemes[0]} and consider specific changes to align your actions with those feelings.`;
    } else {
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
    const metadata = req.body.metadata || {};
    const interpretationType = metadata.interpretation_type || metadata.interpretationType || 'basic';
    const interpretation = generateMockInterpretation(dream_text, { type: interpretationType });

    // Get monthly usage
    const monthlyUsage = getMonthlyUsageDevMode(req.user_id);
    
    // Get user subscription to check limits
    const userProfile = storage.profiles.get(req.user_id) || {};
    const userSub = userProfile.subscription || {
      plan: 'basic',
      monthlyLimits: { basic: 20, deep: 5 }
    };
    
    // Check if user has exceeded their monthly limit
    const typeKey = interpretationType === 'deep' ? 'deep' : 'basic';
    const currentUsage = monthlyUsage[typeKey] || 0;
    const limit = userSub.monthlyLimits?.[typeKey] || (typeKey === 'deep' ? 5 : 20);
    const hasExceededLimit = currentUsage >= limit;

    const dreamId = `dream${Date.now()}`;
    const dreamRecord = {
      _id: dreamId,
      dream_text,
      interpretation,
      created_at: new Date(),
      user_id: req.user_id
    };
    
    // Store the dream
    storage.dreams.set(dreamId, dreamRecord);
    
    // Calculate new usage
    const newUsage = { ...monthlyUsage };
    newUsage[typeKey] = (newUsage[typeKey] || 0) + 1;
    const basicRemaining = Math.max(0, (userSub.monthlyLimits?.basic || 20) - newUsage.basic);
    const deepRemaining = Math.max(0, (userSub.monthlyLimits?.deep || 5) - newUsage.deep);

    // Debug log
    console.log('DEV Interpret:', { input: dream_text.slice(0,200), type: interpretationType, usage: newUsage });

    res.json({
      id: dreamId,
      dream_text,
      interpretation,
      created_at: new Date().toISOString(),
      mode: 'mock',
      type: interpretationType,
      limitExceeded: hasExceededLimit,
      warning: hasExceededLimit ? `⚠️ You've reached your ${typeKey} interpretation limit for this month (${limit}/${limit})` : null,
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
    console.error('Interpretation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get profile with subscription and real-time credits
app.get('/api/v1/profile', authMiddleware, checkDB, async (req, res) => {
  try {
    const profile = storage.profiles.get(req.user_id) || {};
    
    // Count dreams for the user
    const dreamCount = Array.from(storage.dreams.values())
      .filter(d => d.user_id === req.user_id).length;
    
    // Get monthly usage
    const monthlyUsage = getMonthlyUsageDevMode(req.user_id);
    
    // Default subscription data
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
    
    const subscription = profile.subscription || defaultSubscription;
    
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
    
    const credits = profile.credits || 'unlimited';
    
    res.json({
      profile: {
        user_id: req.user_id,
        display_name: profile.display_name || 'User',
        locale: profile.locale || 'en',
        preferences: profile.preferences || {},
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

// Get dream statistics with real-time credits
app.get('/api/v1/dreams/stats', authMiddleware, checkDB, async (req, res) => {
  try {
    const userDreams = Array.from(storage.dreams.values())
      .filter(d => d.user_id === req.user_id);
    
    // Get monthly usage
    const monthlyUsage = getMonthlyUsageDevMode(req.user_id);
    
    // Get user subscription
    const userProfile = storage.profiles.get(req.user_id) || {};
    const userSub = userProfile.subscription || {
      plan: 'basic',
      monthlyLimits: { basic: 20, deep: 5 }
    };
    
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
