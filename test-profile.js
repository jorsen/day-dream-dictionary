const https = require('https');
const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzMjM0ZTA1YS04YjgzLTQzMDYtYThhYS0wMTM3NDRjOGIwY2EiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzU3MDEwNjAxLCJleHAiOjE3NTc2MTU0MDF9.nTy_6HdFeDY3_cRyDxioBq-PPkkGT3FAihHAu46o9dg';

function testProfile() {
  console.log('Testing profile API with token...');

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/profile',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log('Response status:', res.statusCode);
    console.log('Response headers:', res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        console.log('Response data:', JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error:', error.message);
  });

  req.end();
}

testProfile();
