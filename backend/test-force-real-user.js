const jwt = require('jsonwebtoken');
const http = require('http');

// Force the system to use the real user ID by ensuring authentication works
const realUserId = '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';

console.log('🔧 FORCE REAL USER ID TEST');
console.log('Ensuring dreams are saved with the correct user ID');
console.log('');

// First, let's check if we can create a user or if we need to use test mode
const payload = {
  userId: realUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('✅ JWT Token created for user:', realUserId);

// Test 1: Try using the authenticated endpoint
console.log('');
console.log('🔐 Test 1: Using authenticated endpoint...');

const authOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/interpret',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const dreamData = {
  dreamText: `FORCE TEST: Real user verification - ${new Date().toISOString()}`,
  interpretationType: 'basic',
  locale: 'en',
  tags: ['force', 'real-user'],
  isRecurring: false
};

const postData = JSON.stringify(dreamData);

const authReq = http.request(authOptions, (res) => {
  console.log(`Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response:', body);

    if (res.statusCode === 201) {
      console.log('✅ Authenticated endpoint worked');

      // Test 2: Check what was actually saved
      setTimeout(() => {
        console.log('');
        console.log('🔍 Test 2: Checking database content...');

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

              console.log(`Total dreams: ${allDreams.length}`);

              // Look for our force test dream
              const forceTestDreams = allDreams.filter(dream =>
                dream.dream_text?.includes('FORCE TEST')
              );

              if (forceTestDreams.length > 0) {
                console.log('✅ SUCCESS! Force test dream found');
                forceTestDreams.forEach((dream, index) => {
                  console.log(`  User ID: ${dream.user_id}`);
                  console.log(`  Dream: ${dream.dream_text?.substring(0, 60)}...`);
                });

                if (forceTestDreams[0].user_id === realUserId) {
                  console.log('');
                  console.log('🎉 COMPLETE SUCCESS!');
                  console.log('✅ User ID is correct:', realUserId);
                  console.log('✅ Dream saved with proper user ID');
                  console.log('✅ System working correctly');
                } else {
                  console.log('');
                  console.log('❌ User ID mismatch');
                  console.log('Expected:', realUserId);
                  console.log('Actual:', forceTestDreams[0].user_id);
                }
              } else {
                console.log('❌ Force test dream not found');

                // Show what was actually saved
                console.log('');
                console.log('Recent dreams in database:');
                allDreams.slice(-3).forEach((dream, index) => {
                  console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
                  console.log(`     "${dream.dream_text?.substring(0, 50)}..."`);
                });
              }
            } catch (e) {
              console.log('Could not parse check response');
            }
          });
        });

        checkReq.on('error', (e) => {
          console.error(`Check request error: ${e.message}`);
        });

        checkReq.end();
      }, 1000); // Wait 1 second for database save

    } else {
      console.log('❌ Authenticated endpoint failed');
      console.log('💡 This confirms the user does not exist in Supabase Auth');
    }
  });
});

authReq.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

authReq.write(postData);
authReq.end();

console.log('');
console.log('🔄 This test forces the system to use the real user ID...');
