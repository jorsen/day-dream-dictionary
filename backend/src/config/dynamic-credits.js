const { getSupabase } = require('./supabase');

// Dynamic credit configuration based on user profiles and behavior
const DYNAMIC_CREDIT_CONFIG = {
  // Welcome bonuses for new users
  welcomeBonuses: {
    newUser: 5,           // Credits for completing profile setup
    emailVerified: 3,     // Bonus for email verification
    firstDream: 2,        // Bonus for first dream interpretation
    profileComplete: 5    // Bonus for completing full profile
  },

  // Behavioral bonuses
  behavioralBonuses: {
    dailyActive: 1,       // Daily login streak bonus (max 7)
    weeklyDreams: 3,      // 5+ dreams in a week
    monthlyActive: 5,     // Active for entire month
    referralBonus: 10,    // Credits for successful referral
    reviewBonus: 5        // Credits for leaving review
  },

  // Subscription multipliers
  subscriptionMultipliers: {
    basic: 1.0,           // No multiplier
    pro: 1.5,             // 50% more credits from purchases
    premium: 2.0          // 100% more credits from purchases
  },

  // Loyalty program
  loyaltyTiers: {
    bronze: { threshold: 50, multiplier: 1.0 },
    silver: { threshold: 200, multiplier: 1.1 },
    gold: { threshold: 500, multiplier: 1.2 },
    platinum: { threshold: 1000, multiplier: 1.3 }
  },

  // Dynamic pricing based on user history
  dynamicPricing: {
    newUserDiscount: 0.9,     // 10% discount for first purchase
    bulkDiscount: {
      threshold: 100,         // Credits purchased
      discount: 0.85          // 15% discount
    },
    frequentUserDiscount: {
      threshold: 20,          // Dreams interpreted
      discount: 0.95          // 5% discount
    }
  },

  // Seasonal promotions
  seasonalPromotions: {
    holidaySeason: {
      active: false,
      multiplier: 1.25,
      startDate: '2024-12-01',
      endDate: '2024-12-31'
    },
    newYear: {
      active: false,
      bonusCredits: 10,
      startDate: '2025-01-01',
      endDate: '2025-01-07'
    }
  }
};

// Calculate user's loyalty tier
const getUserLoyaltyTier = async (userId) => {
  try {
    const supabase = getSupabase();

    // Get total credits purchased by user
    const { data: payments } = await supabase
      .from('payments_history')
      .select('metadata')
      .eq('user_id', userId)
      .eq('type', 'credits')
      .eq('status', 'succeeded');

    let totalCreditsPurchased = 0;
    if (payments) {
      payments.forEach(payment => {
        if (payment.metadata?.credits) {
          totalCreditsPurchased += parseInt(payment.metadata.credits);
        }
      });
    }

    // Determine tier
    const tiers = DYNAMIC_CREDIT_CONFIG.loyaltyTiers;
    if (totalCreditsPurchased >= tiers.platinum.threshold) return 'platinum';
    if (totalCreditsPurchased >= tiers.gold.threshold) return 'gold';
    if (totalCreditsPurchased >= tiers.silver.threshold) return 'silver';
    return 'bronze';

  } catch (error) {
    console.log('Error calculating loyalty tier:', error);
    return 'bronze';
  }
};

// Calculate user's subscription multiplier
const getUserSubscriptionMultiplier = async (userId) => {
  try {
    const supabase = getSupabase();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subscription?.plan) {
      return DYNAMIC_CREDIT_CONFIG.subscriptionMultipliers[subscription.plan] || 1.0;
    }

    return 1.0;
  } catch (error) {
    console.log('Error getting subscription multiplier:', error);
    return 1.0;
  }
};

// Calculate dynamic pricing for user
const calculateDynamicPricing = async (userId, basePrice, credits) => {
  try {
    const supabase = getSupabase();

    // Check if new user
    const { data: payments } = await supabase
      .from('payments_history')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'credits')
      .limit(1);

    const isNewUser = !payments || payments.length === 0;

    // Check dream count for frequent user discount
    const { count: dreamCount } = await supabase
      .from('dreams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false);

    let discount = 1.0; // No discount by default

    // Apply new user discount
    if (isNewUser) {
      discount *= DYNAMIC_CREDIT_CONFIG.dynamicPricing.newUserDiscount;
    }

    // Apply bulk discount
    if (credits >= DYNAMIC_CREDIT_CONFIG.dynamicPricing.bulkDiscount.threshold) {
      discount *= DYNAMIC_CREDIT_CONFIG.dynamicPricing.bulkDiscount.discount;
    }

    // Apply frequent user discount
    if (dreamCount >= DYNAMIC_CREDIT_CONFIG.dynamicPricing.frequentUserDiscount.threshold) {
      discount *= DYNAMIC_CREDIT_CONFIG.dynamicPricing.frequentUserDiscount.discount;
    }

    return Math.round(basePrice * discount);

  } catch (error) {
    console.log('Error calculating dynamic pricing:', error);
    return basePrice;
  }
};

// Calculate welcome bonus credits for user
const calculateWelcomeBonus = async (userId) => {
  try {
    const supabase = getSupabase();

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) return 0;

    let bonusCredits = 0;
    const bonuses = DYNAMIC_CREDIT_CONFIG.welcomeBonuses;

    // Check profile completion
    if (profile.display_name && profile.display_name !== profile.email?.split('@')[0]) {
      bonusCredits += bonuses.newUser;
    }

    // Check email verification (assuming we have this info)
    if (profile.email_verified) {
      bonusCredits += bonuses.emailVerified;
    }

    // Check if user has dreams
    const { count: dreamCount } = await supabase
      .from('dreams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false);

    if (dreamCount > 0) {
      bonusCredits += bonuses.firstDream;
    }

    // Check profile completeness
    const requiredFields = ['display_name', 'locale', 'preferences'];
    const completedFields = requiredFields.filter(field => profile[field]);
    if (completedFields.length === requiredFields.length) {
      bonusCredits += bonuses.profileComplete;
    }

    return bonusCredits;

  } catch (error) {
    console.log('Error calculating welcome bonus:', error);
    return 0;
  }
};

// Calculate behavioral bonuses
const calculateBehavioralBonus = async (userId) => {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let bonusCredits = 0;
    const bonuses = DYNAMIC_CREDIT_CONFIG.behavioralBonuses;

    // Check weekly dream activity
    const { count: weeklyDreams } = await supabase
      .from('dreams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('created_at', oneWeekAgo.toISOString());

    if (weeklyDreams >= 5) {
      bonusCredits += bonuses.weeklyDreams;
    }

    // Check monthly activity
    const { count: monthlyDreams } = await supabase
      .from('dreams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('created_at', oneMonthAgo.toISOString());

    if (monthlyDreams >= 10) {
      bonusCredits += bonuses.monthlyActive;
    }

    // Daily login streak (simplified - would need login tracking)
    // This is a placeholder for more complex streak calculation
    const dailyLoginBonus = Math.min(7, Math.floor(monthlyDreams / 4));
    bonusCredits += dailyLoginBonus;

    return bonusCredits;

  } catch (error) {
    console.log('Error calculating behavioral bonus:', error);
    return 0;
  }
};

// Get total dynamic credits for user
const getTotalDynamicCredits = async (userId) => {
  try {
    const [welcomeBonus, behavioralBonus, loyaltyTier, subscriptionMultiplier] = await Promise.all([
      calculateWelcomeBonus(userId),
      calculateBehavioralBonus(userId),
      getUserLoyaltyTier(userId),
      getUserSubscriptionMultiplier(userId)
    ]);

    const loyaltyMultiplier = DYNAMIC_CREDIT_CONFIG.loyaltyTiers[loyaltyTier].multiplier;

    return {
      welcomeBonus,
      behavioralBonus,
      totalBonus: Math.round((welcomeBonus + behavioralBonus) * loyaltyMultiplier * subscriptionMultiplier),
      loyaltyTier,
      subscriptionMultiplier,
      loyaltyMultiplier
    };

  } catch (error) {
    console.log('Error calculating total dynamic credits:', error);
    return {
      welcomeBonus: 0,
      behavioralBonus: 0,
      totalBonus: 0,
      loyaltyTier: 'bronze',
      subscriptionMultiplier: 1.0,
      loyaltyMultiplier: 1.0
    };
  }
};

// Apply dynamic credits to user (call this when user logs in or performs actions)
const applyDynamicCredits = async (userId) => {
  try {
    const supabase = getSupabase();

    // Get current dynamic credits info
    const dynamicCredits = await getTotalDynamicCredits(userId);

    // Check if we've already applied these bonuses
    const { data: existingBonus } = await supabase
      .from('credit_bonuses')
      .select('total_bonus, applied_at')
      .eq('user_id', userId)
      .single();

    if (existingBonus) {
      // Only apply if bonuses have increased
      if (dynamicCredits.totalBonus > existingBonus.total_bonus) {
        const additionalBonus = dynamicCredits.totalBonus - existingBonus.total_bonus;

        // Update credits
        await updateUserCredits(userId, additionalBonus, 'add');

        // Update bonus record
        await supabase
          .from('credit_bonuses')
          .update({
            total_bonus: dynamicCredits.totalBonus,
            welcome_bonus: dynamicCredits.welcomeBonus,
            behavioral_bonus: dynamicCredits.behavioralBonus,
            loyalty_tier: dynamicCredits.loyaltyTier,
            subscription_multiplier: dynamicCredits.subscriptionMultiplier,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        return {
          creditsAdded: additionalBonus,
          reason: 'bonus_update'
        };
      }
    } else {
      // First time applying bonuses
      await updateUserCredits(userId, dynamicCredits.totalBonus, 'add');

      // Create bonus record
      await supabase
        .from('credit_bonuses')
        .insert([{
          user_id: userId,
          total_bonus: dynamicCredits.totalBonus,
          welcome_bonus: dynamicCredits.welcomeBonus,
          behavioral_bonus: dynamicCredits.behavioralBonus,
          loyalty_tier: dynamicCredits.loyaltyTier,
          subscription_multiplier: dynamicCredits.subscriptionMultiplier,
          applied_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }]);

      return {
        creditsAdded: dynamicCredits.totalBonus,
        reason: 'initial_bonus'
      };
    }

    return {
      creditsAdded: 0,
      reason: 'no_change'
    };

  } catch (error) {
    console.log('Error applying dynamic credits:', error);
    return {
      creditsAdded: 0,
      reason: 'error'
    };
  }
};

// Import updateUserCredits function
const { updateUserCredits } = require('./supabase');

module.exports = {
  DYNAMIC_CREDIT_CONFIG,
  getUserLoyaltyTier,
  getUserSubscriptionMultiplier,
  calculateDynamicPricing,
  calculateWelcomeBonus,
  calculateBehavioralBonus,
  getTotalDynamicCredits,
  applyDynamicCredits
};
