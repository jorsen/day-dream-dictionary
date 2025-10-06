// Test script to verify authentication fix
require('dotenv').config({ path: '.env' });
const { getSupabase, initSupabase } = require('./src/config/supabase');
const { testMode } = require('./src/config/test-mode');

async function testAuthentication() {
  console.log('🔧 Testing Authentication Fix...\n');

  try {
    // Initialize Supabase
    await initSupabase();

    console.log('✅ Supabase initialized');
    console.log('📋 Test Mode:', testMode);
    console.log('🔗 Supabase URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
    console.log('🔑 Supabase Anon Key:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');

    // Test authentication with test credentials
    const supabase = getSupabase();

    if (testMode) {
      console.log('\n🧪 Running in TEST MODE');
      console.log('✅ Test mode authentication should work');

      // Test login with test credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'test'
      });

      if (error) {
        console.log('❌ Test login failed:', error.message);
      } else {
        console.log('✅ Test login successful');
      }
    } else {
      console.log('\n🌐 Running in PRODUCTION MODE');
      console.log('ℹ️  To test authentication, you need to:');
      console.log('   1. Set up your Supabase project');
      console.log('   2. Update SUPABASE_URL and SUPABASE_ANON_KEY in .env');
      console.log('   3. Create a test user in Supabase Auth');
      console.log('   4. Set TEST_MODE=false');
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Update your .env file with real Supabase credentials');
    console.log('2. Set TEST_MODE=false for production');
    console.log('3. Start the server: npm run dev');
    console.log('4. Test login at: http://localhost:3000/login.html');

  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your .env file exists and has correct values');
    console.log('2. Verify Supabase project is set up');
    console.log('3. Check network connection to Supabase');
  }
}

testAuthentication();
