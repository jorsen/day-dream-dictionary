const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

const {
  getUserLoyaltyTier,
  getUserSubscriptionMultiplier,
  calculateDynamicPricing,
  calculateWelcomeBonus,
  calculateBehavioralBonus,
  getTotalDynamicCredits,
  applyDynamicCredits
} = require('./src/config/dynamic-credits');

const { getSupabase } = require('./src/config/supabase');

async function testDynamicCredits() {
  console.log('🧪 Testing Dynamic Credit System...\n');

  try {
    const supabase = getSupabase();

    // Get a test user (you'll need to replace this with an actual user ID)
    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users || users.length === 0) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }

    const testUserId = users[0].id;
    console.log(`👤 Testing with user ID: ${testUserId}\n`);

    // Test individual functions
    console.log('1. Testing Loyalty Tier Calculation...');
    const loyaltyTier = await getUserLoyaltyTier(testUserId);
    console.log(`   Loyalty Tier: ${loyaltyTier}`);

    console.log('2. Testing Subscription Multiplier...');
    const subscriptionMultiplier = await getUserSubscriptionMultiplier(testUserId);
    console.log(`   Subscription Multiplier: ${subscriptionMultiplier}x`);

    console.log('3. Testing Dynamic Pricing...');
    const dynamicPrice10 = await calculateDynamicPricing(testUserId, 999, 10);
    const dynamicPrice25 = await calculateDynamicPricing(testUserId, 1999, 25);
    console.log(`   10 credits: $9.99 → $${(dynamicPrice10 / 100).toFixed(2)}`);
    console.log(`   25 credits: $19.99 → $${(dynamicPrice25 / 100).toFixed(2)}`);

    console.log('4. Testing Welcome Bonus Calculation...');
    const welcomeBonus = await calculateWelcomeBonus(testUserId);
    console.log(`   Welcome Bonus: ${welcomeBonus} credits`);

    console.log('5. Testing Behavioral Bonus Calculation...');
    const behavioralBonus = await calculateBehavioralBonus(testUserId);
    console.log(`   Behavioral Bonus: ${behavioralBonus} credits`);

    console.log('6. Testing Total Dynamic Credits...');
    const totalDynamicCredits = await getTotalDynamicCredits(testUserId);
    console.log(`   Total Bonus: ${totalDynamicCredits.totalBonus} credits`);
    console.log(`   Welcome: ${totalDynamicCredits.welcomeBonus} credits`);
    console.log(`   Behavioral: ${totalDynamicCredits.behavioralBonus} credits`);
    console.log(`   Loyalty Multiplier: ${totalDynamicCredits.loyaltyMultiplier}x`);
    console.log(`   Subscription Multiplier: ${totalDynamicCredits.subscriptionMultiplier}x`);

    console.log('7. Testing Dynamic Credit Application...');
    const applicationResult = await applyDynamicCredits(testUserId);
    console.log(`   Credits Added: ${applicationResult.creditsAdded}`);
    console.log(`   Reason: ${applicationResult.reason}`);

    console.log('\n✅ Dynamic Credit System Test Completed Successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - User gets ${totalDynamicCredits.totalBonus} bonus credits`);
    console.log(`   - Loyalty tier: ${loyaltyTier}`);
    console.log(`   - Effective multiplier: ${(totalDynamicCredits.loyaltyMultiplier * totalDynamicCredits.subscriptionMultiplier).toFixed(2)}x`);
    console.log(`   - 10 credits = ${Math.round(10 * totalDynamicCredits.loyaltyMultiplier * totalDynamicCredits.subscriptionMultiplier)} effective credits`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDynamicCredits();
