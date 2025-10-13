const jwt = require('jsonwebtoken');
const http = require('http');

// Debug the middleware issue - why is user_id still test-user-id?
const userId = '84a98c09-7363-43b8-b35b-1038fc73270b';

console.log('🔍 DEBUGGING MIDDLEWARE ISSUE');
console.log('Dreams are still being saved with test-user-id');
console.log('');

// Create JWT token
const payload = {
  userId: userId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('✅ JWT Token created for user:', userId);

// Test 1: Submit a dream and check what happens
console.log('');
console.log('🚀 Submitting dream with detailed debugging...');

const dreamData = {
  dreamText: `DEBUG MIDDLEWARE ISSUE: ${new Date().toISOString()} - User ID should be ${userId}`,
  interpretationType: 'basic',
  locale: 'en',
  tags: ['debug', 'middleware-issue'],
  isRecurring: false
};

const postData = JSON.stringify(dreamData);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/interpret',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📝 Check server console for middleware logs...');
console.log('📝 Looking for:');
console.log('   - "Auth middleware - decoded userId:"');
console.log('   - "🔍 Interpreting dream for user:"');
console.log('   - "User not found in Supabase Auth"');
console.log('   - "✅ Set req.user.id to:"');
console.log('');

const req = http.request(options, (res) => {
  console.log(`📊 Response Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response:', body);

    // Check what was saved
    setTimeout(() => {
      console.log('');
      console.log('🔍 Checking what was actually saved...');

      const checkOptions = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/dreams/all-dreams',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const checkReq = http.request(checkOptions, (checkRes) => {
        checkRes.setEncoding('utf8');
        let checkBody = '';
        checkRes.on('data', (chunk) => {
          checkBody += chunk;
        });

        checkRes.on('end', () => {
          try {
            const data = JSON.parse(checkBody);
            const dreams = data.dreams || [];

            // Find our debug dream
            const debugDreams = dreams.filter(dream =>
              dream.dream_text?.includes('DEBUG MIDDLEWARE ISSUE')
            );

            if (debugDreams.length > 0) {
              console.log('✅ Debug dream found!');
              debugDreams.forEach((dream, index) => {
                console.log(`  ${index + 1}. Dream ID: ${dream.id}`);
                console.log(`     User ID: ${dream.user_id}`);
                console.log(`     Expected: ${userId}`);
                console.log(`     Status: ${dream.user_id === userId ? '✅ FIXED' : '❌ Still test-user-id'}`);
              });
            } else {
              console.log('❌ Debug dream not found');
            }

            // Show recent dreams
            console.log('');
            console.log('Recent dreams in database:');
            dreams.slice(-5).forEach((dream, index) => {
              console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
              console.log(`     Text: "${dream.dream_text?.substring(0, 40)}..."`);
            });

          } catch (e) {
            console.log('Could not parse response');
          }
        });
      });

      checkReq.on('error', (e) => {
        console.error(`Check request error: ${e.message}`);
      });

      checkReq.end();
    }, 1000);
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();

console.log('');
console.log('🔍 INSTRUCTIONS:');
console.log('1. Make sure your server is running');
console.log('2. Run this test');
console.log('3. Check your server console for middleware execution logs');
console.log('4. The logs will show exactly what happens in the middleware');
console.log('');
console.log('🎯 This will help identify if the middleware is running at all');
