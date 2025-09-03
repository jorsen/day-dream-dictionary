const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('Testing Supabase Auth Directly\n');
console.log('='.repeat(50));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('Configuration:');
console.log(`- URL: ${supabaseUrl}`);
console.log(`- Key: ${supabaseAnonKey?.substring(0, 20)}...`);
console.log();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  console.log('1. Testing Signup with Supabase Auth...');
  
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          display_name: 'Test User'
        }
      }
    });
    
    if (error) {
      console.log(`   ❌ Signup failed: ${error.message}`);
      console.log(`   Error code: ${error.code}`);
      console.log(`   Error status: ${error.status}`);
      
      if (error.message.includes('invalid')) {
        console.log('\n   📝 This error suggests:');
        console.log('   - Supabase project might not be set up correctly');
        console.log('   - Email provider might be disabled');
        console.log('   - Project might be paused or have issues');
      }
      
      return false;
    } else {
      console.log('   ✅ Signup successful!');
      console.log(`   User ID: ${data.user?.id}`);
      console.log(`   Email: ${data.user?.email}`);
      console.log(`   Session: ${data.session ? 'Created' : 'Not created (email confirmation required)'}`);
      return data;
    }
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error.message}`);
    return false;
  }
}

async function testLogin(email, password) {
  console.log('\n2. Testing Login with Supabase Auth...');
  console.log(`   Email: ${email}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.log(`   ❌ Login failed: ${error.message}`);
      return false;
    } else {
      console.log('   ✅ Login successful!');
      console.log(`   User ID: ${data.user?.id}`);
      console.log(`   Session Token: ${data.session?.access_token?.substring(0, 20)}...`);
      return data;
    }
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error.message}`);
    return false;
  }
}

async function checkAuthSettings() {
  console.log('\n3. Checking Auth Settings...');
  
  try {
    // Try to get current session (should be null if not logged in)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log(`   ❌ Cannot connect to Supabase: ${error.message}`);
      return false;
    }
    
    console.log(`   ✅ Connected to Supabase successfully`);
    console.log(`   Current session: ${session ? 'Active' : 'None'}`);
    
    // Check if we can access the auth admin (this will fail with anon key, but the error tells us something)
    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      console.log('   ✅ Admin access available (using service key)');
    } catch (adminError) {
      console.log('   ℹ️  Admin access not available (using anon key - this is normal)');
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Error checking settings: ${error.message}`);
    return false;
  }
}

async function testDatabaseAccess() {
  console.log('\n4. Testing Database Access...');
  
  try {
    // Try to query a table (even if it doesn't exist, we'll get a different error)
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('   ⚠️  Tables not created yet - run supabase-quick-setup.sql');
      } else if (error.message.includes('JWT')) {
        console.log(`   ❌ Authentication error: ${error.message}`);
      } else {
        console.log(`   ℹ️  Database query result: ${error.message}`);
      }
    } else {
      console.log('   ✅ Database access successful');
    }
  } catch (error) {
    console.log(`   ❌ Unexpected error: ${error.message}`);
  }
}

async function runTests() {
  console.log('='.repeat(50));
  console.log('Starting Direct Supabase Tests...\n');
  
  // Check connection
  const connected = await checkAuthSettings();
  
  if (!connected) {
    console.log('\n❌ Cannot connect to Supabase. Please check:');
    console.log('1. Your SUPABASE_URL is correct');
    console.log('2. Your SUPABASE_ANON_KEY is valid');
    console.log('3. Your Supabase project is active (not paused)');
    return;
  }
  
  // Test database
  await testDatabaseAccess();
  
  // Test signup
  const signupResult = await testSignup();
  
  if (signupResult && signupResult.user) {
    // Test login with the created user
    await testLogin(signupResult.user.email, 'TestPassword123!');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Test Complete!\n');
  
  if (!signupResult) {
    console.log('⚠️  IMPORTANT: Signup is failing\n');
    console.log('To fix this, you need to:');
    console.log('1. Go to https://supabase.com/dashboard/project/gwgjckczyscpaozlevpe');
    console.log('2. Navigate to Authentication → Providers');
    console.log('3. Click on Email provider');
    console.log('4. Make sure:');
    console.log('   - "Enable Email Provider" is ON');
    console.log('   - "Confirm email" is OFF (for testing)');
    console.log('   - "Enable signup" is ON');
    console.log('5. Save the settings');
    console.log('6. Run this test again');
    console.log('\nAlternatively, you might need to:');
    console.log('- Check if your project is paused (Settings → General)');
    console.log('- Create a new Supabase project if this one has issues');
  } else {
    console.log('✅ Supabase Auth is working correctly!');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});