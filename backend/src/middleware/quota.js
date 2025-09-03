const { getUserSubscription, getUserCredits, supabase } = require('../config/supabase');
const { AppError, catchAsync } = require('./errorHandler');

// Check user's quota for dream interpretations
const checkQuota = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { interpretationType = 'basic' } = req.body;
  
  // Get user's subscription status
  const subscription = await getUserSubscription(userId);
  
  // If user has active subscription, no quota limits apply
  if (subscription && subscription.status === 'active') {
    req.quotaInfo = {
      hasSubscription: true,
      subscriptionTier: subscription.plan,
      quotaRemaining: 'unlimited'
    };
    return next();
  }
  
  // Check credits for non-subscribed users
  const credits = await getUserCredits(userId);
  
  // Calculate credits needed
  let creditsNeeded = 1;
  if (interpretationType === 'deep') creditsNeeded = 3;
  if (interpretationType === 'premium') creditsNeeded = 5;
  
  // Check if user has enough credits
  if (credits < creditsNeeded) {
    // Check free tier quota
    const freeQuotaRemaining = await checkFreeQuota(userId);
    
    if (freeQuotaRemaining <= 0) {
      // Track paywall view event (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(userId, 'paywall_view', {
          reason: 'quota_exceeded',
          interpretationType,
          creditsNeeded,
          creditsAvailable: credits
        });
      } catch (error) {
        console.log('Event tracking skipped');
      }
      
      throw new AppError(
        'You have reached your free interpretation limit. Please purchase credits or subscribe to continue.',
        402,
        true
      );
    }
    
    // User can use free quota
    req.quotaInfo = {
      hasSubscription: false,
      usingFreeQuota: true,
      freeQuotaRemaining: freeQuotaRemaining - 1,
      credits: credits
    };
  } else {
    // User has enough credits
    req.quotaInfo = {
      hasSubscription: false,
      usingFreeQuota: false,
      credits: credits,
      creditsAfter: credits - creditsNeeded
    };
  }
  
  next();
});

// Check free tier quota
const checkFreeQuota = async (userId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  try {
    // Try to count deep interpretations from Supabase
    const { data, error, count } = await supabase
      .from('dreams')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .eq('metadata->>interpretationType', 'deep')
      .eq('is_deleted', false);
    
    const deepInterpretations = count || 0;
    const freeDeepLimit = parseInt(process.env.FREE_DEEP_INTERPRETATIONS_MONTHLY) || 3;
    const remainingDeep = Math.max(0, freeDeepLimit - deepInterpretations);
    
    return remainingDeep;
  } catch (error) {
    console.log('Could not check quota from database, using default limits');
    // If database is not available, return default limit
    const freeDeepLimit = parseInt(process.env.FREE_DEEP_INTERPRETATIONS_MONTHLY) || 3;
    return freeDeepLimit;
  }
};

// Get user's usage statistics
const getUserUsageStats = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Get subscription
  const subscription = await getUserSubscription(userId);
  
  // Get credits
  const credits = await getUserCredits(userId);
  
  let monthlyCount = 0, weeklyCount = 0, todayCount = 0;
  let typeBreakdown = {};
  
  try {
    // Try to get counts from Supabase
    const [monthlyResult, weeklyResult, todayResult] = await Promise.all([
      supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .eq('is_deleted', false),
      supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfWeek.toISOString())
        .eq('is_deleted', false),
      supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
        .eq('is_deleted', false)
    ]);
    
    monthlyCount = monthlyResult.count || 0;
    weeklyCount = weeklyResult.count || 0;
    todayCount = todayResult.count || 0;
    
    // Get type breakdown
    const { data: dreams } = await supabase
      .from('dreams')
      .select('metadata')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .eq('is_deleted', false);
    
    if (dreams) {
      dreams.forEach(dream => {
        const type = dream.metadata?.interpretationType || 'basic';
        typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
      });
    }
  } catch (error) {
    console.log('Could not get usage stats from database');
  }
  
  const stats = {
    subscription: subscription ? {
      plan: subscription.plan_type,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
    } : null,
    credits,
    usage: {
      monthly: monthlyCount,
      weekly: weeklyCount,
      today: todayCount,
      byType: typeBreakdown
    },
    limits: {
      freeDeepMonthly: parseInt(process.env.FREE_DEEP_INTERPRETATIONS_MONTHLY) || 3,
      freeBasicMonthly: parseInt(process.env.FREE_BASIC_INTERPRETATIONS_MONTHLY) || 5
    }
  };
  
  req.usageStats = stats;
  next();
});

// Check if user can access premium features
const requirePremiumFeature = (feature) => {
  return catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    
    // Get subscription
    const subscription = await getUserSubscription(userId);
    
    // Define feature requirements
    const featureRequirements = {
      'pdf_export': ['basic', 'pro'],
      'voice_journaling': ['pro'],
      'timeline_analytics': ['pro'],
      'symbol_encyclopedia_advanced': ['basic', 'pro'],
      'recurring_dream_analysis': ['pro'],
      'life_season_report': ['pro'],
      'couples_report': ['pro']
    };
    
    const requiredPlans = featureRequirements[feature];
    
    if (!requiredPlans) {
      // Feature doesn't require premium
      return next();
    }
    
    if (!subscription || subscription.status !== 'active') {
      // Track paywall view (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(userId, 'paywall_view', {
          reason: 'premium_feature',
          feature,
          requiredPlans
        });
      } catch (error) {
        console.log('Event tracking skipped');
      }
      
      throw new AppError(
        `This feature requires a ${requiredPlans.join(' or ')} subscription.`,
        402,
        true
      );
    }
    
    if (!requiredPlans.includes(subscription.plan)) {
      throw new AppError(
        `This feature requires a ${requiredPlans.join(' or ')} subscription. Your current plan is ${subscription.plan}.`,
        402,
        true
      );
    }
    
    next();
  });
};

// Track API usage for rate limiting and billing
const trackApiUsage = catchAsync(async (req, res, next) => {
  const userId = req.user?.id || req.apiKey;
  const endpoint = req.originalUrl;
  const method = req.method;
  
  // Track API usage event (optional - skip if MongoDB not available)
  try {
    const Event = require('../models/Event');
    await Event.trackEvent(userId, 'api_usage', {
      endpoint,
      method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  } catch (error) {
    console.log('API usage tracking skipped');
  }
  
  next();
});

// Enforce daily limits for specific features
const enforceDailyLimit = (feature, limit) => {
  return catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let usageToday = 0;
    
    try {
      // Try to count feature usage from MongoDB
      const Event = require('../models/Event');
      usageToday = await Event.countDocuments({
        userId,
        type: feature,
        createdAt: { $gte: today }
      });
    } catch (error) {
      console.log('Could not check daily limit, allowing request');
      // If MongoDB is not available, allow the request
      return next();
    }
    
    if (usageToday >= limit) {
      throw new AppError(
        `Daily limit reached for ${feature}. Maximum ${limit} per day.`,
        429,
        true
      );
    }
    
    next();
  });
};

module.exports = {
  checkQuota,
  checkFreeQuota,
  getUserUsageStats,
  requirePremiumFeature,
  trackApiUsage,
  enforceDailyLimit
};