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

// Import database connections
const { connectMongoDB } = require('./config/mongodb');
const { initSupabase } = require('./config/supabase');

// Import i18n configuration
const { i18nMiddleware } = require('./config/i18n');

const app = express();
const PORT = process.env.PORT || 5001;

// Initialize databases
const initializeDatabases = async () => {
  try {
    await connectMongoDB();
    await initSupabase();
    console.log('✅ All databases connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:5000", "https://day-dream-dictionary-api.onrender.com"],
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
  credentials: false, // Set to false for preflight requests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-Source'],
  optionsSuccessStatus: 200,
  preflightContinue: false
};
app.use(cors(corsOptions));

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

// i18n middleware - DISABLED for free mode
// app.use(i18nMiddleware);

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Day Dream Dictionary API is running',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString()
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
      sortBy = 'created_at',
      order = 'desc'
    } = req.query;

    // Get dreams from real Supabase database
    const { getSupabase } = require('./config/supabase');

    // Get dreams from Supabase
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = getSupabase()
      .from('dreams')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order(sortBy, { ascending: order === 'asc' })
      .range(from, to);

    const { data: dreams, error, count } = await query;

    if (error) {
      console.error('Error fetching dreams:', error);
      return res.json({
        dreams: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1
      });
    }

    console.log('Found dreams in Supabase:', dreams?.length || 0);

    res.json({
      dreams: dreams || [],
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: page
    });

  } catch (error) {
    console.error('Error in test endpoint:', error);
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
// This serves all files from the root directory (where index.html is)
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
    // MongoDB and Supabase connections will be closed here
    process.exit(0);
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
║     API Base: http://localhost:${PORT}/api/${process.env.API_VERSION || 'v1'}       ║
║     JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing'}           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
  `);

  // Initialize databases
  await initializeDatabases();
});

module.exports = app;
