const http = require('http');

// Debug the validation errors in signup
console.log('🔍 DEBUGGING VALIDATION ERRORS');
console.log('You\'re getting 400 Bad Request with validation errors');
console.log('');

console.log('💡 Let\'s test different email/password combinations...');

const testCases = [
  {
    name: 'Test Case 1 - Simple email',
    data: {
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      locale: 'en'
    }
  },
  {
    name: 'Test Case 2 - Different email',
    data: {
      email: 'newtest@example.com',
      password: 'password123',
      displayName: 'Test User',
      locale: 'en'
    }
  },
  {
    name: 'Test Case 3 - Complex email',
    data: {
      email: 'test123+label@gmail.com',
      password: 'password123',
      displayName: 'Test User',
      locale: 'en'
    }
  }
];

let currentTest = 0;

function runNextTest() {
  if (currentTest >= testCases.length) {
    console.log('');
    console.log('💡 All tests completed');
    console.log('🔧 Try these solutions:');
    console.log('1. Check email format (must be valid email)');
    console.log('2. Ensure password is at least 6 characters');
    console.log('3. Try a simpler email address');
    console.log('4. Check browser network tab for exact error');
    return;
  }

  const testCase = testCases[currentTest];
  console.log('');
  console.log(`🧪 ${testCase.name}`);
  console.log('Data:', testCase.data);

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
            console.log(`  ${index + 1}. ${error.msg} (field: ${error.param})`);
          });
        } else if (data.message) {
          console.log('✅ Success:', data.message);
        }
      } catch (e) {
        console.log('Could not parse response');
      }

      currentTest++;
      setTimeout(runNextTest, 1000); // Wait 1 second between tests
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

console.log('🔄 Running multiple test cases to identify the validation issue...');
runNextTest();
