const mongoose = require('mongoose');

const symbolSchema = new mongoose.Schema({
  symbol: String,
  meaning: String,
  significance: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, { _id: false });

const interpretationSchema = new mongoose.Schema({
  mainThemes: [String],
  emotionalTone: String,
  symbols: [symbolSchema],
  personalInsight: String,
  guidance: String
}, { _id: false });

const metadataSchema = new mongoose.Schema({
  interpretationType: {
    type: String,
    enum: ['basic', 'deep', 'premium'],
    default: 'basic'
  },
  creditsUsed: { type: Number, default: 1 },
  processingTime: Number,
  modelUsed: String,
  temperature: Number,
  maxTokens: Number
}, { _id: false });

const dreamSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  dreamText: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 5000
  },
  interpretation: interpretationSchema,
  metadata: metadataSchema,
  userContext: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  tags: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDreamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dream'
  },
  locale: {
    type: String,
    enum: ['en', 'es'],
    default: 'en'
  },
  source: {
    type: String,
    default: 'web'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes for faster queries
dreamSchema.index({ userId: 1, createdAt: -1 });
dreamSchema.index({ userId: 1, isDeleted: 1 });
dreamSchema.index({ tags: 1 });
dreamSchema.index({ isRecurring: 1 });
dreamSchema.index({ 'interpretation.mainThemes': 1 });

// Text index for search
dreamSchema.index({ dreamText: 'text', tags: 'text' });

// Static method to get user's dream history
dreamSchema.statics.getUserDreams = async function(userId, options = {}) {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc',
    filter = {}
  } = options;

  const query = {
    userId,
    isDeleted: false,
    ...filter
  };

  const skip = (page - 1) * limit;
  const sortOrder = order === 'desc' ? -1 : 1;

  const [dreams, totalCount] = await Promise.all([
    this.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    dreams,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};

// Static method to get dream statistics
dreamSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $facet: {
        totalDreams: [{ $count: 'count' }],
        thisMonth: [
          {
            $match: {
              createdAt: {
                $gte: new Date(new Date().setDate(1))
              }
            }
          },
          { $count: 'count' }
        ],
        recurringDreams: [
          { $match: { isRecurring: true } },
          { $count: 'count' }
        ],
        averageRating: [
          { $match: { rating: { $exists: true, $ne: null } } },
          { $group: { _id: null, avg: { $avg: '$rating' } } }
        ],
        creditsUsed: [
          { $group: { _id: null, total: { $sum: '$metadata.creditsUsed' } } }
        ],
        topThemes: [
          { $unwind: '$interpretation.mainThemes' },
          { $group: { _id: '$interpretation.mainThemes', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $project: { theme: '$_id', count: 1, _id: 0 } }
        ]
      }
    }
  ]);

  const result = stats[0];
  
  return {
    totalDreams: result.totalDreams[0]?.count || 0,
    thisMonth: result.thisMonth[0]?.count || 0,
    recurringDreams: result.recurringDreams[0]?.count || 0,
    averageRating: Math.round((result.averageRating[0]?.avg || 0) * 10) / 10,
    creditsUsed: result.creditsUsed[0]?.total || 0,
    topThemes: result.topThemes || []
  };
};

// Static method to search dreams
dreamSchema.statics.searchDreams = async function(userId, query, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const searchQuery = {
    userId,
    isDeleted: false,
    $or: [
      { dreamText: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };

  const [dreams, totalCount] = await Promise.all([
    this.find(searchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(searchQuery)
  ]);

  return {
    dreams,
    totalCount,
    query,
    page,
    limit
  };
};

// Static method to get recurring patterns
dreamSchema.statics.getRecurringPatterns = async function(userId) {
  const recurringDreams = await this.find({
    userId,
    isDeleted: false,
    isRecurring: true
  }).sort({ createdAt: -1 }).lean();

  const patterns = {};
  
  recurringDreams.forEach(dream => {
    const patternId = dream.recurringDreamId?.toString() || dream._id.toString();
    
    if (!patterns[patternId]) {
      patterns[patternId] = {
        firstOccurrence: dream.createdAt,
        lastOccurrence: dream.createdAt,
        count: 0,
        themes: new Set(),
        dreams: []
      };
    }
    
    patterns[patternId].count++;
    patterns[patternId].lastOccurrence = dream.createdAt;
    
    if (dream.interpretation?.mainThemes) {
      dream.interpretation.mainThemes.forEach(theme => {
        patterns[patternId].themes.add(theme);
      });
    }
    
    patterns[patternId].dreams.push(dream);
  });

  // Convert sets to arrays
  Object.keys(patterns).forEach(key => {
    patterns[key].themes = Array.from(patterns[key].themes);
  });

  return {
    patterns,
    totalRecurringDreams: recurringDreams.length
  };
};

const Dream = mongoose.model('Dream', dreamSchema);

module.exports = Dream;
