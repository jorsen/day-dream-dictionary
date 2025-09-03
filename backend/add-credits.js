const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });
const { getSupabaseAdmin, updateUserCredits } = require('./src/config/supabase');

async function addCreditsToUser(email, amount) {
  const supabaseAdmin = getSupabaseAdmin();
  
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  const user = users.find(u => u.email === email);
  
  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  const userId = user.id;
  await updateUserCredits(userId, amount, 'add');
  console.log(`Added ${amount} credits to user ${email} (ID: ${userId})`);
}

addCreditsToUser('jorsenmejia@gmail.com', 100);