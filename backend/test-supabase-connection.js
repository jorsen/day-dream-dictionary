require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('Testing Supabase Connection...\n');
console.log('='.repeat(50));

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('1. Checking environment variables:');
console.log(`   - SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
console.log(`   - SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   - SUPABASE_SERVICE_KEY: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`);
console.log();

// Validate JWT format
function validateJWT(token, name) {
  console.log(`2. Validating ${name}:`);
  
  if (!token) {
    console.log(`   ❌ Token is missing`);
    return false;
  }
  
  // Check if it starts with valid JWT header
  if (!token.startsWith('eyJ')) {
    console.log(`   ❌ Invalid JWT format (should start with 'eyJ')`);
    return false;
  }
  
  // Check JWT structure (should have 3 parts separated by dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log(`   ❌ Invalid JWT structure (expected 3 parts, got ${parts.length})`);
    return false;
  }
  
  try {
    // Decode and display JWT payload (without verification)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log(`   ✅ Valid JWT structure`);
    console.log(`   - Issuer: ${payload.iss}`);
    console.log(`   - Reference: ${payload.ref}`);
    console.log(`   - Role: ${payload.role}`);
    console.log(`   - Issued at: ${new Date(payload.iat * 1000).toISOString()}`);
    console.log(`   - Expires at: ${new Date(payload.exp * 1000).toISOString()}`);
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log(`   ⚠️  WARNING: Token is expired!`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Failed to decode JWT: ${error.message}`);
    return false;
  }
}

console.log('='.repeat(50));
const anonValid = validateJWT(supabaseAnonKey, 'SUPABASE_ANON_KEY');
console.log();

console.log('='.repeat(50));
const serviceValid = validateJWT(supabaseServiceKey, 'SUPABASE_SERVICE_KEY');
console.log();

// Test actual connection
async function testConnection() {
  console.log('='.repeat(50));
  console.log('3. Testing actual connection to Supabase:');
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('   ❌ Cannot test connection - missing required variables');
    return;
  }
  
  try {
    // Create client with anon key
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test 1: Check if we can get session (should work even without auth)
    console.log('   Testing anonymous client...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError && sessionError.message !== 'Auth session missing!') {
      console.log(`   ❌ Anonymous client error: ${sessionError.message}`);
    } else {
      console.log('   ✅ Anonymous client connected successfully');
    }
    
    // Test 2: Try to fetch from a public table (this might fail if no tables exist)
    console.log('   Testing database access...');
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  Table "profiles" does not exist (need to run migrations)');
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('   ⚠️  Database tables not set up yet');
      } else if (error.message.includes('JWT')) {
        console.log(`   ❌ JWT authentication error: ${error.message}`);
      } else {
        console.log(`   ℹ️  Database query result: ${error.message}`);
      }
    } else {
      console.log('   ✅ Database connection successful');
    }
    
    // Test 3: Test service role client if available
    if (supabaseServiceKey && serviceValid) {
      console.log('   Testing service role client...');
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      try {
        // Try to list users (requires service role)
        const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1
        });
        
        if (usersError) {
          console.log(`   ❌ Service role error: ${usersError.message}`);
        } else {
          console.log('   ✅ Service role client connected successfully');
          console.log(`   - Total users in database: ${users?.users?.length || 0}`);
        }
      } catch (error) {
        console.log(`   ❌ Service role connection failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Connection test failed: ${error.message}`);
  }
}

// Run the test
testConnection().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('Test complete!');
  console.log('\nSummary:');
  
  if (supabaseUrl && anonValid) {
    console.log('✅ Your Supabase API keys appear to be correctly formatted');
    console.log('   The connection test results above show the actual connectivity status.');
    
    if (supabaseUrl.includes('gwgjckczyscpaozlevpe')) {
      console.log('\n📝 Note: You are using the Supabase project: gwgjckczyscpaozlevpe');
      console.log('   Make sure this is your intended project.');
    }
  } else {
    console.log('❌ There are issues with your Supabase configuration');
    console.log('   Please check the errors above and update your .env file');
  }
  
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});