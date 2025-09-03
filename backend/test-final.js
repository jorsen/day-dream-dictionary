const axios = require('axios');
require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 5000}/api/${process.env.API_VERSION || 'v1'}`;

// Generate unique email for testing
const uniqueEmail = `user${Date.now()}@test.com`;
const testUser = {
  email: uniqueEmail,
  password: 'TestPassword123!',
  displayName: 'Test User',
  locale: 'en'
};

console.log('🚀 Final Supabase Test\n');
console.log('='.repeat(50));
console.log('Testing with unique email:', uniqueEmail);
console.log();

async function testSignup() {
  console.log('1. Testing Signup...');
  
  try {
    const response = await axios.post(
      `${API_URL}/auth/signup`,
      testUser,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        validateStatus: (status) => status < 500
      }
    );
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 201) {
      console.log('   ✅ SIGNUP SUCCESSFUL!');
      console.log(`   - User ID: ${response.data.user.id}`);
      console.log(`   - Email: ${response.data.user.email}`);
      console.log(`   - Display Name: ${response.data.user.displayName}`);
      console.log(`   - Access Token: ${response.data.accessToken.substring(0, 30)}...`);
      return response.data;
    } else {
      console.log(`   ❌ Signup failed with status ${response.status}`);
      console.log(`   Error: ${response.data.message}`);
      return null;
    }
  } catch (error) {
    console.log('   ❌ Request failed:', error.message);
    if (error.response) {
      console.log('   Details:', error.response.data);
    }
    return null;
  }
}

async function testLogin() {
  console.log('\n2. Testing Login...');
  
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
      console.log('   ✅ LOGIN SUCCESSFUL!');
      console.log(`   - User ID: ${response.data.user.id}`);
      console.log(`   - Role: ${response.data.user.role}`);
      return response.data;
    }
  } catch (error) {
    console.log('   ❌ Login failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function runTest() {
  console.log('='.repeat(50));
  
  const signupResult = await testSignup();
  
  if (signupResult) {
    await testLogin();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 SUCCESS! Your Supabase setup is working perfectly!');
    console.log('\nYou can now:');
    console.log('1. Open test-frontend.html in a browser');
    console.log('2. Use the signup/login forms');
    console.log('3. Test dream interpretation features');
  } else {
    console.log('\n' + '='.repeat(50));
    console.log('❌ Signup is still failing');
    console.log('\nPossible issues:');
    console.log('1. Supabase email provider not enabled');
    console.log('2. Database tables not created');
    console.log('3. RLS policies blocking inserts');
  }
}

// Run the test
runTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});