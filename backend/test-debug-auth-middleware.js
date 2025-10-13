const jwt = require('jsonwebtoken');
const http = require('http');

// Debug the authentication middleware step by step
const yourRealUserId = '84a98c09-7363-43b8-b35b-1038fc73270b';

console.log('🔍 DEBUGGING AUTHENTICATION MIDDLEWARE');
console.log('Testing each step of the authentication process');
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

console.log('✅ Step 1: JWT Token created');
console.log('   User ID in token:', yourRealUserId);

// Step 2: Test the authentication middleware
console.log('');
console.log('🔐 Step 2: Testing authentication middleware...');

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
      console.log('Stats show user has', data.stats.totalDreams, 'dreams');

      // Step 3: Submit a dream and check what happens
      console.log('');
      console.log('🚀 Step 3: Submitting dream to see what user ID gets saved...');

      const dreamData = {
        dreamText: `MIDDLEWARE DEBUG TEST: ${new Date().toISOString()}`,
        interpretationType: 'basic',
        locale: 'en',
        tags: ['debug', 'middleware'],
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

      const insertReq = http.request(insertOptions, (insertRes) => {
        console.log(`Insert Status: ${insertRes.statusCode}`);

        insertRes.setEncoding('utf8');
        let insertBody = '';
        insertRes.on('data', (chunk) => {
          insertBody += chunk;
        });

        insertRes.on('end', () => {
          console.log('Insert Response:', insertBody);

          // Step 4: Check what was actually saved
          setTimeout(() => {
            console.log('');
            console.log('🔍 Step 4: Checking what user ID was actually saved...');

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

                  // Find our debug dream
                  const debugDreams = allDreams.filter(dream =>
                    dream.dream_text?.includes('MIDDLEWARE DEBUG TEST')
                  );

                  if (debugDreams.length > 0) {
                    console.log('✅ Debug dream found!');
                    debugDreams.forEach((dream, index) => {
                      console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
                      console.log(`     Expected: ${yourRealUserId}`);
                      console.log(`     Match: ${dream.user_id === yourRealUserId ? '✅' : '❌'}`);
                    });
                  } else {
                    console.log('❌ Debug dream not found');
                  }

                  // Show recent dreams to see the pattern
                  console.log('');
                  console.log('Recent dreams and their user IDs:');
                  allDreams.slice(-5).forEach((dream, index) => {
                    console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
                  });

                } catch (e) {
                  console.log('Could not parse check response');
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
    } catch (e) {
      console.log('Could not parse auth response');
    }
  });
});

authReq.on('error', (e) => {
  console.error(`Auth request error: ${e.message}`);
});

authReq.end();

console.log('');
console.log('🔄 This test will show exactly what happens in the authentication middleware...');
