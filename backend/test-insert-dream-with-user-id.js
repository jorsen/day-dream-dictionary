const jwt = require('jsonwebtoken');
const http = require('http');

// Script to insert a dream with the correct user ID from console logs
console.log('🎯 INSERT DREAM WITH CORRECT USER ID');
console.log('=====================================');
console.log('');

// Get user ID from command line argument or environment variable
const userId = process.argv[2] || process.env.CURRENT_USER_ID;

if (!userId) {
  console.log('❌ No user ID provided!');
  console.log('');
  console.log('💡 Usage:');
  console.log('   node backend/test-insert-dream-with-user-id.js YOUR_USER_ID');
  console.log('   OR');
  console.log('   CURRENT_USER_ID=YOUR_USER_ID node backend/test-insert-dream-with-user-id.js');
  console.log('');
  console.log('🔧 Get your user ID from:');
  console.log('1. Browser console: console.log(localStorage.getItem("currentUser"))');
  console.log('2. Profile dashboard logs: "🔍 Loading user stats for user: [YOUR_ID]"');
  console.log('3. Supabase Auth users table');
  console.log('');
  console.log('📝 Example:');
  console.log('   node backend/test-insert-dream-with-user-id.js 84a98c09-7363-43b8-b35b-1038fc73270b');
  process.exit(1);
}

console.log('✅ User ID:', userId);
console.log('');

// Create JWT token with the user ID
const payload = {
  userId: userId,
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔑 JWT Token created for user:', userId);
console.log('');

// Test dream data
const dreamData = {
  dreamText: `Test dream inserted with correct user ID ${userId} at ${new Date().toISOString()}. This dream should appear in the dashboard with the right user ID.`,
  interpretationType: 'basic',
  locale: 'en',
  tags: ['test', 'user-id-verification'],
  isRecurring: false
};

const postData = JSON.stringify(dreamData);

console.log('📝 Dream content preview:', dreamData.dreamText.substring(0, 80) + '...');
console.log('');

// Submit the dream
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

console.log('🚀 Submitting dream with user ID:', userId);
console.log('📊 API Endpoint: /api/v1/dreams/interpret');
console.log('');

const req = http.request(options, (res) => {
  console.log(`📊 Response Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('');
    console.log('📋 Response Body:');
    console.log(body);
    console.log('');

    if (res.statusCode === 201) {
      console.log('✅ Dream submitted successfully!');
      console.log('');
      console.log('🔍 Next steps:');
      console.log('1. Wait a few seconds for database save');
      console.log('2. Check your dashboard (profile-dashboard.html)');
      console.log('3. You should see:');
      console.log('   - Total Dreams: 1 (or incremented)');
      console.log('   - Recent dream with your content');
      console.log('   - Correct statistics');
      console.log('');
      console.log('4. If not working, run:');
      console.log('   node backend/test-check-database-directly.js');
      console.log('');
      console.log('🎉 The dream should now be saved with your correct user ID!');

      // Verify the dream was saved correctly
      setTimeout(() => {
        console.log('');
        console.log('🔍 Verifying dream was saved correctly...');

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
              const data = JSON.parse(verifyBody);
              const dreams = data.dreams || [];

              // Find dreams with our user ID
              const userDreams = dreams.filter(dream => dream.user_id === userId);

              console.log(`📊 Total dreams in database: ${dreams.length}`);
              console.log(`🎯 Dreams for user ${userId}: ${userDreams.length}`);

              if (userDreams.length > 0) {
                console.log('');
                console.log('🎉 SUCCESS! Dreams found for your user ID:');
                userDreams.forEach((dream, index) => {
                  console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
                  console.log(`     Text: "${dream.dream_text?.substring(0, 50)}..."`);
                  console.log(`     Created: ${dream.created_at}`);
                });

                console.log('');
                console.log('✅ Your dashboard should now show your dreams!');
                console.log('🌙 Go to profile-dashboard.html to see your data!');

              } else {
                console.log('');
                console.log('❌ No dreams found for your user ID');
                console.log('💡 The dream was processed but not saved correctly');

                // Show what user IDs exist
                console.log('');
                console.log('📋 All user IDs in database:');
                const userIds = [...new Set(dreams.map(d => d.user_id))];
                userIds.forEach(uid => {
                  const count = dreams.filter(d => d.user_id === uid).length;
                  console.log(`  ${uid}: ${count} dreams`);
                });
              }
            } catch (e) {
              console.log('Could not parse verification response');
            }
          });
        });

        verifyReq.on('error', (e) => {
          console.error(`Verification request error: ${e.message}`);
        });

        verifyReq.end();
      }, 2000); // Wait 2 seconds for database save

    } else {
      console.log('❌ Dream submission failed');
      console.log('💡 Check the error message above');
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request error: ${e.message}`);
});

req.write(postData);
req.end();

console.log('');
console.log('🔄 This script will:');
console.log('1. Submit a dream with your specific user ID');
console.log('2. Verify it was saved correctly in the database');
console.log('3. Show you the results');
console.log('');
console.log('📝 Make sure your server is running on localhost:5000');
