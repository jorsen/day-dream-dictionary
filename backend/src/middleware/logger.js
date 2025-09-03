const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'day-dream-dictionary' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, log to the console too
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Create a stream object with a 'write' function for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info({
    type: 'request',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    // Log response
    const duration = Date.now() - start;
    logger.info({
      type: 'response',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn({
        type: 'slow-request',
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.send(data);
  };
  
  next();
};

// Error logger
const errorLogger = (error, req, res, next) => {
  logger.error({
    type: 'error',
    method: req.method,
    url: req.originalUrl,
    error: {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500
    },
    timestamp: new Date().toISOString()
  });
  
  next(error);
};

// Audit logger for sensitive operations
const auditLog = (action, userId, details = {}) => {
  logger.info({
    type: 'audit',
    action,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
};

// Payment logger
const paymentLog = (event, userId, details = {}) => {
  logger.info({
    type: 'payment',
    event,
    userId,
    details,
    timestamp: new Date().toISOString()
  });
};

// Dream interpretation logger
const dreamLog = (userId, dreamId, details = {}) => {
  logger.info({
    type: 'dream-interpretation',
    userId,
    dreamId,
    details,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  auditLog,
  paymentLog,
  dreamLog
};