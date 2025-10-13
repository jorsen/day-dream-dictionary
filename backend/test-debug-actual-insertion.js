const jwt = require('jsonwebtoken');
const http = require('http');

// Debug the actual dream insertion process step by step
const yourRealUserId = '84a98c09-7363-43b8-b35b-1038fc73270b';

console.log('🔍 DEBUGGING ACTUAL DREAM INSERTION');
console.log('We know dreams are being saved with test-user-id instead of your real user ID');
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

console.log('✅ Step 1: JWT Token created with user ID:', yourRealUserId);

// Step 2: Submit dream and check what happens
console.log('');
console.log('🚀 Step 2: Submitting dream with detailed logging...');

const dreamData = {
  dreamText: `DEBUG ACTUAL INSERTION: ${new Date().toISOString()} - Real User ID: ${yourRealUserId}`,
  interpretationType: 'basic',
  locale: 'en',
  tags: ['debug', 'actual-insertion'],
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

console.log('📝 Dream data being sent:', JSON.stringify(dreamData, null, 2));

const insertReq = http.request(insertOptions, (insertRes) => {
  console.log(`Insert Status: ${insertRes.statusCode}`);

  insertRes.setEncoding('utf8');
  let insertBody = '';
  insertRes.on('data', (chunk) => {
    insertBody += chunk;
  });

  insertRes.on('end', () => {
    console.log('Insert Response:', insertBody);

    // Step 3: Check what was actually saved
    setTimeout(() => {
      console.log('');
      console.log('🔍 Step 3: Checking what was actually saved to database...');

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

            console.log(`Total dreams in database: ${allDreams.length}`);

            // Find our debug dream
            const debugDreams = allDreams.filter(dream =>
              dream.dream_text?.includes('DEBUG ACTUAL INSERTION')
            );

            if (debugDreams.length > 0) {
              console.log('✅ Debug dream found!');
              debugDreams.forEach((dream, index) => {
                console.log(`  ${index + 1}. Dream ID: ${dream.id}`);
                console.log(`     User ID: ${dream.user_id}`);
                console.log(`     Expected: ${yourRealUserId}`);
                console.log(`     Status: ${dream.user_id === yourRealUserId ? '✅ CORRECT' : '❌ WRONG'}`);
                console.log(`     Text: "${dream.dream_text?.substring(0, 60)}..."`);
              });
            } else {
              console.log('❌ Debug dream not found in database');
            }

            // Show recent dreams to see the pattern
            console.log('');
            console.log('Recent dreams in database:');
            allDreams.slice(-5).forEach((dream, index) => {
              console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
              console.log(`     Text: "${dream.dream_text?.substring(0, 40)}..."`);
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

console.log('');
console.log('🔄 This test will show exactly what user ID gets saved to the database...');
