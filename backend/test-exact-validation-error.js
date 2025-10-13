const http = require('http');

// Test the exact validation error you're getting
console.log('🔍 TESTING YOUR EXACT VALIDATION ERROR');
console.log('You\'re getting {errors: Array(1)} - let\'s find out what it is');
console.log('');

console.log('💡 Most common validation errors:');
console.log('1. Invalid email format');
console.log('2. Password too short (min 6 characters)');
console.log('3. Display name too short');
console.log('4. Invalid locale');
console.log('');

console.log('🔧 Let\'s test various scenarios...');

const testCases = [
  {
    name: 'Standard valid data',
    data: {
      email: 'browser-test@example.com',
      password: 'password123',
      displayName: 'Test User',
      locale: 'en'
    }
  },
  {
    name: 'Short password',
    data: {
      email: 'browser-test2@example.com',
      password: '12345',
      displayName: 'Test User',
      locale: 'en'
    }
  },
  {
    name: 'Invalid email format',
    data: {
      email: 'invalid-email',
      password: 'password123',
      displayName: 'Test User',
      locale: 'en'
    }
  },
  {
    name: 'Short display name',
    data: {
      email: 'browser-test3@example.com',
      password: 'password123',
      displayName: 'A',
      locale: 'en'
    }
  },
  {
    name: 'Invalid locale',
    data: {
      email: 'browser-test4@example.com',
      password: 'password123',
      displayName: 'Test User',
      locale: 'invalid'
    }
  }
];

let currentTest = 0;

function runNextTest() {
  if (currentTest >= testCases.length) {
    console.log('');
    console.log('💡 All validation tests completed');
    console.log('');
    console.log('🔧 To debug your specific error:');
    console.log('1. Open browser console on login.html');
    console.log('2. Try to sign up');
    console.log('3. Check the exact error in the Network tab');
    console.log('4. Look for the specific field that failed validation');
    console.log('');
    console.log('🎯 Most likely issue: Email format or password length');
    return;
  }

  const testCase = testCases[currentTest];
  console.log('');
  console.log(`🧪 ${testCase.name}`);
  console.log('Testing:', JSON.stringify(testCase.data, null, 2));

  const postData = JSON.stringify(testCase.data);

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

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);

    res.setEncoding('utf8');
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      console.log('Response:', body);

      try {
        const data = JSON.parse(body);
        if (data.errors && data.errors.length > 0) {
          console.log('❌ Validation errors:');
          data.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. Field: ${error.param}, Error: ${error.msg}`);
          });
        } else if (data.message) {
          console.log('✅ Success:', data.message);
        }
      } catch (e) {
        console.log('Could not parse response as JSON');
      }

      currentTest++;
      setTimeout(runNextTest, 1000);
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
    currentTest++;
    setTimeout(runNextTest, 1000);
  });

  req.write(postData);
  req.end();
}

console.log('🔄 Testing different validation scenarios...');
runNextTest();
