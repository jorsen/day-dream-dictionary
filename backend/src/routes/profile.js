const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { User, Dream, Payment, Event } = require('../models');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/logger');
const { logger } = require('../config/mongodb');

// Get user profile
router.get('/', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    
    if (!user || user.isDeleted) {
      throw new AppError('User not found', 404);
    }

    // Get dream count
    const dreamCount = await Dream.countDocuments({ userId, isDeleted: false });

    // Build subscription details
    let enhancedSubscription = null;
    if (user.subscription) {
      enhancedSubscription = {
        plan: user.subscription.plan,
        planName: user.subscription.plan === 'basic' ? 'Basic Plan' : 
                  user.subscription.plan === 'pro' ? 'Pro Plan' : 'Free Plan',
        planType: user.subscription.plan,
        status: user.subscription.status,
        currentPeriodStart: user.subscription.currentPeriodStart,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
        stripeCustomerId: user.subscription.stripeCustomerId,
        stripeSubscriptionId: user.subscription.stripeSubscriptionId
      };
    }

    res.json({
      profile: {
        id: user._id,
        email: user.email,
        display_name: user.displayName,
        locale: user.locale,
        preferences: user.preferences,
        emailVerified: user.emailVerified,
        credits: user.credits,
        subscription: enhancedSubscription,
        role: user.role,
        stats: {
          totalDreams: dreamCount
        },
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    });

  } catch (error) {
    logger.error('Error fetching profile:', error);
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
    if (req.body.displayName) updates.displayName = req.body.displayName;
    if (req.body.locale) updates.locale = req.body.locale;
    if (req.body.preferences) {
      const user = await User.findById(userId);
      updates.preferences = {
        ...user?.preferences,
        ...req.body.preferences
      };
    }
    
    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        { new: true }
      );
      
      if (!updatedUser) {
        throw new AppError('User not found', 404);
      }
      
      // Track event
      try {
        await Event.trackEvent(userId, 'profile_updated', {
          fields: Object.keys(updates)
        });
        
        if (req.body.locale) {
          await Event.trackEvent(userId, 'language_changed', {
            to: req.body.locale
          });
        }
        
        if (req.body.preferences?.theme) {
          await Event.trackEvent(userId, 'theme_changed', {
            theme: req.body.preferences.theme
          });
        }
      } catch (eventError) {
        logger.warn('Event tracking failed:', eventError.message);
      }
      
      auditLog('profile_updated', userId, updates);
      
      res.json({
        message: 'Profile updated successfully',
        profile: updatedUser.toSafeObject()
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
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid password', 401);
    }
    
    // Soft delete all dreams
    await Dream.updateMany(
      { userId },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );
    
    // Anonymize events
    await Event.anonymizeUserEvents(userId);
    
    // Soft delete user
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.email = `deleted_${user._id}@deleted.com`;
    await user.save();
    
    // Track event
    try {
      await Event.trackEvent('deleted_user', 'account_deleted', {
        userId: userId.toString(),
        timestamp: new Date().toISOString()
      });
    } catch (eventError) {
      logger.warn('Event tracking failed:', eventError.message);
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
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Get dreams
    const dreams = await Dream.find({ userId, isDeleted: false }).lean();
    
    // Get payments
    const payments = await Payment.find({ userId }).lean();
    
    // Get events
    const events = await Event.findEvents({ userId }, { limit: 1000 });
    
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        locale: user.locale,
        role: user.role,
        createdAt: user.createdAt
      },
      preferences: user.preferences,
      subscription: user.subscription,
      credits: user.credits,
      payments: payments.map(p => ({
        id: p._id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        type: p.type,
        createdAt: p.createdAt
      })),
      dreams: dreams.map(dream => ({
        id: dream._id,
        text: dream.dreamText,
        interpretation: dream.interpretation,
        tags: dream.tags,
        createdAt: dream.createdAt
      })),
      eventsCount: events.length,
      events: events.slice(0, 100)
    };
    
    // Track event
    try {
      await Event.trackEvent(userId, 'data_exported', {
        format: 'json'
      });
    } catch (eventError) {
      logger.warn('Event tracking failed:', eventError.message);
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
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      credits: user.credits,
      lifetimeCreditsEarned: user.lifetimeCreditsEarned
    });

  } catch (error) {
    next(error);
  }
}));

// Get user preferences
router.get('/preferences', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      preferences: user.preferences || {
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
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      const preferences = user.preferences || {};
      preferences[key] = value;
      
      user.preferences = preferences;
      await user.save();
      
      // Track event
      try {
        await Event.trackEvent(userId, 'preferences_updated', {
          key,
          value
        });
      } catch (eventError) {
        logger.warn('Event tracking failed:', eventError.message);
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
        startDate.setFullYear(2020);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }
    
    // Get dream statistics
    const dreams = await Dream.find({
      userId,
      isDeleted: false,
      createdAt: { $gte: startDate, $lte: endDate }
    }).lean();
    
    let dreamStats = {
      totalDreams: dreams.length,
      recurringDreams: dreams.filter(d => d.isRecurring).length,
      averageLength: 0,
      mostCommonThemes: [],
      totalSymbols: []
    };
    
    if (dreams.length > 0) {
      const totalLength = dreams.reduce((sum, d) => sum + (d.dreamText?.length || 0), 0);
      dreamStats.averageLength = totalLength / dreams.length;
      
      // Collect themes
      const themeCount = {};
      dreams.forEach(dream => {
        if (dream.interpretation?.mainThemes) {
          dream.interpretation.mainThemes.forEach(theme => {
            themeCount[theme] = (themeCount[theme] || 0) + 1;
          });
        }
      });
      
      // Get top themes
      const topThemes = Object.entries(themeCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme, count]) => ({ theme, count }));
        
      dreamStats.mostCommonThemes = topThemes;
    }
    
    // Get activity statistics
    const activityStats = await Event.getUserActivityStats(userId, startDate, endDate);
    
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
      topThemes: dreamStats.mostCommonThemes,
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
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      const preferences = user.preferences || {};
      
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
      
      user.preferences = preferences;
      await user.save();
      
      // Track event
      try {
        await Event.trackEvent(userId, 'notification_settings_updated', {
          email,
          push
        });
      } catch (eventError) {
        logger.warn('Event tracking failed:', eventError.message);
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
