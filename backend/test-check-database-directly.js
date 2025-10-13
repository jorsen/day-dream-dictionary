const http = require('http');

// Check what dreams actually exist in the database for this user
const userId = '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a';

console.log('🔍 Checking database for user:', userId);
console.log('');

// Check all dreams first
const allDreamsOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/dreams/all-dreams',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('📋 Checking all dreams in database...');
const allDreamsReq = http.request(allDreamsOptions, (res) => {
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('All dreams in database:');
    console.log(body);
    console.log('');

    try {
      const data = JSON.parse(body);
      const userDreams = data.dreams?.filter(dream => dream.user_id === userId) || [];

      console.log(`🎯 Dreams for user ${userId}: ${userDreams.length}`);
      userDreams.forEach((dream, index) => {
        console.log(`  ${index + 1}. ID: ${dream.id}, Text: "${dream.dream_text?.substring(0, 50)}...", Created: ${dream.created_at}`);
      });

      if (userDreams.length === 0) {
        console.log('');
        console.log('❌ No dreams found for this user in the database');
        console.log('💡 This explains why the dashboard shows 0 dreams');
      } else {
        console.log('');
        console.log('✅ Dreams found! The issue might be in the statistics calculation');
      }
    } catch (e) {
      console.log('Could not parse response as JSON');
    }
  });
});

allDreamsReq.on('error', (e) => {
  console.error(`❌ Problem with request: ${e.message}`);
});

allDreamsReq.end();
