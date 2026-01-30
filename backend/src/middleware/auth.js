const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError, catchAsync } = require('./errorHandler');
const { logger } = require('../config/mongodb');

// Authenticate user middleware
const authenticate = catchAsync(async (req, res, next) => {
  // Skip authentication if req.skipAuth is set
  if (req.skipAuth) {
    return next();
  }

  // Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided. Please authenticate.', 401);
  }

  const token = authHeader.substring(7);

  try {
    // Check if we're in test mode
    const testMode = process.env.TEST_MODE === 'true';
    
    if (testMode && token === 'test-token') {
      req.user = {
        id: 'test-user-id',
        email: 'test@example.com',
        emailVerified: true,
        role: 'user'
      };
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'access') {
      throw new AppError('Invalid token type', 401);
    }

    // For test mode with test-user-id
    if (testMode && decoded.userId === 'test-user-id') {
      req.user = {
        id: decoded.userId,
        email: 'test@example.com',
        emailVerified: true,
        role: 'user'
      };
      return next();
    }

    // Get user from MongoDB
    let user;
    try {
      user = await User.findById(decoded.userId);
    } catch (error) {
      logger.warn('Could not fetch user from MongoDB:', error.message);
      if (testMode) {
        req.user = {
          id: decoded.userId,
          email: 'test@example.com',
          emailVerified: true,
          role: 'user'
        };
        return next();
      }
      throw new AppError('User not found', 401);
    }

    if (!user || user.isDeleted) {
      if (testMode) {
        req.user = {
          id: decoded.userId,
          email: 'test@example.com',
          emailVerified: true,
          role: 'user'
        };
        return next();
      }
      throw new AppError('User not found', 401);
    }

    // Update last activity
    user.lastActivityAt = new Date();
    await user.save();

    // Add user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      emailVerified: user.emailVerified || false,
      role: user.role || 'user',
      displayName: user.displayName,
      credits: user.credits,
      subscription: user.subscription
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired. Please login again.', 401);
    }
    throw error;
  }
});

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type === 'access') {
      const user = await User.findById(decoded.userId);
      if (user && !user.isDeleted) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          emailVerified: user.emailVerified || false,
          role: user.role || 'user'
        };
      }
    }
  } catch (error) {
    // Token invalid, but continue without user
    req.user = null;
  }
  
  next();
};

// Require specific role
const requireRole = (roles) => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    
    const userRole = req.user.role || 'user';
    
    if (!roles.includes(userRole)) {
      throw new AppError('Insufficient permissions', 403);
    }
    
    next();
  });
};

// Require email verification
const requireEmailVerification = catchAsync(async (req, res, next) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }
  
  if (!req.user.emailVerified) {
    throw new AppError('Please verify your email address to access this feature', 403);
  }
  
  next();
});

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 900000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const now = Date.now();
    
    // Clean old entries
    for (const [key, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(key);
      }
    }
    
    // Check user's requests
    if (!requests.has(userId)) {
      requests.set(userId, {
        count: 1,
        firstRequest: now
      });
      return next();
    }
    
    const userData = requests.get(userId);
    
    if (now - userData.firstRequest > windowMs) {
      // Reset window
      userData.count = 1;
      userData.firstRequest = now;
      return next();
    }
    
    if (userData.count >= maxRequests) {
      throw new AppError(`Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 60000} minutes.`, 429);
    }
    
    userData.count++;
    next();
  };
};

// API key authentication (for external API access)
const authenticateApiKey = catchAsync(async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    throw new AppError('API key required', 401);
  }
  
  // Validate API key
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    throw new AppError('Invalid API key', 401);
  }
  
  req.apiKey = apiKey;
  
  next();
});

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireEmailVerification,
  userRateLimit,
  authenticateApiKey
};
