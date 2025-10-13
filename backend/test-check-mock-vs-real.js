const http = require('http');

// Check if dreams are being saved to mock database instead of real database
console.log('🔍 CHECKING MOCK vs REAL DATABASE');
console.log('Investigating where dreams are actually being saved');
console.log('');

// Test 1: Check all dreams endpoint (should show real database)
console.log('📋 Test 1: Checking all dreams (real database)...');

const allDreamsOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/all-dreams',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

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
      const dreams = data.dreams || [];

      console.log(`Real database dreams: ${dreams.length}`);

      // Look for recent dreams
      const recentDreams = dreams.filter(dream =>
        dream.dream_text?.includes('FORCE TEST') ||
        dream.dream_text?.includes('DEBUG TEST')
      );

      if (recentDreams.length > 0) {
        console.log('✅ Recent dreams found in real database:');
        recentDreams.forEach((dream, index) => {
          console.log(`  ${index + 1}. User ID: ${dream.user_id}`);
          console.log(`     "${dream.dream_text?.substring(0, 50)}..."`);
        });
      } else {
        console.log('❌ No recent dreams found in real database');
      }

      // Show all user IDs in real database
      console.log('');
      console.log('All user IDs in real database:');
      const userIds = [...new Set(dreams.map(d => d.user_id))];
      userIds.forEach(userId => {
        const count = dreams.filter(d => d.user_id === userId).length;
        console.log(`  ${userId}: ${count} dreams`);
      });

    } catch (e) {
      console.log('Could not parse response');
    }
  });
});

allDreamsReq.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

allDreamsReq.end();

console.log('');
console.log('🔍 This will show us exactly where dreams are being saved...');
