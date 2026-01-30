const { User, Dream, Event } = require('../models');
const { AppError, catchAsync } = require('./errorHandler');
const { logger } = require('../config/mongodb');

// Check user's quota for dream interpretations
const checkQuota = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { interpretationType = 'basic' } = req.body;
  
  // Get user from MongoDB
  const user = await User.findById(userId);
  
  // If user has active subscription, no quota limits apply
  if (user?.subscription?.status === 'active' && user?.subscription?.plan !== 'free') {
    req.quotaInfo = {
      hasSubscription: true,
      subscriptionTier: user.subscription.plan,
      quotaRemaining: 'unlimited'
    };
    return next();
  }
  
  // Check credits for non-subscribed users
  const credits = user?.credits || 0;
  
  // Calculate credits needed
  let creditsNeeded = 1;
  if (interpretationType === 'deep') creditsNeeded = 3;
  if (interpretationType === 'premium') creditsNeeded = 5;
  
  // Check if user has enough credits
  if (credits < creditsNeeded) {
    // Check free tier quota
    const freeQuotaRemaining = await checkFreeQuota(userId);
    
    if (freeQuotaRemaining <= 0) {
      // Track paywall view event
      try {
        await Event.trackEvent(userId, 'paywall_view', {
          reason: 'quota_exceeded',
          interpretationType,
          creditsNeeded,
          creditsAvailable: credits
        });
      } catch (error) {
        logger.warn('Event tracking failed:', error.message);
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
    // Count deep interpretations from MongoDB
    const deepInterpretations = await Dream.countDocuments({
      userId,
      createdAt: { $gte: startOfMonth },
      'metadata.interpretationType': 'deep',
      isDeleted: false
    });
    
    const freeDeepLimit = parseInt(process.env.FREE_DEEP_INTERPRETATIONS_MONTHLY) || 3;
    const remainingDeep = Math.max(0, freeDeepLimit - deepInterpretations);
    
    return remainingDeep;
  } catch (error) {
    logger.warn('Could not check quota from database:', error.message);
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
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Get user
  const user = await User.findById(userId);
  
  let monthlyCount = 0, weeklyCount = 0, todayCount = 0;
  let typeBreakdown = {};
  
  try {
    // Get counts from MongoDB
    const [monthly, weekly, today] = await Promise.all([
      Dream.countDocuments({
        userId,
        createdAt: { $gte: startOfMonth },
        isDeleted: false
      }),
      Dream.countDocuments({
        userId,
        createdAt: { $gte: startOfWeek },
        isDeleted: false
      }),
      Dream.countDocuments({
        userId,
        createdAt: { $gte: startOfDay },
        isDeleted: false
      })
    ]);
    
    monthlyCount = monthly;
    weeklyCount = weekly;
    todayCount = today;
    
    // Get type breakdown
    const dreams = await Dream.find({
      userId,
      createdAt: { $gte: startOfMonth },
      isDeleted: false
    }).select('metadata.interpretationType').lean();
    
    dreams.forEach(dream => {
      const type = dream.metadata?.interpretationType || 'basic';
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    });
  } catch (error) {
    logger.warn('Could not get usage stats from database:', error.message);
  }
  
  const stats = {
    subscription: user?.subscription ? {
      plan: user.subscription.plan,
      status: user.subscription.status,
      currentPeriodEnd: user.subscription.currentPeriodEnd
    } : null,
    credits: user?.credits || 0,
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
    
    // Get user
    const user = await User.findById(userId);
    
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
    
    if (!user?.subscription || user.subscription.status !== 'active' || user.subscription.plan === 'free') {
      // Track paywall view
      try {
        await Event.trackEvent(userId, 'paywall_view', {
          reason: 'premium_feature',
          feature,
          requiredPlans
        });
      } catch (error) {
        logger.warn('Event tracking failed:', error.message);
      }
      
      throw new AppError(
        `This feature requires a ${requiredPlans.join(' or ')} subscription.`,
        402,
        true
      );
    }
    
    if (!requiredPlans.includes(user.subscription.plan)) {
      throw new AppError(
        `This feature requires a ${requiredPlans.join(' or ')} subscription. Your current plan is ${user.subscription.plan}.`,
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
  
  // Track API usage event
  try {
    await Event.trackEvent(userId, 'api_usage', {
      endpoint,
      method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  } catch (error) {
    logger.warn('API usage tracking failed:', error.message);
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
      usageToday = await Event.countEvents({
        userId,
        type: feature,
        createdAt: { $gte: today }
      });
    } catch (error) {
      logger.warn('Could not check daily limit:', error.message);
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
