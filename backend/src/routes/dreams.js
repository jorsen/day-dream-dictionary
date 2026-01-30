const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const mongoose = require('mongoose');
const { User, Dream, Event } = require('../models');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { dreamLog } = require('../middleware/logger');
const { authenticate } = require('../middleware/auth');
const { checkQuota } = require('../middleware/quota');
const { logger } = require('../config/mongodb');

// Dynamic interpretation generator based on dream content
const generateDynamicInterpretation = (dreamText, interpretationType = 'basic', locale = 'en') => {
  const text = dreamText.toLowerCase();

  // Define symbol patterns and their meanings
  const symbolPatterns = {
    // Animals
    'dog': { symbol: 'dog', meaning: 'Dogs often represent loyalty, protection, and friendship. They may reflect your relationships or your protective instincts.', significance: 'medium' },
    'cat': { symbol: 'cat', meaning: 'Cats symbolize independence, mystery, and intuition. They may represent your independent nature or hidden aspects of yourself.', significance: 'medium' },
    'bird': { symbol: 'bird', meaning: 'Birds represent freedom, spirituality, and new perspectives. They often symbolize your desire for liberation or spiritual growth.', significance: 'high' },
    'snake': { symbol: 'snake', meaning: 'Snakes can represent transformation, healing, or hidden fears. They often symbolize change or renewal in your life.', significance: 'high' },
    'bear': { symbol: 'bear', meaning: 'Bears symbolize strength, protection, and introspection. They may represent your inner power or a need for solitude.', significance: 'high' },
    'wolf': { symbol: 'wolf', meaning: 'Wolves represent instinct, freedom, and social connections. They may reflect your wild nature or pack mentality.', significance: 'medium' },

    // Nature & Environment
    'water': { symbol: 'water', meaning: 'Water represents emotions, the unconscious mind, and cleansing. It may reflect your emotional state or need for renewal.', significance: 'high' },
    'fire': { symbol: 'fire', meaning: 'Fire symbolizes passion, transformation, and destruction. It may represent intense emotions or major life changes.', significance: 'high' },
    'mountain': { symbol: 'mountain', meaning: 'Mountains represent challenges, spiritual growth, and achievement. They may symbolize obstacles you need to overcome.', significance: 'medium' },
    'forest': { symbol: 'forest', meaning: 'Forests symbolize the unknown, mystery, and the subconscious. They may represent unexplored aspects of yourself.', significance: 'medium' },
    'ocean': { symbol: 'ocean', meaning: 'Oceans represent the vast unconscious mind, emotions, and the unknown. They may symbolize deep emotional currents.', significance: 'high' },

    // Actions & States
    'flying': { symbol: 'flying', meaning: 'Flying represents freedom, ambition, and transcendence. It may reflect your desire to rise above challenges or escape limitations.', significance: 'high' },
    'falling': { symbol: 'falling', meaning: 'Falling often represents loss of control, anxiety, or transitions. It may reflect feelings of insecurity or major life changes.', significance: 'high' },
    'running': { symbol: 'running', meaning: 'Running can represent pursuit, escape, or urgency. It may reflect your efforts to achieve goals or avoid something.', significance: 'medium' },
    'chasing': { symbol: 'being chased', meaning: 'Being chased represents avoidance, fear, or unresolved issues. It may reflect anxiety or something you\'re trying to escape.', significance: 'high' },
    'lost': { symbol: 'being lost', meaning: 'Being lost symbolizes confusion, lack of direction, or feeling overwhelmed. It may reflect uncertainty in your life path.', significance: 'high' },

    // People & Relationships
    'family': { symbol: 'family', meaning: 'Family represents your roots, support system, and personal history. They may reflect your relationships or inner dynamics.', significance: 'medium' },
    'friend': { symbol: 'friends', meaning: 'Friends represent social connections, support, and shared experiences. They may reflect your social life or need for companionship.', significance: 'medium' },
    'stranger': { symbol: 'stranger', meaning: 'Strangers represent the unknown, new opportunities, or aspects of yourself you haven\'t acknowledged.', significance: 'medium' },

    // Objects
    'house': { symbol: 'house', meaning: 'Houses represent the self, security, and personal life. Different rooms may symbolize different aspects of your personality.', significance: 'medium' },
    'door': { symbol: 'door', meaning: 'Doors symbolize opportunities, transitions, and new beginnings. They may represent choices or changes in your life.', significance: 'medium' },
    'key': { symbol: 'key', meaning: 'Keys represent access, solutions, and understanding. They may symbolize unlocking potential or finding answers.', significance: 'medium' },
    'mirror': { symbol: 'mirror', meaning: 'Mirrors represent self-reflection, truth, and self-awareness. They may reflect your self-image or need for introspection.', significance: 'high' }
  };

  // Analyze emotional tone based on keywords
  const getEmotionalTone = (text) => {
    const positiveWords = ['happy', 'joy', 'love', 'peace', 'freedom', 'success', 'beautiful', 'wonderful', 'amazing'];
    const negativeWords = ['scared', 'afraid', 'angry', 'sad', 'lost', 'trapped', 'chased', 'falling', 'dark', 'nightmare'];
    const anxiousWords = ['worried', 'nervous', 'anxious', 'stressed', 'overwhelmed', 'rushed', 'late'];

    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    const anxiousCount = anxiousWords.filter(word => text.includes(word)).length;

    if (positiveCount > negativeCount && positiveCount > anxiousCount) {
      return 'The dream evokes feelings of joy, freedom, and positivity, suggesting a hopeful and optimistic emotional state.';
    } else if (negativeCount > positiveCount && negativeCount > anxiousCount) {
      return 'The dream carries an intense emotional tone with elements of fear or anxiety, reflecting inner turmoil or unresolved concerns.';
    } else if (anxiousCount > positiveCount && anxiousCount > negativeCount) {
      return 'The dream suggests feelings of anxiety and urgency, indicating stress or pressure in your waking life.';
    } else {
      return 'The dream contains mixed emotions, suggesting complex feelings and internal conflicts that need exploration.';
    }
  };

  // Extract main themes based on content
  const getMainThemes = (text) => {
    const themes = [];

    if (text.includes('flying') || text.includes('sky') || text.includes('freedom')) {
      themes.push('freedom');
    }
    if (text.includes('chased') || text.includes('running') || text.includes('afraid') || text.includes('scared')) {
      themes.push('pursuit');
    }
    if (text.includes('lost') || text.includes('confused') || text.includes('searching')) {
      themes.push('exploration');
    }
    if (text.includes('family') || text.includes('friend') || text.includes('relationship')) {
      themes.push('relationships');
    }
    if (text.includes('water') || text.includes('ocean') || text.includes('swimming')) {
      themes.push('emotions');
    }
    if (text.includes('house') || text.includes('home') || text.includes('room')) {
      themes.push('security');
    }
    if (text.includes('death') || text.includes('dying') || text.includes('end')) {
      themes.push('transformation');
    }

    if (themes.length === 0) {
      themes.push('self-discovery', 'personal-growth');
    }

    return themes.slice(0, 3);
  };

  // Find relevant symbols in the dream text
  const getSymbols = (text) => {
    const foundSymbols = [];

    Object.keys(symbolPatterns).forEach(keyword => {
      if (text.includes(keyword)) {
        foundSymbols.push(symbolPatterns[keyword]);
      }
    });

    if (foundSymbols.length === 0) {
      foundSymbols.push({
        symbol: 'dream elements',
        meaning: 'The specific elements in your dream represent aspects of your subconscious mind trying to communicate with you.',
        significance: 'medium'
      });
    }

    return foundSymbols.slice(0, 3);
  };

  // Generate personal insight based on themes
  const getPersonalInsight = (themes, symbols) => {
    const theme = themes[0] || 'personal growth';
    const symbol = symbols[0]?.symbol || 'dream elements';

    const insights = {
      'freedom': `Your dream about ${symbol} suggests a deep desire for liberation and self-expression. You may be feeling constrained in some area of your life and seeking greater autonomy.`,
      'pursuit': `The theme of pursuit in your dream with ${symbol} may reflect anxiety or unresolved issues that you're trying to escape or confront in your waking life.`,
      'exploration': `Dreaming of ${symbol} indicates a journey of self-discovery and exploration. You may be navigating uncertainty or seeking new directions in life.`,
      'relationships': `The ${symbol} in your dream may represent your relationships and social connections. Consider how these elements reflect your interpersonal dynamics.`,
      'emotions': `The presence of ${symbol} suggests deep emotional currents affecting your subconscious. Pay attention to your feelings and emotional well-being.`,
      'security': `Dreaming of ${symbol} may reflect your need for security and stability. You might be seeking comfort or dealing with feelings of vulnerability.`,
      'transformation': `The ${symbol} symbolizes significant change and transformation. You may be undergoing or anticipating major life transitions.`
    };

    return insights[theme] || `Your dream about ${symbol} contains meaningful symbols that your subconscious is trying to bring to your attention.`;
  };

  // Generate guidance based on themes
  const getGuidance = (themes) => {
    const theme = themes[0] || 'personal growth';

    const guidance = {
      'freedom': 'Consider what areas of your life feel restrictive. Explore ways to create more freedom and self-expression in your daily life.',
      'pursuit': 'Reflect on what you might be avoiding in your waking life. Sometimes confronting our fears leads to greater peace and understanding.',
      'exploration': 'Trust your intuition as you navigate uncertainty. Your dreams may be guiding you toward new opportunities and discoveries.',
      'relationships': 'Examine your relationships and social connections. Consider how you can nurture meaningful connections and set healthy boundaries.',
      'emotions': 'Pay attention to your emotional well-being. Consider journaling your feelings or speaking with someone you trust about your inner experiences.',
      'security': 'Focus on building a sense of security within yourself. Practice self-care and create routines that provide stability and comfort.',
      'transformation': 'Embrace change as a natural part of growth. Trust that endings often lead to new beginnings and opportunities.'
    };

    return guidance[theme] || 'Take time to reflect on your dream and how it might relate to your current life circumstances. Dreams often provide valuable insights into our subconscious minds.';
  };

  // Generate the complete interpretation
  const mainThemes = getMainThemes(text);
  const symbols = getSymbols(text);
  const emotionalTone = getEmotionalTone(text);
  const personalInsight = getPersonalInsight(mainThemes, symbols);
  const guidance = getGuidance(mainThemes);

  return {
    mainThemes,
    emotionalTone,
    symbols,
    personalInsight,
    guidance
  };
};

// Validation middleware
const validateDreamSubmission = [
  body('dreamText')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Dream description must be between 10 and 5000 characters'),
  body('interpretationType')
    .optional()
    .isIn(['basic', 'deep', 'premium'])
    .withMessage('Invalid interpretation type'),
  body('userContext').optional().isObject(),
  body('locale').optional().isIn(['en', 'es'])
];

// Helper function to call OpenRouter API
const interpretDream = async (dreamText, locale = 'en', interpretationType = 'basic') => {
  const systemPrompt = `You are a professional dream interpreter with expertise in psychology, symbolism, and various cultural dream traditions. Provide insightful, supportive interpretations that help users understand their dreams better.

Return your response as a valid JSON object with the following structure:
{
  "mainThemes": ["theme1", "theme2", "theme3"],
  "emotionalTone": "description of the emotional tone",
  "symbols": [
    {
      "symbol": "symbol name",
      "meaning": "symbol interpretation",
      "significance": "high|medium|low"
    }
  ],
  "personalInsight": "personal insight text",
  "guidance": "actionable guidance text"
}

${interpretationType === 'deep' ? 'Include deeper psychological analysis and more detailed symbolism.' : ''}
${interpretationType === 'premium' ? 'Include comprehensive analysis with recurring patterns, psychological insights, and actionable steps.' : ''}

Language: ${locale === 'es' ? 'Spanish' : 'English'}`;

  const userPrompt = `Please interpret this dream: "${dreamText}"`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:20241022',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
        max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 2000,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://daydreamdictionary.com',
          'X-Title': 'Day Dream Dictionary',
          'Content-Type': 'application/json'
        }
      }
    );

    const interpretation = JSON.parse(response.data.choices[0].message.content);

    if (!interpretation.mainThemes || !interpretation.emotionalTone || !interpretation.symbols ||
        !interpretation.personalInsight || !interpretation.guidance) {
      throw new Error('Invalid interpretation structure received from AI');
    }

    return interpretation;
  } catch (error) {
    logger.error('OpenRouter API error:', error.response?.data || error.message);
    logger.info('Using dynamic interpretation based on user input');
    return generateDynamicInterpretation(dreamText, interpretationType, locale);
  }
};

// Submit and interpret a dream
router.post('/interpret',
  authenticate,
  checkQuota,
  validateDreamSubmission,
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user?.id;
    const {
      dreamText,
      interpretationType = 'basic',
      userContext = {},
      locale = 'en',
      tags = [],
      isRecurring = false
    } = req.body;

    try {
      // Start interpretation timer
      const startTime = Date.now();

      // Call AI interpretation function
      const interpretation = await interpretDream(dreamText, locale, interpretationType);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Calculate credits needed based on interpretation type
      let creditsNeeded = 1;
      if (interpretationType === 'deep') creditsNeeded = 3;
      if (interpretationType === 'premium') creditsNeeded = 5;

      // Check user subscription
      const user = await User.findById(userId);
      const hasActiveSubscription = user?.subscription?.status === 'active' && user?.subscription?.plan !== 'free';

      // Create dream document
      const dream = new Dream({
        userId,
        dreamText,
        interpretation,
        metadata: {
          interpretationType,
          creditsUsed: hasActiveSubscription ? 0 : creditsNeeded,
          processingTime,
          modelUsed: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:20241022',
          temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
          maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 2000
        },
        userContext,
        tags,
        isRecurring,
        locale,
        source: req.headers['x-source'] || 'web'
      });

      await dream.save();
      logger.info(`✅ Dream saved to MongoDB: ${dream._id}`);

      // Deduct credits if not on subscription
      if (!hasActiveSubscription && creditsNeeded > 0 && user) {
        await User.updateCredits(userId, creditsNeeded, 'subtract');
      }

      // Get remaining credits
      let creditsRemaining = 'unlimited';
      if (!hasActiveSubscription && user) {
        const updatedUser = await User.findById(userId);
        creditsRemaining = updatedUser?.credits || 0;
      }

      // Track events
      try {
        await Event.trackEvent(userId, 'dream_submitted', {
          dreamId: dream._id,
          interpretationType,
          creditsUsed: hasActiveSubscription ? 0 : creditsNeeded,
          processingTime,
        });

        await Event.trackEvent(userId, 'dream_interpreted', {
          dreamId: dream._id,
          interpretationType,
          hasSubscription: hasActiveSubscription
        });
      } catch (eventError) {
        logger.warn('Event tracking failed:', eventError.message);
      }

      // Log dream interpretation
      dreamLog(userId, dream._id.toString(), {
        interpretationType,
        creditsUsed: hasActiveSubscription ? 0 : creditsNeeded,
        processingTime,
      });

      res.status(201).json({
        message: `Dream interpreted successfully${hasActiveSubscription ? ' (Subscription)' : ` (${creditsNeeded} credits used)`}`,
        dream: {
          id: dream._id,
          dreamText: dream.dreamText,
          interpretation: dream.interpretation,
          metadata: dream.metadata,
          tags: dream.tags,
          isRecurring: dream.isRecurring,
          createdAt: dream.createdAt
        },
        quota: {
          hasSubscription: hasActiveSubscription,
          creditsUsed: hasActiveSubscription ? 0 : creditsNeeded,
          creditsRemaining: creditsRemaining,
          subscriptionTier: user?.subscription?.plan || null
        }
      });

    } catch (error) {
      next(error);
    }
  })
);

// Test endpoint for dream interpretation (bypasses authentication)
router.post('/test-interpret', validateDreamSubmission, catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    dreamText,
    interpretationType = 'basic',
    userContext = {},
    locale = 'en',
    tags = [],
    isRecurring = false
  } = req.body;

  try {
    const startTime = Date.now();
    const interpretation = await interpretDream(dreamText, locale, interpretationType);
    const processingTime = Date.now() - startTime;

    // Save to MongoDB with a test user ID
    const dream = new Dream({
      userId: new mongoose.Types.ObjectId(),
      dreamText,
      interpretation,
      metadata: {
        interpretationType,
        creditsUsed: 0,
        processingTime,
        modelUsed: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:20241022'
      },
      userContext,
      tags,
      isRecurring,
      locale,
      source: 'test'
    });

    await dream.save();

    res.status(201).json({
      message: 'Dream interpreted and stored successfully (test mode)',
      dream: {
        id: dream._id,
        dreamText: dream.dreamText,
        interpretation: dream.interpretation,
        metadata: dream.metadata,
        tags: dream.tags,
        isRecurring: dream.isRecurring,
        createdAt: dream.createdAt
      },
      savedToDatabase: true
    });

  } catch (error) {
    next(error);
  }
}));

// Get dream statistics
router.get('/stats', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const stats = await Dream.getUserStats(userId);
    res.json({ stats });
  } catch (error) {
    logger.error('Error fetching dream stats:', error);
    next(error);
  }
}));

// Get user's dream history (root endpoint)
router.get('/', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  try {
    // Check if user has enabled dream storage
    const user = await User.findById(userId);
    if (user?.preferences?.dreamStorage === false) {
      return res.json({
        message: 'Dream storage is disabled in your preferences',
        dreams: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1
      });
    }

    const result = await Dream.getUserDreams(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}));

// Get user's dream history
router.get('/history', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  try {
    const user = await User.findById(userId);
    if (user?.preferences?.dreamStorage === false) {
      return res.json({
        message: 'Dream storage is disabled in your preferences',
        dreams: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1
      });
    }

    const result = await Dream.getUserDreams(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}));

// Get single dream by ID
router.get('/:dreamId', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { dreamId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(dreamId)) {
      throw new AppError('Invalid dream ID', 400);
    }

    const dream = await Dream.findOne({
      _id: dreamId,
      userId,
      isDeleted: false
    });

    if (!dream) {
      throw new AppError('Dream not found', 404);
    }

    res.json({ dream });
  } catch (error) {
    next(error);
  }
}));

// Update dream (add tags, rating, etc.)
router.patch('/:dreamId', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { dreamId } = req.params;
  const updates = req.body;

  const allowedUpdates = ['tags', 'rating', 'userContext', 'isRecurring'];
  const requestedUpdates = Object.keys(updates);
  const isValidOperation = requestedUpdates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    throw new AppError('Invalid updates', 400);
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(dreamId)) {
      throw new AppError('Invalid dream ID', 400);
    }

    const dream = await Dream.findOneAndUpdate(
      { _id: dreamId, userId, isDeleted: false },
      { $set: updates },
      { new: true }
    );

    if (!dream) {
      throw new AppError('Dream not found', 404);
    }

    res.json({
      message: 'Dream updated successfully',
      dream
    });
  } catch (error) {
    next(error);
  }
}));

// Delete dream (soft delete)
router.delete('/:dreamId', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { dreamId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(dreamId)) {
      throw new AppError('Invalid dream ID', 400);
    }

    const dream = await Dream.findOneAndUpdate(
      { _id: dreamId, userId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!dream) {
      throw new AppError('Dream not found', 404);
    }

    res.json({
      message: 'Dream deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}));

// Search dreams
router.get('/search/query', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { q, page = 1, limit = 10 } = req.query;

  if (!q || q.length < 3) {
    throw new AppError('Search query must be at least 3 characters', 400);
  }

  try {
    const result = await Dream.searchDreams(userId, q, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}));

// Get recurring dream patterns
router.get('/patterns/recurring', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const result = await Dream.getRecurringPatterns(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}));

// PDF export for premium users
const PDFDocument = require('pdfkit');
const { requirePremiumFeature } = require('../middleware/quota');

router.get('/reports/pdf/:dreamId',
  authenticate,
  requirePremiumFeature('pdf_export'),
  catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const { dreamId } = req.params;

    try {
      if (!mongoose.Types.ObjectId.isValid(dreamId)) {
        throw new AppError('Invalid dream ID', 400);
      }

      const dream = await Dream.findOne({
        _id: dreamId,
        userId,
        isDeleted: false
      });

      if (!dream) {
        throw new AppError('Dream not found', 404);
      }

      // Create PDF
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="dream_${dreamId}.pdf"`);

      doc.pipe(res);

      doc.fontSize(18).text('Day Dream Dictionary - Dream Report', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text('Dream Text:');
      doc.fontSize(12).text(dream.dreamText);
      doc.moveDown();

      doc.fontSize(14).text('Interpretation:');
      const interp = dream.interpretation || {};
      doc.fontSize(12).text(`Main Themes: ${interp.mainThemes?.join(', ') || ''}`);
      doc.text(`Emotional Tone: ${interp.emotionalTone || ''}`);

      doc.text('Symbols:');
      (interp.symbols || []).forEach(s => {
        doc.text(`- ${s.symbol}: ${s.meaning} (${s.significance})`);
      });

      doc.text(`Personal Insight: ${interp.personalInsight || ''}`);
      doc.text(`Guidance: ${interp.guidance || ''}`);

      doc.end();

    } catch (error) {
      next(error);
    }
  })
);

module.exports = router;
