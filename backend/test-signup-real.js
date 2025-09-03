const axios = require('axios');
require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 5000}/api/${process.env.API_VERSION || 'v1'}`;

console.log('Testing Day Dream Dictionary API - Real Signup\n');
console.log('='.repeat(50));

// Use a more realistic email format
const testUser = {
  email: 'john.doe@gmail.com',  // More realistic email
  password: 'TestPassword123!',
  displayName: 'John Doe',
  locale: 'en'
};

console.log('Test User Details:');
console.log(`- Email: ${testUser.email}`);
console.log(`- Password: ${testUser.password}`);
console.log(`- Display Name: ${testUser.displayName}`);
console.log();

async function testSignup() {
  console.log('Testing Signup...');
  console.log(`Endpoint: POST ${API_URL}/auth/signup`);
  
  try {
    const response = await axios.post(
      `${API_URL}/auth/signup`,
      testUser,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        validateStatus: function (status) {
          return status < 500; // Accept all non-server-error statuses
        }
      }
    );
    
    console.log(`\nResponse Status: ${response.status}`);
    
    if (response.status === 201) {
      console.log('✅ Signup successful!');
      console.log('\nUser Details:');
      console.log(`- User ID: ${response.data.user.id}`);
      console.log(`- Email: ${response.data.user.email}`);
      console.log(`- Display Name: ${response.data.user.displayName}`);
      console.log(`- Access Token: ${response.data.accessToken.substring(0, 30)}...`);
      return response.data;
    } else if (response.status === 409) {
      console.log('⚠️  Email already registered');
      console.log('This is expected if you run the test multiple times');
      return { alreadyExists: true };
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
    
  } catch (error) {
    console.log('❌ Signup failed:', error.message);
    if (error.response) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function testLogin() {
  console.log('\nTesting Login...');
  console.log(`Endpoint: POST ${API_URL}/auth/login`);
  
  try {
    const response = await axios.post(
      `${API_URL}/auth/login`,
      {
        email: testUser.email,
        password: testUser.password
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      console.log('✅ Login successful!');
      console.log('\nUser Session:');
      console.log(`- User ID: ${response.data.user.id}`);
      console.log(`- Email: ${response.data.user.email}`);
      console.log(`- Role: ${response.data.user.role}`);
      console.log(`- Email Verified: ${response.data.user.emailVerified}`);
      return response.data;
    }
    
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function runTest() {
  console.log('='.repeat(50));
  console.log('Starting Test...\n');
  
  // Test signup
  const signupResult = await testSignup();
  
  if (signupResult) {
    if (signupResult.alreadyExists) {
      // Try to login if user already exists
      console.log('\nUser already exists, attempting login...');
      await testLogin();
    } else if (signupResult.accessToken) {
      console.log('\n✅ New user created successfully!');
      
      // Try to login with the new user
      console.log('\nVerifying login with new credentials...');
      await testLogin();
    }
  } else {
    console.log('\n❌ Signup failed. Please check:');
    console.log('1. Supabase tables are created (run supabase-quick-setup.sql)');
    console.log('2. Supabase project settings allow new signups');
    console.log('3. Email confirmations are disabled for testing');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Test Complete!\n');
  
  console.log('📝 Notes:');
  console.log('- If signup fails with "invalid email", check Supabase Auth settings');
  console.log('- You may need to disable email confirmations in Supabase dashboard');
  console.log('- Go to: Authentication → Providers → Email → Disable "Confirm email"');
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});