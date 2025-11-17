const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { 
  getSupabase, 
  createUserProfile, 
  getUserProfile,
  checkUserRole 
} = require('../config/supabase');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/logger');

// Validation middleware
const validateSignup = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('displayName').optional().trim().isLength({ min: 2, max: 50 }),
  body('locale').optional().isIn(['en', 'es'])
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Helper function to generate tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );
  
  return { accessToken, refreshToken };
};

// Sign up
router.post('/signup', validateSignup, catchAsync(async (req, res, next) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { email, password, displayName, locale = 'en' } = req.body;
  const supabase = getSupabase();
  
  try {
    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          locale
        }
      }
    });
    
    if (authError) {
      if (authError.message.includes('already registered')) {
        throw new AppError('Email already registered', 409);
      }
      throw new AppError(authError.message, 400);
    }
    
    const user = authData.user;
    
    // Create user profile
    await createUserProfile(user.id, {
      email: user.email,
      display_name: displayName || email.split('@')[0],
      locale,
      preferences: {
        emailNotifications: true,
        pushNotifications: false,
        theme: 'light',
        dreamPrivacy: 'private'
      }
    });
    
    // Initialize user credits (free tier) - use admin client to bypass RLS
    try {
      const adminClient = require('../config/supabase').getSupabaseAdmin() || supabase;
      const { error: creditsError } = await adminClient
        .from('credits')
        .insert([{
          user_id: user.id,
          balance: 5,
          lifetime_earned: 5,
          updated_at: new Date().toISOString()
        }]);

      if (creditsError) {
        console.log('Credits table may not exist, skipping initialization:', creditsError.message);
      } else {
        console.log('✅ Added 5 free credits to new user:', user.id);
      }
    } catch (creditsError) {
      console.log('Credits initialization skipped (table may not exist):', creditsError.message);
    }

    // Set default user role - use admin client to bypass RLS
    try {
      const adminClient = require('../config/supabase').getSupabaseAdmin() || supabase;
      const { error: roleError } = await adminClient
        .from('roles')
        .insert([{
          user_id: user.id,
          role: 'user',
          created_at: new Date().toISOString()
        }]);

      if (roleError) {
        console.log('Roles table may not exist, skipping initialization:', roleError.message);
      }
    } catch (roleError) {
      console.log('Role initialization skipped (table may not exist):', roleError.message);
    }
    
    // Track signup event (optional - skip if MongoDB is not available)
    try {
      const Event = require('../models/Event');
      if (Event && Event.trackEvent) {
        await Event.trackEvent(user.id, 'user_signup', {
          email,
          locale,
          source: req.headers['x-source'] || 'web'
        });
      }
    } catch (eventError) {
      console.log('Event tracking skipped (MongoDB not available):', eventError.message);
    }
    
    // Audit log
    auditLog('user_signup', user.id, { email });
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: displayName || email.split('@')[0],
        locale,
        emailVerified: false,
        credits: 5
      },
      accessToken
    });
    
  } catch (error) {
    next(error);
  }
}));

// Login
router.post('/login', validateLogin, catchAsync(async (req, res, next) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const supabase = getSupabase();

  try {
    // Check if we're in test mode
    const { testMode } = require('../config/test-mode');
    console.log('Login attempt - Test mode:', testMode, 'Email:', email);

    if (testMode && (email === 'test@example.com' || email === 'sample1@gmail.com') && (password === 'test' || password === 'sample')) {
      console.log('Using test mode authentication for email:', email);

      // Generate tokens for test user
      const { accessToken, refreshToken } = generateTokens('test-user-id');

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      return res.json({
        message: 'Login successful',
        user: {
          id: 'test-user-id',
          email: email,
          displayName: 'Test User',
          locale: 'en',
          role: 'user',
          emailVerified: true,
          credits: 5
        },
        accessToken
      });
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = authData.user;
    const session = authData.session;

    // Get user profile
    const profile = await getUserProfile(user.id);

    // Get user role
    const role = await checkUserRole(user.id);

    // Track login event (optional - skip if not available)
    try {
      const Event = require('../models/Event');
      if (Event && Event.trackEvent) {
        await Event.trackEvent(user.id, 'user_login', {
          email,
          source: req.headers['x-source'] || 'web',
          ip: req.ip
        });
      }
    } catch (eventError) {
      console.log('Event tracking skipped:', eventError.message);
    }

    // Audit log
    auditLog('user_login', user.id, { email });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: profile?.display_name || email.split('@')[0],
        locale: profile?.locale || 'en',
        role,
        emailVerified: user.email_confirmed_at ? true : false
      },
      accessToken
    });

  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
}));

// Logout
router.post('/logout', catchAsync(async (req, res, next) => {
  const supabase = getSupabase();
  
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw new AppError(error.message, 400);
    }
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    // Track logout event if user was authenticated
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        try {
          const Event = require('../models/Event');
          if (Event && Event.trackEvent) {
            await Event.trackEvent(decoded.userId, 'user_logout', {
              source: req.headers['x-source'] || 'web'
            });
          }
        } catch (eventError) {
          // Event tracking failed, continue with logout
        }
        auditLog('user_logout', decoded.userId, {});
      } catch (err) {
        // Token invalid, but still allow logout
      }
    }
    
    res.json({
      message: 'Logout successful'
    });
    
  } catch (error) {
    next(error);
  }
}));

// Refresh token
router.post('/refresh', catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    throw new AppError('Refresh token not provided', 401);
  }
  
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    
    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.json({
      accessToken
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Invalid or expired refresh token', 401);
    }
    next(error);
  }
}));

// Request password reset
router.post('/forgot-password', 
  body('email').isEmail().normalizeEmail(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email } = req.body;
    const supabase = getSupabase();
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.FRONTEND_URL}/reset-password`
      });
      
      if (error) {
        // Don't reveal if email exists or not
        console.error('Password reset error:', error);
      }
      
      // Track event
      try {
        const Event = require('../models/Event');
        if (Event && Event.trackEvent) {
          await Event.trackEvent('anonymous', 'password_reset_requested', {
            email: email.substring(0, 3) + '***', // Partially masked for privacy
            source: req.headers['x-source'] || 'web'
          });
        }
      } catch (eventError) {
        // Event tracking failed, continue
      }
      
      // Always return success to prevent email enumeration
      res.json({
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Reset password
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { token, password } = req.body;
    const supabase = getSupabase();
    
    try {
      const { data, error } = await supabase.auth.updateUser({
        password
      });
      
      if (error) {
        throw new AppError('Invalid or expired reset token', 400);
      }
      
      // Track event
      try {
        const Event = require('../models/Event');
        if (Event && Event.trackEvent) {
          await Event.trackEvent(data.user.id, 'password_reset_completed', {
            source: req.headers['x-source'] || 'web'
          });
        }
      } catch (eventError) {
        // Event tracking failed, continue
      }
      
      auditLog('password_reset', data.user.id, {});
      
      res.json({
        message: 'Password reset successful. Please login with your new password.'
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Verify email
router.get('/verify-email', catchAsync(async (req, res, next) => {
  const { token } = req.query;
  
  if (!token) {
    throw new AppError('Verification token not provided', 400);
  }
  
  const supabase = getSupabase();
  
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email'
    });
    
    if (error) {
      throw new AppError('Invalid or expired verification token', 400);
    }
    
    // Track event
    try {
      const Event = require('../models/Event');
      if (Event && Event.trackEvent) {
        await Event.trackEvent('anonymous', 'email_verified', {
          source: 'email_link'
        });
      }
    } catch (eventError) {
      // Event tracking failed, continue
    }
    
    res.json({
      message: 'Email verified successfully'
    });
    
  } catch (error) {
    next(error);
  }
}));

// Resend verification email
router.post('/resend-verification',
  body('email').isEmail().normalizeEmail(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email } = req.body;
    const supabase = getSupabase();
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email
      });
      
      if (error) {
        // Don't reveal if email exists or not
        console.error('Resend verification error:', error);
      }
      
      // Always return success to prevent email enumeration
      res.json({
        message: 'If an account exists with this email, a verification link has been sent.'
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Test mode status endpoint
router.get('/test-status', (req, res) => {
  const { testMode } = require('../config/test-mode');
  res.json({
    testMode,
    TEST_MODE_env: process.env.TEST_MODE,
    NODE_ENV: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Temporary route for testing - DISABLED for security
// router.get('/test-login', async (req, res) => {
//   const supabase = getSupabase();
//   const { data, error } = await supabase.auth.signInWithPassword({
//     email: 'jorsenmejia@gmail.com',
//     password: 'password123',
//   });
//   if (error) {
//     return res.status(401).json({ error: error.message });
//   }
//   res.json(data);
// });

module.exports = router;
