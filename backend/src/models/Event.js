const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  userIdString: {
    type: String,
    index: true
  },
  type: {
    type: String,
    required: true,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  source: {
    type: String,
    default: 'web'
  },
  ip: String,
  userAgent: String,
  sessionId: String
}, {
  timestamps: true
});

// Indexes for analytics queries
eventSchema.index({ userId: 1, type: 1, createdAt: -1 });
eventSchema.index({ type: 1, createdAt: -1 });
eventSchema.index({ createdAt: -1 });

/**
 * Track an event
 * @param {string|ObjectId} userId 
 * @param {string} type 
 * @param {object} metadata 
 */
eventSchema.statics.trackEvent = async function(userId, type, metadata = {}) {
  try {
    const eventData = {
      type,
      metadata,
      createdAt: new Date()
    };

    // Handle both ObjectId and string userId
    if (userId) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        eventData.userId = userId;
      }
      eventData.userIdString = userId.toString();
    }

    await this.create(eventData);
  } catch (err) {
    console.error('trackEvent failed:', err.message);
  }
};

/**
 * Find events with query
 */
eventSchema.statics.findEvents = async function(query = {}, options = {}) {
  const { limit = 100, skip = 0, sort = { createdAt: -1 } } = options;
  
  try {
    const mongoQuery = {};
    
    if (query.userId) {
      if (mongoose.Types.ObjectId.isValid(query.userId)) {
        mongoQuery.userId = query.userId;
      } else {
        mongoQuery.userIdString = query.userId.toString();
      }
    }
    
    if (query.type) {
      mongoQuery.type = query.type;
    }

    return await this.find(mongoQuery)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  } catch (err) {
    console.error('Event.findEvents failed:', err.message);
    return [];
  }
};

/**
 * Count documents/events matching query
 */
eventSchema.statics.countEvents = async function(query = {}) {
  try {
    const mongoQuery = {};
    
    if (query.userId) {
      if (mongoose.Types.ObjectId.isValid(query.userId)) {
        mongoQuery.userId = query.userId;
      } else {
        mongoQuery.userIdString = query.userId.toString();
      }
    }
    
    if (query.type) {
      mongoQuery.type = query.type;
    }
    
    if (query.createdAt?.$gte) {
      mongoQuery.createdAt = mongoQuery.createdAt || {};
      mongoQuery.createdAt.$gte = query.createdAt.$gte;
    }
    
    if (query.createdAt?.$lte) {
      mongoQuery.createdAt = mongoQuery.createdAt || {};
      mongoQuery.createdAt.$lte = query.createdAt.$lte;
    }

    return await this.countDocuments(mongoQuery);
  } catch (err) {
    console.error('countEvents failed:', err.message);
    return 0;
  }
};

/**
 * Get distinct user IDs by time range (for DAU/WAU/MAU)
 */
eventSchema.statics.getDistinctUsers = async function(startDate, endDate) {
  try {
    const query = {};
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const results = await this.distinct('userIdString', query);
    return results.filter(id => id && id !== 'null' && id !== 'undefined');
  } catch (err) {
    console.error('getDistinctUsers failed:', err.message);
    return [];
  }
};

/**
 * Get event aggregations for analytics
 */
eventSchema.statics.getEventAggregations = async function(startDate, endDate, groupBy = 'day') {
  try {
    const dateFormat = groupBy === 'hour' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
    
    const pipeline = [
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ];

    return await this.aggregate(pipeline);
  } catch (err) {
    console.error('getEventAggregations failed:', err.message);
    return [];
  }
};

/**
 * Get user activity statistics
 */
eventSchema.statics.getUserActivityStats = async function(userId, startDate, endDate) {
  try {
    const query = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };
    
    if (mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    } else {
      query.userIdString = userId.toString();
    }

    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    return await this.aggregate(pipeline);
  } catch (err) {
    console.error('getUserActivityStats failed:', err.message);
    return [];
  }
};

/**
 * Anonymize user events (for account deletion)
 */
eventSchema.statics.anonymizeUserEvents = async function(userId) {
  try {
    const query = mongoose.Types.ObjectId.isValid(userId)
      ? { userId }
      : { userIdString: userId.toString() };

    await this.updateMany(query, {
      $set: {
        userId: null,
        userIdString: 'deleted_user'
      }
    });
  } catch (err) {
    console.error('anonymizeUserEvents failed:', err.message);
  }
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
