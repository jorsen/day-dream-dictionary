const jwt = require('jsonwebtoken');
const http = require('http');

// Debug the specific user from your logs
const currentUserId = '5890f16a-9695-4fbc-9c67-cdcf70e65966';

console.log('🔍 DEBUGGING YOUR CURRENT USER');
console.log('User ID:', currentUserId);
console.log('');

console.log('✅ Step 1: Testing authentication for your user...');

// Create JWT token for this user
const payload = {
  userId: currentUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔑 JWT Token created');

// Test 1: Check if this user can access stats
const statsOptions = {
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
console.log('📊 Testing stats endpoint...');

const statsReq = http.request(statsOptions, (res) => {
  console.log(`Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Stats response:', data.stats);

      // Test 2: Submit a dream
      console.log('');
      console.log('🚀 Submitting test dream...');

      const dreamData = {
        dreamText: `Test dream for user ${currentUserId} at ${new Date().toISOString()}`,
        interpretationType: 'basic',
        locale: 'en',
        tags: ['test', 'debug'],
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

          if (insertRes.statusCode === 201) {
            console.log('✅ Dream submitted successfully');

            // Test 3: Check if it was saved
            setTimeout(() => {
              console.log('');
              console.log('🔍 Checking if dream was saved...');

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
                    const userDreams = allDreams.filter(dream => dream.user_id === currentUserId);

                    console.log(`Total dreams: ${allDreams.length}`);
                    console.log(`Dreams for user ${currentUserId}: ${userDreams.length}`);

                    if (userDreams.length > 0) {
                      console.log('✅ SUCCESS! Dreams found for your user');
                      console.log('Recent dreams for your user:');
                      userDreams.slice(-3).forEach((dream, index) => {
                        console.log(`  ${index + 1}. "${dream.dream_text?.substring(0, 50)}..."`);
                      });
                    } else {
                      console.log('❌ No dreams found for your user');
                      console.log('💡 The dream was processed but not saved to real database');
                    }

                    // Show all user IDs to compare
                    console.log('');
                    console.log('All user IDs in database:');
                    const userIds = [...new Set(allDreams.map(d => d.user_id))];
                    userIds.forEach(userId => {
                      const count = allDreams.filter(d => d.user_id === userId).length;
                      console.log(`  ${userId}: ${count} dreams`);
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

          } else {
            console.log('❌ Dream submission failed');
          }
        });
      });

      insertReq.on('error', (e) => {
        console.error(`Insert request error: ${e.message}`);
      });

      insertReq.write(postData);
      insertReq.end();
    } catch (e) {
      console.log('Could not parse stats response');
    }
  });
});

statsReq.on('error', (e) => {
  console.error(`Stats request error: ${e.message}`);
});

statsReq.end();

console.log('');
console.log('🔄 This test will show exactly what happens with your specific user ID...');
