const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Event } = require('../models');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { auditLog } = require('../middleware/logger');
const { logger } = require('../config/mongodb');

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
    { userId: userId.toString(), type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  
  const refreshToken = jwt.sign(
    { userId: userId.toString(), type: 'refresh' },
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
  
  try {
    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }
    
    // Create new user
    const user = new User({
      email,
      password,
      displayName: displayName || email.split('@')[0],
      locale,
      credits: 5,
      lifetimeCreditsEarned: 5,
      preferences: {
        emailNotifications: true,
        pushNotifications: false,
        theme: 'light',
        dreamPrivacy: 'private',
        dreamStorage: true
      }
    });
    
    await user.save();
    logger.info(`✅ New user created: ${user._id}`);
    
    // Track signup event
    try {
      await Event.trackEvent(user._id, 'user_signup', {
        email,
        locale,
        source: req.headers['x-source'] || 'web'
      });
    } catch (eventError) {
      logger.warn('Event tracking failed:', eventError.message);
    }
    
    // Audit log
    auditLog('user_signup', user._id.toString(), { email });
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
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
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        locale: user.locale,
        emailVerified: user.emailVerified,
        credits: user.credits
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

  try {
    // Check for test mode
    const testMode = process.env.TEST_MODE === 'true';
    
    if (testMode && (email === 'test@example.com' || email === 'sample1@gmail.com') && (password === 'test' || password === 'sample')) {
      logger.info('Using test mode authentication for email:', email);

      const { accessToken, refreshToken } = generateTokens('test-user-id');

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
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

    // Find user by email
    const user = await User.findByEmail(email);
    
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Track login event
    try {
      await Event.trackEvent(user._id, 'user_login', {
        email,
        source: req.headers['x-source'] || 'web',
        ip: req.ip
      });
    } catch (eventError) {
      logger.warn('Event tracking failed:', eventError.message);
    }

    // Audit log
    auditLog('user_login', user._id.toString(), { email });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        locale: user.locale,
        role: user.role,
        emailVerified: user.emailVerified,
        credits: user.credits
      },
      accessToken
    });

  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
}));

// Logout
router.post('/logout', catchAsync(async (req, res, next) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');
    
    // Track logout event if user was authenticated
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await Event.trackEvent(decoded.userId, 'user_logout', {
          source: req.headers['x-source'] || 'web'
        });
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
    
    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user || user.isDeleted) {
      throw new AppError('User not found', 401);
    }
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);
    
    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
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
    
    try {
      const user = await User.findByEmail(email);
      
      if (user) {
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save();
        
        // TODO: Send email with reset link
        // const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        logger.info(`Password reset requested for: ${email}`);
      }
      
      // Track event
      await Event.trackEvent('anonymous', 'password_reset_requested', {
        email: email.substring(0, 3) + '***',
        source: req.headers['x-source'] || 'web'
      });
      
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
    
    try {
      // Hash the token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      // Find user with valid reset token
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
        isDeleted: false
      });
      
      if (!user) {
        throw new AppError('Invalid or expired reset token', 400);
      }
      
      // Update password
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      // Track event
      await Event.trackEvent(user._id, 'password_reset_completed', {
        source: req.headers['x-source'] || 'web'
      });
      
      auditLog('password_reset', user._id.toString(), {});
      
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
  
  try {
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
      isDeleted: false
    });
    
    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }
    
    // Verify email
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    // Track event
    await Event.trackEvent(user._id, 'email_verified', {
      source: 'email_link'
    });
    
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
    
    try {
      const user = await User.findByEmail(email);
      
      if (user && !user.emailVerified) {
        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
        
        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await user.save();
        
        // TODO: Send verification email
        // const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        logger.info(`Verification email requested for: ${email}`);
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
  res.json({
    testMode: process.env.TEST_MODE === 'true',
    TEST_MODE_env: process.env.TEST_MODE,
    NODE_ENV: process.env.NODE_ENV,
    database: 'MongoDB',
    timestamp: new Date().toISOString()
  });
});

// Get current user (requires authentication)
router.get('/me', catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user || user.isDeleted) {
      throw new AppError('User not found', 404);
    }
    
    res.json({
      user: user.toSafeObject()
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Invalid or expired token', 401);
    }
    next(error);
  }
}));

module.exports = router;
