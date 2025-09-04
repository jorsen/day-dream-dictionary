require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('Testing Credits System...\n');
console.log('='.repeat(50));

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCredits() {
  try {
    console.log('1. Checking if credits table exists...');

    // Try to select from credits table
    const { data: creditsData, error: creditsError } = await supabase
      .from('credits')
      .select('*')
      .limit(5);

    if (creditsError) {
      if (creditsError.code === '42P01') {
        console.log('❌ Credits table does not exist!');
        console.log('   You need to run the database setup script.');
        console.log('   Run: supabase-quick-setup.sql in your Supabase SQL editor');
        return;
      } else {
        console.log(`❌ Error accessing credits table: ${creditsError.message}`);
        return;
      }
    }

    console.log('✅ Credits table exists');
    console.log(`   Found ${creditsData?.length || 0} credit records`);

    if (creditsData && creditsData.length > 0) {
      console.log('\n2. Sample credit records:');
      creditsData.forEach((record, index) => {
        console.log(`   Record ${index + 1}: User ${record.user_id} has ${record.balance} credits`);
      });
    }

    // Get all users to check their credits
    console.log('\n3. Checking user credits...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.log(`❌ Error getting users: ${usersError.message}`);
      return;
    }

    console.log(`   Found ${users.users?.length || 0} users in auth`);

    if (users.users && users.users.length > 0) {
      for (const user of users.users) {
        console.log(`\n   Checking credits for user: ${user.email} (${user.id})`);

        const { data: userCredits, error: userCreditsError } = await supabase
          .from('credits')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (userCreditsError) {
          if (userCreditsError.code === 'PGRST116') {
            console.log(`   ❌ No credits record found for this user`);
            console.log(`   Creating credits record with 5 credits...`);

            const { data: newCredits, error: insertError } = await supabase
              .from('credits')
              .insert([{
                user_id: user.id,
                balance: 5,
                lifetime_earned: 5,
                lifetime_spent: 0
              }])
              .select()
              .single();

            if (insertError) {
              console.log(`   ❌ Failed to create credits: ${insertError.message}`);
            } else {
              console.log(`   ✅ Created credits record: ${newCredits.balance} credits`);
            }
          } else {
            console.log(`   ❌ Error checking credits: ${userCreditsError.message}`);
          }
        } else {
          console.log(`   ✅ User has ${userCredits.balance} credits`);
        }
      }
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

testCredits().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('Credits test complete!');
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
