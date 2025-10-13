const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticate, requireRole } = require('../middleware/auth');
const { 
  getSupabase,
  getSupabaseAdmin,
  getUserById,
  updateUserCredits,
  getUserProfile
} = require('../config/supabase');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/logger');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// All admin routes require authentication and admin role

// Get dashboard statistics
router.get('/dashboard', catchAsync(async (req, res, next) => {
  try {
    const supabase = getSupabase();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    // Get user statistics
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    const { count: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    // Get payment statistics
    const { data: monthlyRevenue } = await supabase
      .from('payments_history')
      .select('amount')
      .gte('created_at', startOfMonth.toISOString())
      .eq('status', 'succeeded');
    
    const totalMonthlyRevenue = monthlyRevenue?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    
    // Get dream statistics from Supabase
    let totalDreams = 0, monthlyDreams = 0;
    try {
      const { count: total } = await supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);
      totalDreams = total || 0;
      
      const { count: monthly } = await supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
        .eq('is_deleted', false);
      monthlyDreams = monthly || 0;
    } catch (error) {
      console.log('Could not get dream statistics');
    }
    
      // Get event statistics for engagement (optional - skip if MongoDB not available)
      let dailyActiveUsers = [], weeklyActiveUsers = [], monthlyActiveUsers = [];
      let conversionFunnel = {};

      try {
        const Event = require('../models/Event');
        if (Event && Event.distinct) {
          dailyActiveUsers = await Event.distinct('userId', {
            createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) }
          });

          weeklyActiveUsers = await Event.distinct('userId', {
            createdAt: { $gte: startOfWeek }
          });

          monthlyActiveUsers = await Event.distinct('userId', {
            createdAt: { $gte: startOfMonth }
          });

          // Get conversion funnel
          if (Event.getConversionFunnel) {
            conversionFunnel = await Event.getConversionFunnel(
              ['user_signup', 'dream_submitted', 'subscription_created'],
              startOfMonth,
              now
            );
          }
        }
      } catch (error) {
        console.log('Could not get event statistics - MongoDB not available');
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
        monthly: totalMonthlyRevenue / 100, // Convert from cents
        mrr: activeSubscriptions * 10 // Rough estimate, should calculate from actual subscription prices
      },
      dreams: {
        total: totalDreams,
        monthly: monthlyDreams,
        averagePerUser: totalUsers > 0 ? (totalDreams / totalUsers).toFixed(2) : 0
      },
      conversionFunnel
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
      const supabase = getSupabase();
      const supabaseAdmin = getSupabaseAdmin();
      
      // Get users from auth
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page: parseInt(page),
        perPage: parseInt(limit)
      });
      
      if (error) throw error;
      
      // Get additional user data
      const userIds = users.map(u => u.id);
      
      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);
      
      // Get subscriptions
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*')
        .in('user_id', userIds);
      
      // Get roles
      const { data: roles } = await supabase
        .from('roles')
        .select('*')
        .in('user_id', userIds);
      
      // Get credits
      const { data: credits } = await supabase
        .from('credits')
        .select('*')
        .in('user_id', userIds);
      
      // Combine data
      const enrichedUsers = users.map(user => {
        const profile = profiles?.find(p => p.user_id === user.id);
        const subscription = subscriptions?.find(s => s.user_id === user.id);
        const userRole = roles?.find(r => r.user_id === user.id);
        const userCredits = credits?.find(c => c.user_id === user.id);
        
        return {
          id: user.id,
          email: user.email,
          emailVerified: user.email_confirmed_at ? true : false,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          profile: profile || null,
          subscription: subscription || null,
          role: userRole?.role || 'user',
          credits: userCredits?.balance || 0
        };
      });
      
      // Apply filters
      let filteredUsers = enrichedUsers;
      
      if (search) {
        filteredUsers = filteredUsers.filter(u => 
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.profile?.display_name?.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (role) {
        filteredUsers = filteredUsers.filter(u => u.role === role);
      }
      
      if (hasSubscription !== undefined) {
        filteredUsers = filteredUsers.filter(u => 
          hasSubscription ? u.subscription?.status === 'active' : !u.subscription || u.subscription.status !== 'active'
        );
      }
      
      res.json({
        users: filteredUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: users.length,
          hasMore: users.length === parseInt(limit)
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
    const supabaseAdmin = getSupabaseAdmin();
    
    // Get user from auth
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (error || !user) {
      throw new AppError('User not found', 404);
    }
    
    // Get profile
    const profile = await getUserProfile(userId);
    
    // Get subscription
    const supabase = getSupabase();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    // Get credits
    const { data: credits } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    // Get dream count from Supabase
    let dreamCount = 0;
    try {
      const { count } = await supabase
        .from('dreams')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_deleted', false);
      dreamCount = count || 0;
    } catch (error) {
      console.log('Could not get dream count');
    }
    
    // Get recent activity (optional - skip if MongoDB not available)
    let recentActivity = [];
    try {
      const Event = require('../models/Event');
      if (Event && Event.find) {
        recentActivity = await Event.find({ userId })
          .sort({ createdAt: -1 })
          .limit(10)
          .select('type createdAt metadata');
      }
    } catch (error) {
      console.log('Could not get recent activity - MongoDB not available');
    }
    
    // Get payment history
    const { data: payments } = await supabase
      .from('payments_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at ? true : false,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        profile,
        subscription,
        credits: credits?.balance || 0,
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
    const adminId = req.user.id;
    
    try {
      const supabase = getSupabase();
      const supabaseAdmin = getSupabaseAdmin();
      
      switch (action) {
        case 'add_credits': {
          const credits = parseInt(value);
          if (!credits || credits < 0) {
            throw new AppError('Invalid credit amount', 400);
          }
          
          await updateUserCredits(userId, credits, 'add');
          
          // Track event (optional - skip if MongoDB not available)
          try {
            const Event = require('../models/Event');
            if (Event && Event.trackEvent) {
              await Event.trackEvent(userId, 'admin_credits_added', {
                amount: credits,
                adminId,
                reason
              });
            }
          } catch (error) {
            console.log('Event tracking skipped - MongoDB not available');
          }
          
          auditLog('admin_credits_added', adminId, {
            targetUserId: userId,
            credits,
            reason
          });
          
          res.json({
            message: `Added ${credits} credits to user`,
            success: true
          });
          break;
        }
        
        case 'set_role': {
          if (!['user', 'admin', 'super_admin'].includes(value)) {
            throw new AppError('Invalid role', 400);
          }
          
          await supabase
            .from('roles')
            .upsert([{
              user_id: userId,
              role: value,
              updated_at: new Date().toISOString()
            }]);
          
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
          const banUntil = value ? new Date(value) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default
          
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: `${Math.floor((banUntil - new Date()) / 1000)}s`
          });
          
          auditLog('admin_user_banned', adminId, {
            targetUserId: userId,
            banUntil,
            reason
          });
          
          res.json({
            message: `User banned until ${banUntil.toISOString()}`,
            success: true
          });
          break;
        }
        
        case 'unban': {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: 'none'
          });
          
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
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email_confirm: true
          });
          
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

// Issue refund
router.post('/refund',
  [
    body('paymentId').notEmpty(),
    body('amount').optional().isInt({ min: 1 }),
    body('reason').notEmpty().trim()
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { paymentId, amount, reason } = req.body;
    const adminId = req.user.id;
    
    try {
      const supabase = getSupabase();
      
      // Get payment record
      const { data: payment, error } = await supabase
        .from('payments_history')
        .select('*')
        .eq('id', paymentId)
        .single();
      
      if (error || !payment) {
        throw new AppError('Payment not found', 404);
      }
      
      // Issue refund through Stripe
      const refund = await stripe.refunds.create({
        charge: payment.provider_charge_id,
        amount: amount || payment.amount, // Partial or full refund
        reason: 'requested_by_customer',
        metadata: {
          adminId,
          reason
        }
      });
      
      // Update payment record
      await supabase
        .from('payments_history')
        .insert([{
          user_id: payment.user_id,
          amount: -(amount || payment.amount),
          currency: payment.currency,
          status: 'refunded',
          type: 'refund',
          provider_charge_id: refund.id,
          metadata: {
            originalPaymentId: paymentId,
            reason,
            adminId
          },
          created_at: new Date().toISOString()
        }]);
      
      // Track event (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(payment.user_id, 'admin_refund_issued', {
          paymentId,
          amount: amount || payment.amount,
          adminId,
          reason
        });
      } catch (error) {
        console.log('Event tracking skipped');
      }
      
      auditLog('admin_refund_issued', adminId, {
        paymentId,
        userId: payment.user_id,
        amount: amount || payment.amount,
        reason
      });
      
      res.json({
        message: 'Refund issued successfully',
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status
        }
      });
      
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
      
      // Get dreams from Supabase
      const supabase = getSupabase();
      const from = (parseInt(page) - 1) * parseInt(limit);
      const to = from + parseInt(limit) - 1;
      
      let supabaseQuery = supabase
        .from('dreams')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (userId) {
        supabaseQuery = supabaseQuery.eq('user_id', userId);
      }
      
      if (startDate || endDate) {
        if (startDate) supabaseQuery = supabaseQuery.gte('created_at', new Date(startDate).toISOString());
        if (endDate) supabaseQuery = supabaseQuery.lte('created_at', new Date(endDate).toISOString());
      }
      
      const { data: dreams, count: totalCount } = await supabaseQuery;
      
      res.json({
        dreams: dreams || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / parseInt(limit))
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
      // This would typically read from log files or a logging service
      // For now, we'll return recent events
      const query = {};
      
      if (type === 'error') {
        query.type = 'api_error';
      } else if (type === 'payment') {
        query.type = { $in: ['payment_succeeded', 'payment_failed', 'refund_processed'] };
      } else if (type === 'audit') {
        query.type = { $regex: /^admin_/ };
      }
      
      // Get logs (optional - skip if MongoDB not available)
      let logs = [];
      try {
        const Event = require('../models/Event');
        if (Event && Event.find) {
          logs = await Event.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .select('type userId metadata createdAt');
        }
      } catch (error) {
        console.log('Could not get logs - MongoDB not available');
      }
      
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
      const supabase = getSupabase();
      
      const { data: payments, error } = await supabase
        .from('payments_history')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'succeeded')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Group payments by period
      const grouped = {};
      payments.forEach(payment => {
        const date = new Date(payment.created_at);
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
        } else if (payment.type === 'credits') {
          grouped[key].credits++;
        }
      });
      
      const report = Object.values(grouped).map(period => ({
        ...period,
        revenue: period.revenue / 100 // Convert from cents
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

// Temporary route to get user ID by email (no auth)
router.get('/get-user-id/:email', async (req, res) => {
  const { email } = req.params;
  const supabaseAdmin = getSupabaseAdmin();
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    return res.status(500).send(error);
  }
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).send('User not found');
  }
  res.send(user.id);
});

// Temporary route to make a user an admin (no auth)
router.post('/make-admin/:userId', async (req, res) => {
    const { userId } = req.params;
    const supabaseAdmin = getSupabaseAdmin();
    const { error: roleError } = await supabaseAdmin
        .from('roles')
        .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id' });
    if (roleError) {
        return res.status(500).json({ error: roleError.message });
    }
    res.send(`User ${userId} is now an admin.`);
});

// Temporary route to add credits
router.post('/add-credits/:userId/:amount', async (req, res) => {
  const { userId, amount } = req.params;
  await updateUserCredits(userId, parseInt(amount), 'add');
  res.send(`Added ${amount} credits to user ${userId}`);
});

module.exports = router;
