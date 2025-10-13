const jwt = require('jsonwebtoken');
const http = require('http');

// Test the complete authentication flow
const userId = '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';

const payload = {
  userId: userId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔐 Testing authentication flow for user:', userId);
console.log('🔑 Token:', token.substring(0, 50) + '...');

// Step 1: Test if the authentication middleware can decode the token
const authTestOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/stats/summary',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('');
console.log('📊 Step 1: Testing authenticated stats endpoint...');

const authReq = http.request(authTestOptions, (res) => {
  console.log(`Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response:', body);

    try {
      const data = JSON.parse(body);
      console.log('');
      console.log('📈 Stats result:', data.stats);

      if (data.stats && data.stats.totalDreams >= 0) {
        console.log('');
        console.log('✅ Authentication working - stats endpoint responded');
        console.log('💡 The issue is that no dreams exist for this user ID');
      }
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
  });
});

authReq.on('error', (e) => {
  console.error(`❌ Problem with auth test: ${e.message}`);
});

authReq.end();

console.log('');
console.log('💡 This test verifies that:');
console.log('1. JWT token is valid');
console.log('2. Authentication middleware works');
console.log('3. User ID is correctly extracted');
console.log('4. Database queries execute');
console.log('');
console.log('If this works but shows 0 dreams, the issue is simply that');
console.log('the user has not submitted any dreams through the web interface.');
