const jwt = require('jsonwebtoken');
const http = require('http');

// Final test with your real user ID
const yourRealUserId = '84a98c09-7363-43b8-b35b-1038fc73270b';

console.log('🎯 FINAL FIX FOR YOUR USER ID');
console.log('User ID:', yourRealUserId);
console.log('');

console.log('✅ Step 1: Testing authentication...');

// Create JWT token for your real user
const payload = {
  userId: yourRealUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔑 JWT Token created');

// Test 1: Verify authentication works
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

console.log('');
console.log('🔐 Testing authentication...');

const authReq = http.request(authOptions, (res) => {
  console.log(`Status: ${res.statusCode}`);

  if (res.statusCode === 200) {
    console.log('✅ Authentication working for your user ID');
  } else {
    console.log('❌ Authentication failed');
    return;
  }

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('Current stats:', data.stats);

      // Test 2: Submit a dream with your real user ID
      console.log('');
      console.log('🚀 Submitting dream with your real user ID...');

      const dreamData = {
        dreamText: `OFFICIAL TEST: Dream for user ${yourRealUserId} at ${new Date().toISOString()}`,
        interpretationType: 'basic',
        locale: 'en',
        tags: ['official', 'test'],
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

            // Test 3: Check if it was saved with correct user ID
            setTimeout(() => {
              console.log('');
              console.log('🔍 Checking database for your user ID...');

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
                    const yourDreams = allDreams.filter(dream => dream.user_id === yourRealUserId);

                    console.log(`Total dreams: ${allDreams.length}`);
                    console.log(`Dreams for your user ${yourRealUserId}: ${yourDreams.length}`);

                    if (yourDreams.length > 0) {
                      console.log('🎉 SUCCESS! Dreams found for your real user ID');
                      console.log('Your dreams:');
                      yourDreams.forEach((dream, index) => {
                        console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
                        console.log(`     "${dream.dream_text?.substring(0, 50)}..."`);
                      });

                      // Test 4: Check if stats now show your dreams
                      console.log('');
                      console.log('📊 Testing updated statistics...');

                      const statsReq = http.request(authOptions, (statsRes) => {
                        statsRes.setEncoding('utf8');
                        let statsBody = '';
                        statsRes.on('data', (chunk) => {
                          statsBody += chunk;
                        });

                        statsRes.on('end', () => {
                          try {
                            const statsData = JSON.parse(statsBody);
                            console.log('Updated stats:', statsData.stats);

                            if (statsData.stats.totalDreams > 0) {
                              console.log('');
                              console.log('🎉 COMPLETE SUCCESS!');
                              console.log('✅ Your user ID is working correctly');
                              console.log('✅ Dreams are being saved with correct user ID');
                              console.log('✅ Dashboard should now show your dreams');
                            } else {
                              console.log('❌ Stats still show 0 dreams');
                            }
                          } catch (e) {
                            console.log('Could not parse stats response');
                          }
                        });
                      });

                      statsReq.on('error', (e) => {
                        console.error(`Stats request error: ${e.message}`);
                      });

                      statsReq.end();

                    } else {
                      console.log('❌ No dreams found for your user ID');
                      console.log('💡 The dream was processed but saved with wrong user ID');

                      // Show what user IDs exist
                      console.log('');
                      console.log('All user IDs in database:');
                      const userIds = [...new Set(allDreams.map(d => d.user_id))];
                      userIds.forEach(userId => {
                        const count = allDreams.filter(d => d.user_id === userId).length;
                        console.log(`  ${userId}: ${count} dreams`);
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
      console.log('Could not parse auth response');
    }
  });
});

authReq.on('error', (e) => {
  console.error(`Auth request error: ${e.message}`);
});

authReq.end();

console.log('');
console.log('🔄 This test will verify that your real user ID works correctly...');
