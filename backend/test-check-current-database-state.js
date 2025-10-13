const http = require('http');

// Check the current state of the database
console.log('🔍 CHECKING CURRENT DATABASE STATE');
console.log('Let\'s see exactly what\'s in the database right now');
console.log('');

// Check all dreams
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/all-dreams',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const dreams = data.dreams || [];

      console.log(`📊 Total dreams in database: ${dreams.length}`);
      console.log('');

      // Group dreams by user_id
      const userGroups = {};
      dreams.forEach(dream => {
        if (!userGroups[dream.user_id]) {
          userGroups[dream.user_id] = [];
        }
        userGroups[dream.user_id].push(dream);
      });

      // Show results
      console.log('📋 Dreams by user ID:');
      Object.keys(userGroups).forEach(userId => {
        const count = userGroups[userId].length;
        console.log(`  ${userId}: ${count} dreams`);

        // Show recent dreams for this user
        const recent = userGroups[userId].slice(-3);
        recent.forEach((dream, index) => {
          console.log(`    ${index + 1}. "${dream.dream_text?.substring(0, 50)}..."`);
        });
      });

      console.log('');
      console.log('💡 Analysis:');
      if (Object.keys(userGroups).length === 1) {
        const userId = Object.keys(userGroups)[0];
        if (userId === 'test-user-id') {
          console.log('❌ All dreams still have test-user-id');
          console.log('💡 The fix may not be working yet');
        } else {
          console.log('✅ All dreams have the same user ID:', userId);
          console.log('💡 This should be your real user ID');
        }
      } else {
        console.log('✅ Multiple user IDs found');
        console.log('💡 Dreams are properly distributed');
      }

    } catch (e) {
      console.log('Could not parse response');
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.end();

console.log('');
console.log('🔄 This will show the exact current state of your database...');
