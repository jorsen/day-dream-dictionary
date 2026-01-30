const http = require('http');
const fs = require('fs');
const path = require('path');

// API Server integration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// In-memory storage for dreams (will sync to Supabase when possible)
let dreamStorage = [];
let dreamIdCounter = 1;

// User management
const users = new Map();
const userSubscriptions = new Map();
const userCredits = new Map();
const userPurchases = new Map();

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        monthlyLimits: {
            basic: 5,
            deep: 1
        },
        features: ['basic_interpretations', 'limited_history', 'ads'],
        description: '5 basic + 1 deep interpretation per month'
    },
    basic: {
        name: 'Basic Plan',
        price: 4.99,
        monthlyLimits: {
            basic: 20,
            deep: 5
        },
        features: ['20_basic_interpretations', '5_deep_interpretations', 'unlimited_history', 'pdf_export', 'no_ads'],
        description: '20 basic interpretations, 5 deep interpretations per month'
    },
    pro: {
        name: 'Pro Plan',
        price: 12.99,
        monthlyLimits: {
            basic: -1, // unlimited
            deep: -1  // unlimited
        },
        features: ['unlimited_interpretations', 'analytics', 'voice_journaling', 'reminders', 'symbol_encyclopedia', 'no_ads'],
        description: 'Unlimited interpretations + premium features'
    }
};

// Initialize user data
const initializeUserData = (userId) => {
    if (!userSubscriptions.has(userId)) {
        userSubscriptions.set(userId, {
            plan: 'basic',
            startDate: new Date().toISOString(),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            features: [...SUBSCRIPTION_PLANS.basic.features],
            monthlyUsage: { basic: 0, deep: 0 }
        });
    }

    if (!userCredits.has(userId)) {
        userCredits.set(userId, 0); // Start with 0 credits for new users
    }

    if (!userPurchases.has(userId)) {
        userPurchases.set(userId, []);
    }
};

// Helper function to extract user ID from JWT token
const extractUserIdFromToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    // Mock JWT token format: mock-jwt-token-{userId}-{timestamp}
    const match = token.match(/^mock-jwt-token-(.+)-\d+$/);
    return match ? match[1] : null;
};

// Helper function to make HTTP requests to Supabase
async function makeSupabaseRequest(method, endpoint, data = null) {
    const options = {
        hostname: 'gwgjckczyscpaozlevpe.supabase.co',
        port: 443,
        path: `/rest/v1/${endpoint}`,
        method: method,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };

    if (data) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    return new Promise((resolve, reject) => {
        const req = require('https').request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(body);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => {
            console.log('Supabase connection failed, using local storage:', err.message);
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Dream interpretation functions
const getMockInterpretation = (dreamText) => {
    const text = dreamText.toLowerCase();
    const detectedSymbols = [];
    const detectedEmotions = [];

    // Basic symbol detection for demo
    const symbolDb = {
        'water': 'Emotions, subconscious mind',
        'flying': 'Freedom, transcendence',
        'falling': 'Loss of control, anxiety',
        'snake': 'Transformation, healing'
    };

    for (const [symbol, meaning] of Object.entries(symbolDb)) {
        if (text.includes(symbol)) {
            detectedSymbols.push({
                symbol: symbol,
                meaning: meaning,
                significance: 'medium'
            });
        }
    }

    // Basic emotion detection
    const emotionDb = {
        'happy': 'joyful',
        'sad': 'sad',
        'scared': 'fearful',
        'angry': 'angry'
    };

    for (const [word, emotion] of Object.entries(emotionDb)) {
        if (text.includes(word)) {
            detectedEmotions.push(emotion);
        }
    }

    return {
        mainThemes: ['personal_growth', 'self_discovery'],
        emotionalTone: detectedEmotions.length > 0 ? 'Mixed emotions present' : 'Neutral dream experience',
        symbols: detectedSymbols.slice(0, 3),
        personalInsight: 'Your dream reflects aspects of your subconscious processing recent experiences.',
        guidance: 'Consider how these dream elements might relate to your current life circumstances.'
    };
};

const PORT = process.env.PORT || 3000;

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  // Handle API routes
  if (pathname.startsWith('/api/v1/')) {
    // Handle dream interpretation API
    if (pathname === '/api/v1/dreams/test-interpret' && method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
          try {
            const data = JSON.parse(body);

            // AUTHENTICATION REQUIRED: Check for user authentication
            const authHeader = req.headers.authorization || req.headers['Authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              console.error('❌ No authentication token provided');
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Authentication required. Please sign up/login first.' }));
              return;
            }

            const userId = extractUserIdFromToken(authHeader);
            if (!userId) {
              console.error('❌ Invalid authentication token');
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid authentication token. Please login again.' }));
              return;
            }

            console.log(`Processing authenticated dream interpretation for user: ${userId}`);

            // Check and deduct credits before processing
            initializeUserData(userId);
            const subscription = userSubscriptions.get(userId);
            const interpretationType = data.interpretationType || 'basic';

            // Check if user has enough credits
            if (interpretationType === 'basic' && subscription.monthlyUsage.basic >= SUBSCRIPTION_PLANS.basic.monthlyLimits.basic) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Monthly basic interpretation limit reached. Upgrade to continue.' }));
              return;
            }

            if (interpretationType === 'deep' && subscription.monthlyUsage.deep >= SUBSCRIPTION_PLANS.basic.monthlyLimits.deep) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Monthly deep interpretation limit reached. Upgrade to continue.' }));
              return;
            }

            // Deduct credit
            if (interpretationType === 'basic') {
              subscription.monthlyUsage.basic += 1;
            } else if (interpretationType === 'deep') {
              subscription.monthlyUsage.deep += 1;
            }

            // Calculate remaining credits for response
            const monthlyLimits = SUBSCRIPTION_PLANS.basic.monthlyLimits;
            const basicRemaining = Math.max(0, monthlyLimits.basic - subscription.monthlyUsage.basic);
            const deepRemaining = Math.max(0, monthlyLimits.deep - subscription.monthlyUsage.deep);

            console.log(`User ${userId} credit usage: Basic=${subscription.monthlyUsage.basic}/${monthlyLimits.basic}, Deep=${subscription.monthlyUsage.deep}/${monthlyLimits.deep}`);

            const interpretation = getMockInterpretation(data.dreamText);

            const dreamData = {
              id: dreamIdCounter.toString(),
              dream_text: data.dreamText,
              interpretation_type: interpretationType,
              interpretation: interpretation,
              created_at: new Date().toISOString(),
              user_id: userId,
              credits_consumed: interpretationType === 'basic' ? 1 : 2, // Basic = 1 credit, Deep = 2 credits
              credits_remaining: `${basicRemaining} basic / ${deepRemaining} deep`
            };

            // Store in Supabase (required - no fallback to local)
            try {
              const supabaseResponse = await makeSupabaseRequest('POST', 'dreams', {
                dream_text: dreamData.dream_text,
                interpretation_type: dreamData.interpretation_type,
                interpretation: dreamData.interpretation,
                user_id: dreamData.user_id,
                created_at: dreamData.created_at
              });

              if (supabaseResponse.status >= 200 && supabaseResponse.status < 300) {
                console.log(`✅ Dream successfully stored in Supabase for user ${userId}`);
                // Update local counters for stats (filtered by user)
                dreamStorage.push(dreamData);
                dreamIdCounter++;
              } else {
                console.error('❌ Failed to store dream in Supabase:', supabaseResponse);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Database storage failed' }));
                return;
              }
            } catch (supabaseError) {
              console.error('❌ Supabase connection error:', supabaseError);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Database connection failed' }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ dream: dreamData }));
        } catch (error) {
          console.error('Error processing dream:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid request data' }));
        }
      });
      return;
    }

    // Handle dreams list API
    if (pathname === '/api/v1/dreams' && method === 'GET') {
      // AUTHENTICATION REQUIRED: Check for user authentication
      const authHeader = req.headers.authorization || req.headers['Authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('❌ No authentication token for dreams list');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required. Please sign up/login first.' }));
        return;
      }

      const userId = extractUserIdFromToken(authHeader);
      if (!userId) {
        console.error('❌ Invalid authentication token for dreams list');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid authentication token. Please login again.' }));
        return;
      }

      // Read from Supabase with user filtering
      makeSupabaseRequest('GET', `dreams?user_id=eq.${userId}&order=created_at.desc&limit=10`)
        .then(supabaseResponse => {
          if (supabaseResponse.status >= 200 && supabaseResponse.status < 300) {
            const dreams = Array.isArray(supabaseResponse.data) ? supabaseResponse.data : [];
            console.log(`📋 Retrieved ${dreams.length} dreams from Supabase for user ${userId}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ dreams: dreams }));
          } else {
            console.error('❌ Failed to fetch dreams from Supabase:', supabaseResponse);
            // Fallback to local storage filtered by user
            const userDreams = dreamStorage.filter(dream => dream.user_id === userId).slice(-10);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ dreams: userDreams }));
          }
        })
        .catch(error => {
          console.error('❌ Database error fetching dreams:', error);
          // Fallback to local storage filtered by user
          const userDreams = dreamStorage.filter(dream => dream.user_id === userId).slice(-10);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ dreams: userDreams }));
        });
      return;
    }

    // Handle dreams stats API
    if (pathname === '/api/v1/dreams/stats' && method === 'GET') {
      // Calculate stats from all dreams stored locally (since local storage mirrors Supabase)
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const thisMonthDreams = dreamStorage.filter(dream => {
        const dreamDate = new Date(dream.created_at);
        return dreamDate.getMonth() === thisMonth && dreamDate.getFullYear() === thisYear;
      });

      const stats = {
        totalDreams: dreamStorage.length,
        totalInterpretations: dreamStorage.length,
        thisMonth: thisMonthDreams.length,
        creditsUsed: 0, // FREE MODE
        interpretationTypes: {
          basic: dreamStorage.filter(d => d.interpretation_type === 'basic').length,
          deep: dreamStorage.filter(d => d.interpretation_type === 'deep').length,
          premium: dreamStorage.filter(d => d.interpretation_type === 'premium').length
        }
      };

      console.log(`📊 Calculated stats: ${stats.totalDreams} total dreams, ${stats.thisMonth} this month`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    // Handle health check API
    if (pathname === '/api/v1/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', message: 'Dream Dictionary API is healthy' }));
      return;
    }

    // Handle profile API
    if (pathname === '/api/v1/profile' && method === 'GET') {
      // Extract user ID from token for authenticated profile
      const authHeader = req.headers.authorization || req.headers['Authorization'];
      let userId = 'demo-user';
      let planType = 'basic';

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const tokenUserId = extractUserIdFromToken(authHeader);
        if (tokenUserId) {
          userId = tokenUserId;
          initializeUserData(userId);
        }
      }

      const subscription = userSubscriptions.get(userId);
      const credits = userCredits.get(userId);

      // Calculate proper credits based on plan type
      let creditsDisplay;
      if (planType === 'pro') {
        creditsDisplay = 'unlimited';
      } else if (planType === 'basic') {
        // For Basic Plan, show remaining credits based on usage
        const monthlyLimits = SUBSCRIPTION_PLANS.basic.monthlyLimits;
        const monthlyUsage = subscription.monthlyUsage;
        const basicUsed = monthlyUsage.basic || 0;
        const deepUsed = monthlyUsage.deep || 0;
        const basicRemaining = Math.max(0, monthlyLimits.basic - basicUsed);
        const deepRemaining = Math.max(0, monthlyLimits.deep - deepUsed);

        creditsDisplay = `${basicRemaining} basic / ${deepRemaining} deep`;
      } else {
        creditsDisplay = '5'; // Free plan default
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        profile: {
          id: userId,
          email: `${userId}@demo.com`,
          display_name: `User ${userId}`,
          locale: 'en',
          credits: creditsDisplay,
          subscription: {
            plan: planType,
            planName: SUBSCRIPTION_PLANS[planType].name,
            planType: planType,
            price: SUBSCRIPTION_PLANS[planType].price,
            features: SUBSCRIPTION_PLANS[planType].features,
            monthlyLimits: SUBSCRIPTION_PLANS[planType].monthlyLimits,
            monthlyUsage: subscription.monthlyUsage
          }
        }
      }));
      return;
    }

    // Default API response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
    return;
  }

  // Handle static files
  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);
  const ext = path.parse(filePath).ext;
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found, try to serve index.html for SPA routing
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n🌙 Day Dream Dictionary Frontend Server is running on PORT ${PORT}!`);
  console.log(`📱 Production URLs available through your domain (not logged here)`);
  console.log(`🔗 API Service: day-dream-dictionary-api.onrender.com`);
  console.log(`\n📋 Available pages (use your production domain):`);
  console.log(`   • Main App: /`);
  console.log(`   • Login: /login.html`);
  console.log(`   • Test Interface: /test-app.html`);
  console.log(`   • Dream Interpretation: /dream-interpretation.html`);
  console.log(`   • Profile Dashboard: /profile-dashboard.html`);
  console.log(`\n🚀 Server ready - access through your Render domain\n`);
});
