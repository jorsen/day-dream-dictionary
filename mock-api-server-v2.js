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
    accessToken: 'mock-jwt-token-' + Date.now(),
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

  // Test stats endpoint for dashboard
  if (path === '/api/v1/dreams/test-stats/summary' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: {
        totalDreams: 5,
        thisMonth: 2,
        creditsUsed: 3
      }
    }));
    return;
  }

  // Test dreams history endpoint for dashboard
  if (path === '/api/v1/test-dreams-history' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      dreams: mockData.dreams.concat([
        {
          id: '2',
          dream_text: 'I was swimming in a clear blue ocean with colorful fish around me.',
          interpretation: {
            mainThemes: ['water', 'peace', 'exploration'],
            emotionalTone: 'Calm and serene',
            symbols: [
              {
                symbol: 'ocean',
                meaning: 'Represents emotions and subconscious mind',
                significance: 'high'
              },
              {
                symbol: 'fish',
                meaning: 'Represents creativity and intuition',
                significance: 'medium'
              }
            ],
            personalInsight: 'You are in touch with your emotions and creative side',
            guidance: 'Continue exploring your emotional depth and creativity'
          },
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '3',
          dream_text: 'I was walking through a forest at night, following a bright star.',
          interpretation: {
            mainThemes: ['guidance', 'mystery', 'journey'],
            emotionalTone: 'Mysterious but hopeful',
            symbols: [
              {
                symbol: 'forest',
                meaning: 'Represents the unknown and unconscious',
                significance: 'high'
              },
              {
                symbol: 'star',
                meaning: 'Represents hope and guidance',
                significance: 'high'
              }
            ],
            personalInsight: 'You are seeking guidance in your life journey',
            guidance: 'Trust your intuition and follow your inner light'
          },
          created_at: new Date(Date.now() - 172800000).toISOString()
        }
      ])
    }));
    return;
  }

  // Test dream interpretation endpoint for free mode
  if (path === '/api/v1/dreams/test-interpret' && method === 'POST') {
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
      return;
    });
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

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Mock API server v2 running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/v1/health');
  console.log('  POST /api/v1/auth/login');
  console.log('  POST /api/v1/auth/signup');
  console.log('  GET  /api/v1/dreams');
  console.log('  GET  /api/v1/dreams/all-dreams');
  console.log('  POST /api/v1/dreams/interpret');
  console.log('  GET  /api/v1/profile/credits');
});
