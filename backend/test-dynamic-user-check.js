const jwt = require('jsonwebtoken');
const http = require('http');

// Dynamic script - can check any user by passing user ID as command line argument
const targetUserId = process.argv[2] || '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';

console.log('🔍 Dynamic User Check');
console.log('Target User ID:', targetUserId);
console.log('');

// Create JWT token for the target user
const payload = {
  userId: targetUserId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔑 Generated token for user:', targetUserId);
console.log('');

// Step 1: Check all dreams in database
const allDreamsOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/all-dreams',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('📋 Step 1: Checking all dreams in database...');
const allDreamsReq = http.request(allDreamsOptions, (res) => {
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);

    try {
      const data = JSON.parse(body);
      const allDreams = data.dreams || [];
      const userDreams = allDreams.filter(dream => dream.user_id === targetUserId);

      console.log(`📊 Total dreams in DB: ${allDreams.length}`);
      console.log(`🎯 Dreams for user ${targetUserId}: ${userDreams.length}`);

      if (userDreams.length > 0) {
        console.log('');
        console.log('✅ User dreams found:');
        userDreams.forEach((dream, index) => {
          console.log(`  ${index + 1}. "${dream.dream_text?.substring(0, 50)}..." (${dream.created_at})`);
        });
      } else {
        console.log('');
        console.log('❌ No dreams found for this user');
      }

      // Step 2: Test statistics endpoint for this user
      console.log('');
      console.log('📊 Step 2: Testing statistics endpoint...');
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
          console.log(`Status: ${statsRes.statusCode}`);

          try {
            const stats = JSON.parse(statsBody);
            console.log('');
            console.log('📈 Statistics Response:');
            console.log(`Total Dreams: ${stats.stats?.totalDreams || 0}`);
            console.log(`This Month: ${stats.stats?.thisMonth || 0}`);
            console.log(`Recurring Dreams: ${stats.stats?.recurringDreams || 0}`);
            console.log(`Credits Used: ${stats.stats?.creditsUsed || 0}`);

            console.log('');
            console.log('🔍 Analysis:');
            if (userDreams.length > 0 && stats.stats?.totalDreams === 0) {
              console.log('❌ MISMATCH: Dreams exist in DB but statistics show 0');
              console.log('💡 This indicates a bug in the statistics query');
            } else if (userDreams.length === 0 && stats.stats?.totalDreams === 0) {
              console.log('✅ CORRECT: No dreams in DB, statistics correctly show 0');
              console.log('💡 User needs to submit their first dream');
            } else if (userDreams.length > 0 && stats.stats?.totalDreams > 0) {
              console.log('✅ CORRECT: Dreams and statistics match');
            }
          } catch (e) {
            console.log('Could not parse statistics response as JSON');
          }
        });
      });

      statsReq.on('error', (e) => {
        console.error(`❌ Problem with stats request: ${e.message}`);
      });

      statsReq.end();

    } catch (e) {
      console.log('Could not parse all dreams response as JSON');
    }
  });
});

allDreamsReq.on('error', (e) => {
  console.error(`❌ Problem with all dreams request: ${e.message}`);
});

allDreamsReq.end();

console.log('');
console.log('💡 Usage: node test-dynamic-user-check.js [userId]');
console.log('   Example: node test-dynamic-user-check.js test-user-id');
console.log('   Example: node test-dynamic-user-check.js 5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a');
