const jwt = require('jsonwebtoken');
const http = require('http');

// Use the real user ID from the logs
const payload = {
  userId: '5aebe02b-1f9d-4fac-a811-5e2c6dcfee9a',
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};

const secret = 'vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==';
const token = jwt.sign(payload, secret);

console.log('🔑 Generated Token for user:', payload.userId);
console.log('');

// Test data for a dream
const dreamData = {
  dreamText: "I was flying through a beautiful blue sky, feeling completely free and happy. I could see mountains below me and felt a sense of peace and accomplishment.",
  interpretationType: 'basic',
  locale: 'en',
  tags: ['flying', 'freedom'],
  isRecurring: false
};

const postData = JSON.stringify(dreamData);

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

console.log('🔐 Using authenticated endpoint (not test endpoint)');
console.log('👤 User ID in token:', payload.userId);

console.log('🚀 Creating a test dream for the real user...');
console.log('Dream content:', dreamData.dreamText.substring(0, 50) + '...');

const req = http.request(options, (res) => {
  console.log(`📊 Dream creation status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('');
    console.log('📋 Response:');
    console.log(body);

    if (res.statusCode === 201) {
      console.log('');
      console.log('✅ Dream created successfully!');
      console.log('💡 Now the user should see their dream in the dashboard');
      console.log('');
      console.log('🔄 Testing statistics again...');

      // Now test the statistics endpoint
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
        console.log(`📊 Statistics Status: ${statsRes.statusCode}`);

        statsRes.setEncoding('utf8');
        let statsBody = '';
        statsRes.on('data', (chunk) => {
          statsBody += chunk;
        });

        statsRes.on('end', () => {
          console.log('');
          console.log('📈 Updated Statistics Response:');
          console.log(statsBody);

          try {
            const stats = JSON.parse(statsBody);
            console.log('');
            console.log('📊 Updated Parsed Statistics:');
            console.log(`Total Dreams: ${stats.stats?.totalDreams || 0}`);
            console.log(`This Month: ${stats.stats?.thisMonth || 0}`);
            console.log(`Recurring Dreams: ${stats.stats?.recurringDreams || 0}`);
            console.log(`Credits Used: ${stats.stats?.creditsUsed || 0}`);

            if (stats.stats?.totalDreams > 0) {
              console.log('');
              console.log('🎉 SUCCESS! The user now has dreams in their dashboard!');
            } else {
              console.log('');
              console.log('❌ Still showing 0 dreams - there may be another issue');
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
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Problem with dream creation request: ${e.message}`);
});

req.write(postData);
req.end();
