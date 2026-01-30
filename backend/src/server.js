const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logger');

// Import routes
console.log('Loading auth routes...');
const authRoutes = require('./routes/auth');
console.log('Auth routes loaded successfully');
const dreamRoutes = require('./routes/dreams');
const paymentRoutes = require('./routes/payments');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');

// Import MongoDB connection
const { connectMongoDB, getConnectionStatus, logger } = require('./config/mongodb');

// Import models
const { Dream } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize MongoDB database
const initializeDatabases = async () => {
  try {
    await connectMongoDB();
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    // Don't exit in production if MongoDB fails, just log the error
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:5000", "https://day-dream-dictionary-api.onrender.com", "https://api.stripe.com", "https://r.stripe.com", "https://merchant-ui-api.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - Allow specific origins for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined) {
      callback(null, true);
    } else {
      // In production, use specific allowed origins
      const allowedOrigins = [
        'https://day-dream-dictionary.onrender.com',
        'https://daydreamdictionary.com',
        'https://day-dream-dictionary-api.onrender.com',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://localhost:5173'
      ];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked: Origin ${origin} not in allowed list: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Source'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};
app.use(cors(corsOptions));

// Trust proxy for rate limiting (important for render.com)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(compression());

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = getConnectionStatus();
  res.status(200).json({
    status: 'OK',
    message: 'Day Dream Dictionary API is running',
    version: process.env.API_VERSION || 'v1',
    database: 'MongoDB',
    databaseStatus: dbStatus.readyStateText,
    timestamp: new Date().toISOString()
  });
});

// Payment products endpoint (for frontend compatibility)
app.get('/api/v1/payment/products', (req, res) => {
  const products = {
    credit_packs: {
      small: {
        id: 'price_small_credits',
        name: 'Small Credit Pack',
        amount: 999,
        currency: 'usd',
        credits: 10,
        description: '10 Dream Interpretation Credits'
      },
      medium: {
        id: 'price_medium_credits',
        name: 'Medium Credit Pack',
        amount: 1999,
        currency: 'usd',
        credits: 30,
        description: '30 Dream Interpretation Credits (25 + 5 bonus)'
      },
      large: {
        id: 'price_large_credits',
        name: 'Large Credit Pack',
        amount: 3999,
        currency: 'usd',
        credits: 75,
        description: '75 Dream Interpretation Credits (60 + 15 bonus)'
      }
    },
    subscriptions: {
      basic: {
        id: 'price_basic_monthly',
        name: 'Basic Plan',
        amount: 499,
        currency: 'usd',
        interval: 'month',
        features: ['20 basic interpretations', '5 deep interpretations', 'unlimited history', 'PDF export', 'no ads']
      },
      pro: {
        id: 'price_pro_monthly',
        name: 'Pro Plan',
        amount: 1299,
        currency: 'usd',
        interval: 'month',
        features: ['unlimited interpretations', 'analytics', 'voice journaling', 'reminders', 'symbol encyclopedia', 'no ads']
      }
    },
    add_ons: {
      remove_ads: {
        id: 'price_remove_ads',
        name: 'Remove Ads',
        amount: 199,
        currency: 'usd',
        interval: 'month',
        description: 'Ad-free experience'
      },
      life_season_report: {
        id: 'price_life_season',
        name: 'Life Season Report',
        amount: 1499,
        currency: 'usd',
        description: 'Personal life analysis based on dreams'
      },
      recurring_dream_map: {
        id: 'price_recurring_map',
        name: 'Recurring Dream Map',
        amount: 999,
        currency: 'usd',
        description: 'Visualization of recurring dream patterns'
      },
      couples_report: {
        id: 'price_couples_report',
        name: 'Couples Report',
        amount: 1999,
        currency: 'usd',
        description: 'Relationship dream analysis'
      },
      lucid_kit: {
        id: 'price_lucid_kit',
        name: 'Lucid Dreaming Kit',
        amount: 2499,
        currency: 'usd',
        description: 'Tools and techniques for lucid dreaming'
      },
      therapist_export: {
        id: 'price_therapist_export',
        name: 'Therapist Export',
        amount: 2999,
        currency: 'usd',
        description: 'Professional export format for therapists'
      }
    }
  };

  res.json({
    products: products,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_stripe_key'
  });
});

// API Routes
const apiPrefix = `/api/${process.env.API_VERSION || 'v1'}`;

// Test endpoint for dreams without authentication - MUST be before dreams router
app.get(`${apiPrefix}/test-dreams-history`, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [dreams, totalCount] = await Promise.all([
      Dream.find({ isDeleted: false })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Dream.countDocuments({ isDeleted: false })
    ]);

    logger.info(`Found ${dreams.length} dreams in MongoDB`);

    res.json({
      dreams: dreams || [],
      totalCount: totalCount || 0,
      totalPages: Math.ceil((totalCount || 0) / parseInt(limit)),
      currentPage: parseInt(page)
    });

  } catch (error) {
    logger.error('Error in test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/dreams`, dreamRoutes);
app.use(`${apiPrefix}/payments`, paymentRoutes);
app.use(`${apiPrefix}/profile`, profileRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/webhooks`, webhookRoutes);

// Static files for uploaded content (if needed)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve frontend static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../../')));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

// Catch-all route to serve index.html for client-side routing (if needed)
app.get('*', (req, res, next) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api')) {
    const filePath = path.join(__dirname, '../../', req.path);
    // Check if the requested file exists
    if (require('fs').existsSync(filePath) && !require('fs').statSync(filePath).isDirectory()) {
      res.sendFile(filePath);
    } else if (!req.path.includes('.')) {
      // If no file extension, might be a route, serve index.html
      res.sendFile(path.join(__dirname, '../../index.html'));
    } else {
      // Let it fall through to 404 handler
      next();
    }
  } else {
    next();
  }
});

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested resource ${req.originalUrl} was not found on this server.`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🔄 Starting graceful shutdown...');
  
  // Close server
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close database connections
    const { disconnectMongoDB } = require('./config/mongodb');
    disconnectMongoDB().then(() => {
      process.exit(0);
    }).catch(() => {
      process.exit(1);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Start server
const server = app.listen(PORT, async () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║     🌙 Day Dream Dictionary API Server 🌙           ║
║                                                      ║
║     Version: ${process.env.API_VERSION || 'v1'}                                    ║
║     Port: ${PORT}                                   ║
║     Environment: ${process.env.NODE_ENV || 'development'}                       ║
║     Database: MongoDB                               ║
║     API Base: http://localhost:${PORT}/api/${process.env.API_VERSION || 'v1'}       ║
║     JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing'}           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);

  // Initialize databases
  await initializeDatabases();
});

module.exports = app;
