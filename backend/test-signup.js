const axios = require('axios');
require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 5000}/api/${process.env.API_VERSION || 'v1'}`;

console.log('Testing Day Dream Dictionary API Signup\n');
console.log('='.repeat(50));

// Test data
const testUser = {
  email: `test${Date.now()}@example.com`,
  password: 'TestPassword123!',
  displayName: 'Test User',
  locale: 'en'
};

console.log('Test Configuration:');
console.log(`- API URL: ${API_URL}`);
console.log(`- Test Email: ${testUser.email}`);
console.log(`- Display Name: ${testUser.displayName}`);
console.log();

// Function to test health endpoint
async function testHealth() {
  console.log('1. Testing Health Endpoint...');
  try {
    const response = await axios.get(`http://localhost:${process.env.PORT || 5000}/health`);
    console.log('   ✅ Health check passed:', response.data.message);
    console.log(`   - Version: ${response.data.version}`);
    return true;
  } catch (error) {
    console.log('   ❌ Health check failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('   ⚠️  Server is not running! Please start the backend server first.');
      console.log('   Run: cd backend && npm start');
    }
    return false;
  }
}

// Function to test signup endpoint
async function testSignup() {
  console.log('\n2. Testing Signup Endpoint...');
  console.log(`   Endpoint: POST ${API_URL}/auth/signup`);
  
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
          return status < 500; // Resolve only if the status code is less than 500
        }
      }
    );
    
    console.log(`   Response Status: ${response.status}`);
    console.log(`   Response Headers Content-Type: ${response.headers['content-type']}`);
    
    if (response.headers['content-type']?.includes('text/html')) {
      console.log('   ❌ ERROR: Received HTML instead of JSON!');
      console.log('   This usually means:');
      console.log('   1. The API route is not found (404)');
      console.log('   2. There\'s a middleware issue');
      console.log('   3. The server is serving a default HTML page');
      console.log('\n   HTML Response (first 500 chars):');
      console.log('   ' + response.data.substring(0, 500));
      return false;
    }
    
    if (response.status === 201) {
      console.log('   ✅ Signup successful!');
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } else {
      console.log(`   ⚠️  Signup returned status ${response.status}`);
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      return false;
    }
    
  } catch (error) {
    console.log('   ❌ Signup request failed:', error.message);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Content-Type: ${error.response.headers['content-type']}`);
      
      if (error.response.headers['content-type']?.includes('text/html')) {
        console.log('   ❌ Received HTML error page instead of JSON');
        console.log('   HTML Response (first 500 chars):');
        console.log('   ' + error.response.data.substring(0, 500));
      } else {
        console.log('   Response:', error.response.data);
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   ⚠️  Cannot connect to server. Is it running?');
    }
    return false;
  }
}

// Function to test login with created user
async function testLogin(email, password) {
  console.log('\n3. Testing Login Endpoint...');
  console.log(`   Endpoint: POST ${API_URL}/auth/login`);
  
  try {
    const response = await axios.post(
      `${API_URL}/auth/login`,
      { email, password },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      console.log('   ✅ Login successful!');
      console.log(`   - User ID: ${response.data.user.id}`);
      console.log(`   - Email: ${response.data.user.email}`);
      console.log(`   - Access Token: ${response.data.accessToken.substring(0, 20)}...`);
      return response.data;
    }
    
  } catch (error) {
    console.log('   ❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Function to check if MongoDB is running
async function checkMongoDB() {
  console.log('\n4. Checking MongoDB Connection...');
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/daydreamdictionary';
  
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    console.log('   ✅ MongoDB is running and accessible');
    await client.close();
    return true;
  } catch (error) {
    console.log('   ❌ MongoDB connection failed:', error.message);
    console.log('   ⚠️  Make sure MongoDB is running locally');
    console.log('   Run: mongod (or start MongoDB service)');
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('='.repeat(50));
  console.log('Starting API Tests...\n');
  
  // Check if server is running
  const healthOk = await testHealth();
  if (!healthOk) {
    console.log('\n' + '='.repeat(50));
    console.log('❌ Tests failed: Server is not running');
    console.log('\nTo fix this:');
    console.log('1. Open a new terminal');
    console.log('2. Navigate to backend: cd backend');
    console.log('3. Start the server: npm start');
    console.log('4. Run this test again');
    process.exit(1);
  }
  
  // Check MongoDB
  const mongoOk = await checkMongoDB();
  if (!mongoOk) {
    console.log('\n⚠️  Warning: MongoDB is not running');
    console.log('Some features may not work properly');
  }
  
  // Test signup
  const signupResult = await testSignup();
  
  if (signupResult && signupResult.accessToken) {
    // Test login with the created user
    await testLogin(testUser.email, testUser.password);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary:');
  console.log(`✅ Server is running on port ${process.env.PORT || 5000}`);
  
  if (signupResult) {
    console.log('✅ Signup endpoint is working');
    console.log('✅ API is returning JSON responses');
  } else {
    console.log('❌ Signup endpoint has issues');
    console.log('\nPossible solutions:');
    console.log('1. Check if Supabase tables are created (run supabase-quick-setup.sql)');
    console.log('2. Verify Supabase API keys are correct');
    console.log('3. Check server logs for detailed error messages');
    console.log('4. Ensure all dependencies are installed (npm install)');
  }
  
  console.log('\n' + '='.repeat(50));
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});