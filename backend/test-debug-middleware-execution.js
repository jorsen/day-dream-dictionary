const jwt = require('jsonwebtoken');
const http = require('http');

// Debug if the authentication middleware is being executed at all
const yourRealUserId = '84a98c09-7363-43b8-b35b-1038fc73270b';

console.log('🔍 DEBUGGING MIDDLEWARE EXECUTION');
console.log('Testing if authentication middleware runs and sets req.user correctly');
console.log('');

// Step 1: Create JWT token
const payload = {
  userId: yourRealUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('✅ JWT Token created');

// Step 2: Submit dream and check if middleware logs appear
console.log('');
console.log('🚀 Submitting dream - check server console for middleware logs...');

const dreamData = {
  dreamText: `MIDDLEWARE EXECUTION TEST: ${new Date().toISOString()}`,
  interpretationType: 'basic',
  locale: 'en',
  tags: ['middleware', 'execution'],
  isRecurring: false
};

const postData = JSON.stringify(dreamData);

const insertOptions = {
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

console.log('📝 Check your server console for these logs:');
console.log('   - "Auth middleware - decoded userId: 84a98c09-7363-43b8-b35b-1038fc73270b"');
console.log('   - "🔍 Interpreting dream for user: 84a98c09-7363-43b8-b35b-1038fc73270b"');
console.log('   - "User not found in Supabase Auth" (if fallback is triggered)');
console.log('');

const insertReq = http.request(insertOptions, (insertRes) => {
  console.log(`Insert Status: ${insertRes.statusCode}`);

  insertRes.setEncoding('utf8');
  let insertBody = '';
  insertRes.on('data', (chunk) => {
    insertBody += chunk;
  });

  insertRes.on('end', () => {
    console.log('Response:', insertBody);

    // Step 3: Check what was saved
    setTimeout(() => {
      console.log('');
      console.log('🔍 Checking database...');

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
            const allDreams = data.dreams || [];

            // Find our test dream
            const testDreams = allDreams.filter(dream =>
              dream.dream_text?.includes('MIDDLEWARE EXECUTION TEST')
            );

            if (testDreams.length > 0) {
              console.log('✅ Test dream found!');
              testDreams.forEach((dream, index) => {
                console.log(`  User ID: ${dream.user_id}`);
                console.log(`  Expected: ${yourRealUserId}`);
                console.log(`  Status: ${dream.user_id === yourRealUserId ? '✅ DYNAMIC!' : '❌ Still test-user-id'}`);
              });
            } else {
              console.log('❌ Test dream not found');
            }

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

insertReq.on('error', (e) => {
  console.error(`Insert request error: ${e.message}`);
});

insertReq.write(postData);
insertReq.end();

console.log('');
console.log('🔍 INSTRUCTIONS:');
console.log('1. Make sure your server is running');
console.log('2. Run this test');
console.log('3. Check your server console for middleware logs');
console.log('4. The logs will show if authentication middleware is running');
console.log('');
console.log('🎯 This will tell us if the issue is in middleware execution or elsewhere');
