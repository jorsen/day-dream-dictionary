const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  getUserProfile,
  updateUserProfile,
  getUserCredits,
  getUserSubscription,
  getSupabase,
  createUserProfile,
  checkUserRole
} = require('../config/supabase');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/logger');

// Get user profile
router.get('/', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    // Get user profile from Supabase
    const profile = await getUserProfile(userId);

    // Get user credits
    const credits = await getUserCredits(userId);

    // Get user subscription
    const subscription = await getUserSubscription(userId);

    // Get user role
    const role = await checkUserRole(userId);

    // Get basic stats
    const { data: dreams } = await getSupabase()
      .from('dreams')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_deleted', false);

    // Safely extract user information
    const userEmail = req.user?.email || 'user@example.com';
    const emailParts = userEmail.split('@');
    const defaultDisplayName = emailParts.length > 0 ? emailParts[0] : 'User';

    // Add complete subscription details
    let enhancedSubscription = subscription;
    if (subscription) {
      enhancedSubscription = {
        ...subscription,
        // Add plan details
        planName: subscription.plan === 'basic' ? 'Basic Plan' : 
                   subscription.plan === 'pro' ? 'Pro Plan' : 'Free Plan',
        planType: subscription.plan === 'basic' ? 'basic' : 
                   subscription.plan === 'pro' ? 'pro' : 'free',
        status: subscription.status || 'active',
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        monthlyPrice: subscription.amount || 0,
        currency: subscription.currency || 'usd',
        // Add limits if available
        monthlyLimits: subscription.monthly_limits || {
          basic: subscription.monthly_limits?.basic || 20,
          deep: subscription.monthly_limits?.deep || 5
        },
        // Add usage if available
        monthlyUsage: subscription.monthly_usage || {
          basic: subscription.monthly_usage?.basic || 0,
          deep: subscription.monthly_usage?.deep || 0
        },
        // Add features if available
        features: subscription.features || []
      };
    }

    res.json({
      profile: {
        id: userId,
        email: userEmail,
        display_name: profile?.display_name || defaultDisplayName,
        locale: profile?.locale || 'en',
        preferences: profile?.preferences || {
          emailNotifications: true,
          pushNotifications: false,
          theme: 'light',
          dreamPrivacy: 'private',
          dreamStorage: true
        },
        emailVerified: req.user?.emailVerified || false,
        credits: credits,
        subscription: enhancedSubscription,
        role: role,
        stats: {
          totalDreams: dreams?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    next(error);
  }
}));

// Update profile
router.put('/', 
  authenticate,
  [
    body('displayName').optional().trim().isLength({ min: 2, max: 50 }),
    body('locale').optional().isIn(['en', 'es']),
    body('preferences').optional().isObject(),
    body('preferences.emailNotifications').optional().isBoolean(),
    body('preferences.pushNotifications').optional().isBoolean(),
    body('preferences.theme').optional().isIn(['light', 'dark', 'auto']),
    body('preferences.dreamPrivacy').optional().isIn(['private', 'anonymous', 'public']),
    body('preferences.dreamStorage').optional().isBoolean()
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const updates = {};
    
    // Build update object
    if (req.body.displayName) updates.display_name = req.body.displayName;
    if (req.body.locale) updates.locale = req.body.locale;
    if (req.body.preferences) {
      const currentProfile = await getUserProfile(userId);
      updates.preferences = {
        ...currentProfile?.preferences,
        ...req.body.preferences
      };
    }
    
    try {
      // Update profile
      const updatedProfile = await updateUserProfile(userId, updates);
      
      // Track event (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(userId, 'profile_updated', {
          fields: Object.keys(updates)
        });
        
        // Track language change if applicable
        if (req.body.locale) {
          await Event.trackEvent(userId, 'language_changed', {
            from: req.user.locale,
            to: req.body.locale
          });
        }
        
        // Track theme change if applicable
        if (req.body.preferences?.theme) {
          await Event.trackEvent(userId, 'theme_changed', {
            theme: req.body.preferences.theme
          });
        }
      } catch (error) {
        console.log('Event tracking skipped');
      }
      
      auditLog('profile_updated', userId, updates);
      
      res.json({
        message: 'Profile updated successfully',
        profile: updatedProfile
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Delete account
router.delete('/account', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { confirmDelete, password } = req.body;
  
  if (!confirmDelete || confirmDelete !== 'DELETE') {
    throw new AppError('Please confirm account deletion by sending confirmDelete: "DELETE"', 400);
  }
  
  try {
    const supabase = getSupabase();
    
    // Verify password
    const { error: authError } = await getSupabase().auth.signInWithPassword({
      email: req.user.email,
      password
    });
    
    if (authError) {
      throw new AppError('Invalid password', 401);
    }
    
    // Cancel any active subscriptions
    const subscription = await getUserSubscription(userId);
    if (subscription?.stripe_subscription_id) {
      // This would trigger the webhook to handle the cancellation
      // You'd need to call Stripe API here
    }
    
    // Soft delete all dreams in Supabase
    try {
      await getSupabase()
        .from('dreams')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('user_id', userId);
    } catch (error) {
      console.log('Could not delete dreams');
    }
    
    // Anonymize events (optional - skip if MongoDB not available)
    try {
      const Event = require('../models/Event');
      await Event.updateMany(
        { userId },
        { userId: 'deleted_user' }
      );
    } catch (error) {
      console.log('Could not anonymize events');
    }
    
    // Delete profile
    await getSupabase()
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    // Delete user from auth
    const { error: deleteError } = await getSupabase().auth.admin.deleteUser(userId);
    
    if (deleteError) {
      throw new AppError('Failed to delete account', 500);
    }
    
    // Track event (optional - skip if MongoDB not available)
    try {
      const Event = require('../models/Event');
      await Event.trackEvent('deleted_user', 'account_deleted', {
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('Event tracking skipped');
    }
    
    auditLog('account_deleted', userId, {});
    
    res.json({
      message: 'Account deleted successfully'
    });
    
  } catch (error) {
    next(error);
  }
}));

// Export user data (GDPR compliance)
router.get('/export', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const supabase = getSupabase();
    
    // Gather all user data
    const profile = await getUserProfile(userId);
    const subscription = await getUserSubscription(userId);
    
    // Get dreams from Supabase
    const { data: dreams } = await getSupabase()
      .from('dreams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    // Get payments
    const { data: payments } = await getSupabase()
      .from('payments_history')
      .select('*')
      .eq('user_id', userId);
    
    // Get events (optional - skip if MongoDB not available)
    let events = [];
    try {
      const Event = require('../models/Event');
      events = await Event.find({ userId }).limit(1000).lean();
    } catch (error) {
      console.log('Could not export events');
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: userId,
        email: req.user.email,
        emailVerified: req.user.emailVerified
      },
      profile,
      subscription,
      payments: payments || [],
      dreams: (dreams || []).map(dream => ({
        id: dream.id,
        text: dream.dream_text,
        interpretation: dream.interpretation,
        tags: dream.tags,
        createdAt: dream.created_at
      })),
      eventsCount: events.length,
      events: events.slice(0, 100) // Limit events for performance
    };
    
    // Track event (optional - skip if MongoDB not available)
    try {
      const Event = require('../models/Event');
      await Event.trackEvent(userId, 'data_exported', {
        format: 'json'
      });
    } catch (error) {
      console.log('Event tracking skipped');
    }
    
    auditLog('data_exported', userId, {});
    
    res.json(exportData);
    
  } catch (error) {
    next(error);
  }
}));

// Get user credits
router.get('/credits', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const credits = await getUserCredits(userId);

    res.json({
      credits: credits
    });

  } catch (error) {
    next(error);
  }
}));

// Get user preferences
router.get('/preferences', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const profile = await getUserProfile(userId);

    res.json({
      preferences: profile?.preferences || {
        emailNotifications: true,
        pushNotifications: false,
        theme: 'light',
        dreamPrivacy: 'private',
        dreamStorage: true
      }
    });

  } catch (error) {
    next(error);
  }
}));

// Update specific preference
router.patch('/preferences/:key', 
  authenticate,
  catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const { key } = req.params;
    const { value } = req.body;
    
    const allowedKeys = [
      'emailNotifications',
      'pushNotifications',
      'theme',
      'dreamPrivacy',
      'dreamStorage',
      'reminderTime',
      'reminderFrequency'
    ];
    
    if (!allowedKeys.includes(key)) {
      throw new AppError('Invalid preference key', 400);
    }
    
    try {
      const profile = await getUserProfile(userId);
      const preferences = profile?.preferences || {};
      preferences[key] = value;
      
      await updateUserProfile(userId, { preferences });
      
      // Track event (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(userId, 'preferences_updated', {
          key,
          value
        });
      } catch (error) {
        console.log('Event tracking skipped');
      }
      
      res.json({
        message: 'Preference updated successfully',
        preferences
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Get user statistics
router.get('/stats', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { period = '30d' } = req.query;
  
  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case 'all':
        startDate.setFullYear(2020); // Set to a very old date
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    // Get dream statistics from Supabase
    const { data: dreams } = await getSupabase()
      .from('dreams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    // Calculate statistics
    let dreamStats = {
      totalDreams: 0,
      recurringDreams: 0,
      averageLength: 0,
      mostCommonThemes: [],
      mostCommonEmotions: [],
      totalSymbols: []
    };
    
    if (dreams && dreams.length > 0) {
      dreamStats.totalDreams = dreams.length;
      dreamStats.recurringDreams = dreams.filter(d => d.is_recurring).length;
      
      // Calculate average length
      const totalLength = dreams.reduce((sum, d) => sum + (d.dream_text?.length || 0), 0);
      dreamStats.averageLength = totalLength / dreams.length;
      
      // Collect themes and emotions
      dreams.forEach(dream => {
        if (dream.interpretation) {
          if (dream.interpretation.mainThemes) {
            dreamStats.mostCommonThemes.push(...dream.interpretation.mainThemes);
          }
          if (dream.interpretation.emotionalTone) {
            dreamStats.mostCommonEmotions.push(dream.interpretation.emotionalTone);
          }
          if (dream.interpretation.symbols) {
            dreamStats.totalSymbols.push(...dream.interpretation.symbols);
          }
        }
      });
    }
    
    // Get activity statistics (optional - skip if MongoDB not available)
    let activityStats = [];
    try {
      const Event = require('../models/Event');
      activityStats = await Event.aggregate([
        {
          $match: {
            userId,
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
    } catch (error) {
      console.log('Could not get activity stats');
    }
    
    // Process theme frequency
    const themeFrequency = {};
    dreamStats.mostCommonThemes.forEach(theme => {
      themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
    });
    
    // Get top themes
    const topThemes = Object.entries(themeFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
    
    res.json({
      period,
      dateRange: {
        start: startDate,
        end: endDate
      },
      dreams: {
        totalDreams: dreamStats.totalDreams,
        recurringDreams: dreamStats.recurringDreams,
        averageLength: dreamStats.averageLength
      },
      topThemes,
      activity: activityStats,
      engagement: {
        daysActive: activityStats.length,
        averageDailyActivity: activityStats.length > 0 
          ? activityStats.reduce((sum, day) => sum + day.count, 0) / activityStats.length 
          : 0
      }
    });
    
  } catch (error) {
    next(error);
  }
}));

// Update notification settings
router.put('/notifications',
  authenticate,
  [
    body('email').optional().isObject(),
    body('email.dreamReminders').optional().isBoolean(),
    body('email.weeklyDigest').optional().isBoolean(),
    body('email.promotions').optional().isBoolean(),
    body('push').optional().isObject(),
    body('push.enabled').optional().isBoolean(),
    body('push.dreamReminders').optional().isBoolean()
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { email, push } = req.body;
    
    try {
      const profile = await getUserProfile(userId);
      const preferences = profile?.preferences || {};
      
      if (email) {
        preferences.emailNotifications = {
          ...preferences.emailNotifications,
          ...email
        };
      }
      
      if (push) {
        preferences.pushNotifications = {
          ...preferences.pushNotifications,
          ...push
        };
      }
      
      await updateUserProfile(userId, { preferences });
      
      // Track event (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(userId, 'notification_settings_updated', {
          email,
          push
        });
      } catch (error) {
        console.log('Event tracking skipped');
      }
      
      res.json({
        message: 'Notification settings updated successfully',
        preferences
      });
      
    } catch (error) {
      next(error);
    }
  })
);

module.exports = router;
