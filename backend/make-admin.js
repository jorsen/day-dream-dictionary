require('dotenv').config({ path: __dirname + '/.env' });
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const userEmail = 'jorsenmejia@gmail.com'; 
// --- END CONFIGURATION ---

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function makeAdminAndGrantCredits(email) {
  console.log(`🚀 Starting script for user: ${email}`);

  // 1. Find the user ID
  console.log('\n1. Fetching user ID...');
  let userId;
  try {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    
    const user = users.find(u => u.email === email);
    if (!user) {
      console.error(`❌ User with email "${email}" not found.`);
      return;
    }
    userId = user.id;
    console.log(`   ✅ User ID found: ${userId}`);
  } catch (error) {
    console.error('   Error fetching user:', error.message);
    return;
  }

  // 2. Upsert the role to 'admin'
  console.log("\n2. Setting user role to 'admin'...");
  try {
    const { data, error } = await supabase
      .from('roles')
      .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    console.log(`   ✅ Role set to '${data.role}' successfully.`);
  } catch (error) {
    console.error('   Error setting role:', error.message);
    return;
  }

  // 3. Grant 999 credits
  console.log('\n3. Granting 999 credits...');
  try {
    const { data: creditData, error: creditError } = await supabase
      .from('credits')
      .upsert(
        { user_id: userId, balance: 999, lifetime_earned: 999 },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
      
    if (creditError) throw creditError;
    console.log(`   ✅ User now has ${creditData.balance} credits.`);

  } catch (error) {
    console.error(`   Error granting credits:`, error.message);
     // If the error is due to RLS, provide a helpful hint.
    if (error.message.includes('permission denied')) {
        console.log('\n   💡 RLS Hint: The service_role key might not have permission to write to the `credits` table.');
        console.log('   Go to "Authentication" -> "Policies" in your Supabase dashboard and ensure the `credits` table is accessible.');
    }
    return;
  }

  console.log('\n🎉 Operation completed successfully!');
}

makeAdminAndGrantCredits(userEmail);