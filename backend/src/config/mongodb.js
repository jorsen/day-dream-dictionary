const mongoose = require('mongoose');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/daydreamdictionary';
    
    // Check if we're in test mode or MongoDB is not available
    if (process.env.TEST_MODE === 'true' || mongoUri.includes('localhost')) {
      logger.warn('⚠️ MongoDB connection may fail if not installed locally. App will continue with limited functionality.');
    }
    
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    };

    try {
      await mongoose.connect(mongoUri, options);
      logger.info('✅ MongoDB connected successfully');
    } catch (mongoError) {
      logger.warn('⚠️ MongoDB connection failed. Running without database:', mongoError.message);
      // Continue without MongoDB for testing
      return;
    }
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};

module.exports = {
  connectMongoDB,
  mongoose,
  logger
};