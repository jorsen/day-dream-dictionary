const jwt = require('jsonwebtoken');
const http = require('http');

// Complete step-by-step verification of the dream insertion flow
const realUserId = '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';

console.log('🔍 COMPLETE FLOW VERIFICATION');
console.log('Testing the entire dream insertion process step by step');
console.log('');

// Step 1: Create JWT token with real user ID
const payload = {
  userId: realUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('✅ Step 1: JWT Token Created');
console.log('   User ID:', realUserId);
console.log('   Token:', token.substring(0, 50) + '...');

// Step 2: Test authentication middleware
console.log('');
console.log('🔐 Step 2: Testing Authentication Middleware...');

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

const authReq = http.request(authTestOptions, (res) => {
  console.log(`   Status: ${res.statusCode}`);

  if (res.statusCode === 200) {
    console.log('   ✅ Authentication middleware working');
  } else {
    console.log('   ❌ Authentication middleware failed');
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
      console.log('   📊 Current stats:', data.stats);

      // Step 3: Insert a test dream
      console.log('');
      console.log('🚀 Step 3: Inserting Test Dream...');

      const dreamData = {
        dreamText: `Test dream inserted at ${new Date().toISOString()} - User ID: ${realUserId}`,
        interpretationType: 'basic',
        locale: 'en',
        tags: ['test', 'verification'],
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
        console.log(`   Status: ${insertRes.statusCode}`);

        insertRes.setEncoding('utf8');
        let insertBody = '';
        insertRes.on('data', (chunk) => {
          insertBody += chunk;
        });

        insertRes.on('end', () => {
          if (insertRes.statusCode === 201) {
            console.log('   ✅ Dream inserted successfully');

            try {
              const insertData = JSON.parse(insertBody);
              console.log('   📋 Response contains:', Object.keys(insertData));

              // Step 4: Verify the dream was saved with correct user ID
              console.log('');
              console.log('🔍 Step 4: Verifying Dream in Database...');

              const verifyOptions = {
                hostname: 'localhost',
                port: 5000,
                path: '/api/v1/dreams/all-dreams',
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              };

              const verifyReq = http.request(verifyOptions, (verifyRes) => {
                verifyRes.setEncoding('utf8');
                let verifyBody = '';
                verifyRes.on('data', (chunk) => {
                  verifyBody += chunk;
                });

                verifyRes.on('end', () => {
                  try {
                    const verifyData = JSON.parse(verifyBody);
                    const allDreams = verifyData.dreams || [];
                    const userDreams = allDreams.filter(dream => dream.user_id === realUserId);

                    console.log(`   📊 Total dreams in DB: ${allDreams.length}`);
                    console.log(`   🎯 Dreams for user ${realUserId}: ${userDreams.length}`);

                    if (userDreams.length > 0) {
                      console.log('   ✅ SUCCESS! Dreams found for real user ID');
                      console.log('   📝 Latest dream:', userDreams[userDreams.length - 1].dream_text?.substring(0, 50) + '...');

                      // Step 5: Test statistics endpoint
                      console.log('');
                      console.log('📈 Step 5: Testing Updated Statistics...');

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

                      const statsReq = http.request(statsOptions, (statsRes) => {
                        statsRes.setEncoding('utf8');
                        let statsBody = '';
                        statsRes.on('data', (chunk) => {
                          statsBody += chunk;
                        });

                        statsRes.on('end', () => {
                          try {
                            const statsData = JSON.parse(statsBody);
                            console.log('   📊 Updated stats:', statsData.stats);

                            if (statsData.stats.totalDreams > 0) {
                              console.log('');
                              console.log('🎉 COMPLETE SUCCESS!');
                              console.log('✅ Authentication: Working');
                              console.log('✅ Dream insertion: Working');
                              console.log('✅ Database storage: Working');
                              console.log('✅ Statistics: Working');
                              console.log('✅ User ID handling: Working');
                            } else {
                              console.log('   ❌ Statistics still show 0');
                            }
                          } catch (e) {
                            console.log('   ❌ Could not parse stats response');
                          }
                        });
                      });

                      statsReq.on('error', (e) => {
                        console.error(`   ❌ Stats request error: ${e.message}`);
                      });

                      statsReq.end();

                    } else {
                      console.log('   ❌ No dreams found for real user ID');
                      console.log('   💡 The dream may not have been saved to database');
                    }
                  } catch (e) {
                    console.log('   ❌ Could not parse verification response');
                  }
                });
              });

              verifyReq.on('error', (e) => {
                console.error(`   ❌ Verification request error: ${e.message}`);
              });

              verifyReq.end();

            } catch (e) {
              console.log('   ❌ Could not parse insert response');
            }
          } else {
            console.log('   ❌ Dream insertion failed');
            console.log('   Response:', insertBody);
          }
        });
      });

      insertReq.on('error', (e) => {
        console.error(`   ❌ Insert request error: ${e.message}`);
      });

      insertReq.write(postData);
      insertReq.end();
    } catch (e) {
      console.log('   ❌ Could not parse auth response');
    }
  });
});

authReq.on('error', (e) => {
  console.error(`❌ Auth request error: ${e.message}`);
});

authReq.end();

console.log('');
console.log('🔄 This test will verify each step of the process...');
