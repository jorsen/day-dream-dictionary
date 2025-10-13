const http = require('http');

// Debug the signup issue - why are you getting 400 Bad Request?
console.log('🔍 DEBUGGING SIGNUP ISSUE');
console.log('You\'re getting 400 Bad Request when trying to sign up');
console.log('');

console.log('💡 Common causes of 400 errors in signup:');
console.log('1. Email already exists');
console.log('2. Password too weak');
console.log('3. Missing required fields');
console.log('4. Invalid email format');
console.log('5. Server validation errors');
console.log('');

console.log('🔧 Let\'s test the signup endpoint directly...');

const testSignupData = {
  email: 'test@example.com',
  password: 'password123',
  displayName: 'Test User',
  locale: 'en'
};

const postData = JSON.stringify(testSignupData);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('📝 Testing signup with data:', testSignupData);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);

  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Response body:', body);

    try {
      const data = JSON.parse(body);
      console.log('');
      console.log('📋 Parsed response:');
      console.log('Message:', data.message);
      if (data.errors) {
        console.log('Validation errors:', data.errors);
      }
    } catch (e) {
      console.log('Could not parse response as JSON');
    }

    console.log('');
    console.log('💡 Possible solutions:');
    console.log('1. Try a different email address');
    console.log('2. Check password requirements (min 6 characters)');
    console.log('3. Ensure all required fields are filled');
    console.log('4. Check server logs for detailed error');
    console.log('');

    console.log('🔧 Try this in your browser console:');
    console.log('1. Open login.html');
    console.log('2. Press F12 to open console');
    console.log('3. Try signing up and check the error message');
    console.log('4. Look for validation errors in red text');
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();

console.log('');
console.log('🔄 This test will show the exact error message from the server...');
