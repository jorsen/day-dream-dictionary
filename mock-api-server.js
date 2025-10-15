const http = require('http');
const url = require('url');

// Mock data
const mockData = {
  health: { status: 'ok', message: 'Mock API Server Running' },
  dreams: [
    {
      id: '1',
      dream_text: 'I was flying through clouds, feeling completely free and happy.',
      interpretation: {
        mainThemes: ['freedom', 'exploration'],
        emotionalTone: 'Positive and uplifting',
        symbols: [
          {
            symbol: 'flying',
            meaning: 'Represents freedom and transcendence',
            significance: 'high'
          }
        ],
        personalInsight: 'You desire freedom in your life',
        guidance: 'Explore ways to express your freedom'
      },
      created_at: new Date().toISOString()
    }
  ],
  auth: {
    token: 'mock-jwt-token',
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      display_name: 'Test User'
    }
  }
};

// Mock API server
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

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  // API root endpoint
  if (path === '/api/v1' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Day Dream Dictionary API v1',
      version: '1.0.0',
      endpoints: [
        'GET /api/v1/health',
        'POST /api/v1/auth/login',
        'POST /api/v1/auth/signup',
        'GET /api/v1/dreams',
        'POST /api/v1/dreams/interpret',
        'GET /api/v1/profile/credits',
        'GET /api/v1/profile'
      ]
    }));
    return;
  }

  // Health check
  if (path === '/api/v1/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData.health));
    return;
  }

  // Auth endpoints
  if (path.startsWith('/api/v1/auth/')) {
    if (path === '/api/v1/auth/login' && method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.auth));
      return;
    }
    if (path === '/api/v1/auth/signup' && method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.auth));
      return;
    }
  }

  // Dreams endpoints
  if (path.startsWith('/api/v1/dreams')) {
  if (path === '/api/v1/dreams' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ dreams: mockData.dreams }));
    return;
  }
  if (path === '/api/v1/dreams/all-dreams' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ dreams: mockData.dreams }));
    return;
  }
    if (path === '/api/v1/dreams/interpret' && method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        const data = JSON.parse(body);
        const interpretation = {
          id: Date.now().toString(),
          dream_text: data.dream_text,
          interpretation: mockData.dreams[0].interpretation,
          created_at: new Date().toISOString()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(interpretation));
      });
      return;
    }
  }

  // Profile endpoints
  if (path.startsWith('/api/v1/profile/')) {
    if (path === '/api/v1/profile/credits' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ balance: 1000 }));
      return;
    }
    if (path === '/api/v1/profile' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          display_name: 'Test User',
          locale: 'en'
        }
      }));
      return;
    }
  }

  // Additional endpoints
  if (path === '/api/v1/dreams/test-stats/summary' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total_dreams: 5,
      this_month: 2,
      common_themes: ['flying', 'water', 'family'],
      emotional_tone: 'mostly_positive'
    }));
    return;
  }

  if (path === '/api/v1/test-dreams-history' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      dreams: mockData.dreams.concat([
        {
          id: '2',
          dream_text: 'I was swimming in a clear blue ocean with colorful fish.',
          interpretation: {
            mainThemes: ['water', 'peace'],
            emotionalTone: 'Calm and serene',
            symbols: [
              {
                symbol: 'water',
                meaning: 'Represents emotions and subconscious',
                significance: 'high'
              }
            ],
            personalInsight: 'You are in touch with your emotions',
            guidance: 'Continue exploring your emotional depth'
          },
          created_at: new Date(Date.now() - 86400000).toISOString()
        }
      ])
    }));
    return;
  }

  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Health check passed' }));
    return;
  }

  // Default response
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/v1/health');
  console.log('  POST /api/v1/auth/login');
  console.log('  POST /api/v1/auth/signup');
  console.log('  GET  /api/v1/dreams');
  console.log('  POST /api/v1/dreams/interpret');
  console.log('  GET  /api/v1/profile/credits');
});
