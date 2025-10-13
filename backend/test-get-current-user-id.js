const http = require('http');

// Get the current user ID dynamically from browser or environment
console.log('🔍 GETTING CURRENT USER ID DYNAMICALLY');
console.log('');

// Method 1: Try to get from environment variable
const envUserId = process.env.CURRENT_USER_ID;

if (envUserId) {
  console.log('✅ Found user ID in environment:', envUserId);
  console.log('');
  console.log('💡 Usage:');
  console.log('   CURRENT_USER_ID=your-user-id node test-get-current-user-id.js');
  console.log('');
  console.log('🔧 Testing with user ID from environment...');

  // Test with the environment user ID
  testWithUserId(envUserId);
} else {
  console.log('❌ No user ID found in environment variable');
  console.log('');
  console.log('💡 To use environment variable:');
  console.log('   CURRENT_USER_ID=84a98c09-7363-43b8-b35b-1038fc73270b node test-get-current-user-id.js');
  console.log('');
  console.log('🔧 Alternative methods to get your user ID:');
  console.log('');
  console.log('Method 1 - From Browser Console:');
  console.log('1. Open profile-dashboard.html');
  console.log('2. Press F12 to open console');
  console.log('3. Type: console.log(localStorage.getItem("currentUser"))');
  console.log('4. Copy the user ID and set as environment variable');
  console.log('');
  console.log('Method 2 - From Network Tab:');
  console.log('1. Open profile-dashboard.html');
  console.log('2. Press F12 → Network tab');
  console.log('3. Refresh the page');
  console.log('4. Click on the stats API request');
  console.log('5. Check the user ID in the request logs');
  console.log('');
  console.log('Method 3 - From Database:');
  console.log('1. Check your Supabase Auth users table');
  console.log('2. Find your user record');
  console.log('3. Copy the user ID');
}

function testWithUserId(userId) {
  console.log('🔍 Testing with user ID:', userId);

  // Create JWT token for this user
  const jwt = require('jsonwebtoken');
  const payload = {
    userId: userId,
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
  };

  const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
  const token = jwt.sign(payload, secret);

  console.log('✅ JWT Token created');

  // Test authentication
  const authOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/dreams/stats/summary',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const authReq = http.request(authOptions, (res) => {
    console.log(`Auth Status: ${res.statusCode}`);

    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('Current stats:', data.stats);

        console.log('');
        console.log('🎯 User ID is working correctly!');
        console.log('💡 Use this user ID for testing:');
        console.log(`   CURRENT_USER_ID=${userId} node your-test.js`);

      } catch (e) {
        console.log('Could not parse auth response');
      }
    });
  });

  authReq.on('error', (e) => {
    console.error(`Auth request error: ${e.message}`);
  });

  authReq.end();
}
