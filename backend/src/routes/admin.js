const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { User, Dream, Payment, Event } = require('../models');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/logger');
const { logger } = require('../config/mongodb');
const Stripe = require('stripe');

let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  logger.warn('Stripe not initialized:', error.message);
}

// Get dashboard statistics
router.get('/dashboard', catchAsync(async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get user statistics
    const [totalUsers, activeSubscriptions] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ 
        'subscription.status': 'active', 
        'subscription.plan': { $ne: 'free' },
        isDeleted: false 
      })
    ]);
    
    // Get payment statistics
    const monthlyPayments = await Payment.find({
      createdAt: { $gte: startOfMonth },
      status: 'succeeded'
    }).lean();
    
    const totalMonthlyRevenue = monthlyPayments.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    
    // Get dream statistics
    const [totalDreams, monthlyDreams] = await Promise.all([
      Dream.countDocuments({ isDeleted: false }),
      Dream.countDocuments({ createdAt: { $gte: startOfMonth }, isDeleted: false })
    ]);
    
    // Get event statistics for engagement
    let dailyActiveUsers = [], weeklyActiveUsers = [], monthlyActiveUsers = [];
    try {
      dailyActiveUsers = await Event.getDistinctUsers(startOfDay, now);
      weeklyActiveUsers = await Event.getDistinctUsers(startOfWeek, now);
      monthlyActiveUsers = await Event.getDistinctUsers(startOfMonth, now);
    } catch (error) {
      logger.warn('Could not get event statistics:', error.message);
    }
    
    res.json({
      users: {
        total: totalUsers,
        activeSubscriptions,
        dau: dailyActiveUsers.length,
        wau: weeklyActiveUsers.length,
        mau: monthlyActiveUsers.length
      },
      revenue: {
        monthly: totalMonthlyRevenue / 100,
        mrr: activeSubscriptions * 10
      },
      dreams: {
        total: totalDreams,
        monthly: monthlyDreams,
        averagePerUser: totalUsers > 0 ? (totalDreams / totalUsers).toFixed(2) : 0
      }
    });
    
  } catch (error) {
    next(error);
  }
}));

// Get all users with pagination and filters
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('role').optional().isIn(['user', 'admin', 'super_admin']),
    query('hasSubscription').optional().isBoolean()
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      page = 1, 
      limit = 20, 
      search, 
      role,
      hasSubscription 
    } = req.query;
    
    try {
      const query = { isDeleted: false };
      
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (role) {
        query.role = role;
      }
      
      if (hasSubscription === 'true') {
        query['subscription.status'] = 'active';
        query['subscription.plan'] = { $ne: 'free' };
      } else if (hasSubscription === 'false') {
        query.$or = [
          { subscription: null },
          { 'subscription.status': { $ne: 'active' } },
          { 'subscription.plan': 'free' }
        ];
      }
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [users, totalCount] = await Promise.all([
        User.find(query)
          .select('-password -passwordResetToken -emailVerificationToken')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        User.countDocuments(query)
      ]);
      
      res.json({
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          hasMore: skip + users.length < totalCount
        }
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Get specific user details
router.get('/users/:userId', catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  
  try {
    const user = await User.findById(userId).select('-password -passwordResetToken -emailVerificationToken');
    
    if (!user || user.isDeleted) {
      throw new AppError('User not found', 404);
    }
    
    // Get dream count
    const dreamCount = await Dream.countDocuments({ userId, isDeleted: false });
    
    // Get recent activity
    const recentActivity = await Event.findEvents({ userId }, { limit: 10 });
    
    // Get payment history
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    res.json({
      user: {
        ...user.toObject(),
        stats: {
          totalDreams: dreamCount
        },
        recentActivity,
        payments
      }
    });
    
  } catch (error) {
    next(error);
  }
}));

// Update user (admin actions)
router.patch('/users/:userId',
  [
    body('action').isIn(['add_credits', 'set_role', 'ban', 'unban', 'verify_email']),
    body('value').optional(),
    body('reason').optional().trim()
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { userId } = req.params;
    const { action, value, reason } = req.body;
    const adminId = req.user?.id || 'system';
    
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      switch (action) {
        case 'add_credits': {
          const credits = parseInt(value);
          if (!credits || credits < 0) {
            throw new AppError('Invalid credit amount', 400);
          }
          
          user.credits = (user.credits || 0) + credits;
          user.lifetimeCreditsEarned = (user.lifetimeCreditsEarned || 0) + credits;
          await user.save();
          
          await Event.trackEvent(userId, 'admin_credits_added', {
            amount: credits,
            adminId,
            reason
          });
          
          auditLog('admin_credits_added', adminId, {
            targetUserId: userId,
            credits,
            reason
          });
          
          res.json({
            message: `Added ${credits} credits to user`,
            success: true,
            newBalance: user.credits
          });
          break;
        }
        
        case 'set_role': {
          if (!['user', 'admin', 'moderator'].includes(value)) {
            throw new AppError('Invalid role', 400);
          }
          
          user.role = value;
          await user.save();
          
          auditLog('admin_role_changed', adminId, {
            targetUserId: userId,
            newRole: value,
            reason
          });
          
          res.json({
            message: `User role updated to ${value}`,
            success: true
          });
          break;
        }
        
        case 'ban': {
          user.isDeleted = true;
          user.deletedAt = new Date();
          await user.save();
          
          auditLog('admin_user_banned', adminId, {
            targetUserId: userId,
            reason
          });
          
          res.json({
            message: 'User banned successfully',
            success: true
          });
          break;
        }
        
        case 'unban': {
          user.isDeleted = false;
          user.deletedAt = undefined;
          await user.save();
          
          auditLog('admin_user_unbanned', adminId, {
            targetUserId: userId,
            reason
          });
          
          res.json({
            message: 'User unbanned successfully',
            success: true
          });
          break;
        }
        
        case 'verify_email': {
          user.emailVerified = true;
          user.emailVerificationToken = undefined;
          user.emailVerificationExpires = undefined;
          await user.save();
          
          auditLog('admin_email_verified', adminId, {
            targetUserId: userId,
            reason
          });
          
          res.json({
            message: 'Email verified successfully',
            success: true
          });
          break;
        }
        
        default:
          throw new AppError('Invalid action', 400);
      }
      
    } catch (error) {
      next(error);
    }
  })
);

// Get all dreams (with filters)
router.get('/dreams',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('userId').optional(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      page = 1, 
      limit = 20,
      userId,
      startDate,
      endDate
    } = req.query;
    
    try {
      const query = { isDeleted: false };
      
      if (userId) query.userId = userId;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [dreams, totalCount] = await Promise.all([
        Dream.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Dream.countDocuments(query)
      ]);
      
      res.json({
        dreams,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Get system logs
router.get('/logs',
  [
    query('type').optional().isIn(['error', 'payment', 'audit', 'all']),
    query('limit').optional().isInt({ min: 1, max: 1000 })
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { type = 'all', limit = 100 } = req.query;
    
    try {
      const query = {};
      
      if (type === 'error') {
        query.type = 'api_error';
      } else if (type === 'payment') {
        query.type = { $in: ['payment_succeeded', 'payment_failed', 'refund_processed', 'credits_purchased'] };
      } else if (type === 'audit') {
        query.type = { $regex: /^admin_/ };
      }
      
      const logs = await Event.findEvents(query, { limit: parseInt(limit) });
      
      res.json({
        logs,
        count: logs.length
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Get revenue report
router.get('/reports/revenue',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('groupBy').optional().isIn(['day', 'week', 'month'])
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      groupBy = 'day'
    } = req.query;
    
    try {
      const payments = await Payment.find({
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
        status: 'succeeded'
      }).sort({ createdAt: 1 }).lean();
      
      // Group payments by period
      const grouped = {};
      payments.forEach(payment => {
        const date = new Date(payment.createdAt);
        let key;
        
        if (groupBy === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!grouped[key]) {
          grouped[key] = {
            period: key,
            revenue: 0,
            transactions: 0,
            subscriptions: 0,
            credits: 0
          };
        }
        
        grouped[key].revenue += payment.amount;
        grouped[key].transactions++;
        
        if (payment.type === 'subscription') {
          grouped[key].subscriptions++;
        } else if (payment.type === 'credit_purchase') {
          grouped[key].credits++;
        }
      });
      
      const report = Object.values(grouped).map(period => ({
        ...period,
        revenue: period.revenue / 100
      }));
      
      const totals = {
        revenue: payments.reduce((sum, p) => sum + p.amount, 0) / 100,
        transactions: payments.length,
        averageTransaction: payments.length > 0 
          ? (payments.reduce((sum, p) => sum + p.amount, 0) / payments.length / 100)
          : 0
      };
      
      res.json({
        report,
        totals,
        period: {
          start: startDate,
          end: endDate,
          groupBy
        }
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Helper routes for development/testing (these should be secured in production)

// Get user ID by email
router.get('/get-user-id/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false });
    
    if (!user) {
      return res.status(404).send('User not found');
    }
    
    res.send(user._id.toString());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Make a user an admin
router.post('/make-admin/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role: 'admin' },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: `User ${userId} is now an admin.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add credits to user
router.post('/add-credits/:userId/:amount', async (req, res) => {
  try {
    const { userId, amount } = req.params;
    const credits = parseInt(amount);
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.credits = (user.credits || 0) + credits;
    user.lifetimeCreditsEarned = (user.lifetimeCreditsEarned || 0) + credits;
    await user.save();
    
    res.json({ 
      message: `Added ${credits} credits to user ${userId}`,
      newBalance: user.credits
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
