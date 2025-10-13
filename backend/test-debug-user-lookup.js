const jwt = require('jsonwebtoken');
const http = require('http');

// Test if the issue is in the Supabase user lookup
const realUserId = '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';

const payload = {
  userId: realUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔍 Testing Supabase user lookup for user:', realUserId);

// Test 1: Check if user exists in Supabase
const userCheckOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/auth/test-login',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('');
console.log('🔍 Step 1: Checking if user exists in Supabase...');

const userReq = http.request(userCheckOptions, (res) => {
  console.log(`Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response:', body);

    // Test 2: Try to insert a dream and see what happens
    console.log('');
    console.log('🚀 Step 2: Inserting test dream...');

    const dreamData = {
      dreamText: `DEBUG TEST: User lookup verification at ${new Date().toISOString()}`,
      interpretationType: 'basic',
      locale: 'en',
      tags: ['debug', 'test'],
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
      console.log(`Status: ${insertRes.statusCode}`);

      insertRes.setEncoding('utf8');
      let insertBody = '';
      insertRes.on('data', (chunk) => {
        insertBody += chunk;
      });

      insertRes.on('end', () => {
        console.log('Insert Response:', insertBody);

        // Test 3: Check what actually got saved
        console.log('');
        console.log('🔍 Step 3: Checking what was actually saved...');

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

              // Look for our test dream
              const testDreams = allDreams.filter(dream =>
                dream.dream_text?.includes('DEBUG TEST')
              );

              if (testDreams.length > 0) {
                console.log('✅ Test dream found!');
                testDreams.forEach((dream, index) => {
                  console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
                  console.log(`     Dream: ${dream.dream_text?.substring(0, 50)}...`);
                });
              } else {
                console.log('❌ Test dream not found in database');
              }

              // Show recent dreams to see user_id pattern
              console.log('');
              console.log('Recent dreams and their user_ids:');
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
      });
    });

    insertReq.on('error', (e) => {
      console.error(`Insert request error: ${e.message}`);
    });

    insertReq.write(postData);
    insertReq.end();
  });
});

userReq.on('error', (e) => {
  console.error(`User check request error: ${e.message}`);
});

userReq.end();
