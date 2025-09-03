const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const {
  getUserProfile,
  getUserCredits,
  updateUserCredits,
  getUserSubscription,
  supabase
} = require('../config/supabase');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { dreamLog } = require('../middleware/logger');
const { authenticate } = require('../middleware/auth');
// const { checkQuota } = require('../middleware/quota'); // disabled for free mode

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
    
    // Validate the response structure
    if (!interpretation.mainThemes || !interpretation.emotionalTone || !interpretation.symbols || 
        !interpretation.personalInsight || !interpretation.guidance) {
      throw new Error('Invalid interpretation structure received from AI');
    }

    return interpretation;
  } catch (error) {
    console.error('OpenRouter API error:', error.response?.data || error.message);
    throw new AppError('Failed to interpret dream. Please try again.', 500);
  }
};

// Submit and interpret a dream
router.post('/interpret', 
  authenticate,
  validateDreamSubmission,
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { 
      dreamText, 
      interpretationType = 'basic',
      userContext = {},
      locale = 'en',
      tags = [],
      isRecurring = false
    } = req.body;

    try {
      // MVP mode: Make all interpretations free (no payment, no credits)
      const creditsNeeded = 0;
      const hasActiveSubscription = true;
      const isFreeQuota = true;

      // Start interpretation timer
      const startTime = Date.now();
      
      // Get interpretation from OpenRouter
      const interpretation = await interpretDream(dreamText, locale, interpretationType);
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      
      // Save dream to Supabase instead of MongoDB
      const dreamData = {
        user_id: userId,
        dream_text: dreamText,
        interpretation,
        metadata: {
          interpretationType,
          creditsUsed: creditsNeeded,
          processingTime,
          modelUsed: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet:20241022',
          temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
          maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 2000
        },
        user_context: userContext,
        tags,
        is_recurring: isRecurring,
        locale,
        source: req.headers['x-source'] || 'web'
      };
      
      // Try to save to Supabase dreams table (create table if it doesn't exist)
      const { data: dream, error: dreamError } = await supabase
        .from('dreams')
        .insert([dreamData])
        .select()
        .single();
      
      if (dreamError) {
        console.warn('Could not save dream to database:', dreamError);
        // Continue without saving - interpretation still works
      }
      
      // Skip credit deduction in MVP until payments are enabled
      // if (!hasActiveSubscription && !isFreeQuota) {
      //   await updateUserCredits(userId, creditsNeeded, 'subtract');
      // }
      
      // Track events (optional - skip if MongoDB not available)
      try {
        const Event = require('../models/Event');
        await Event.trackEvent(userId, 'dream_submitted', {
          dreamId: dream?.id || 'temp-id',
          interpretationType,
          creditsUsed: creditsNeeded,
          processingTime
        });
        
        await Event.trackEvent(userId, 'dream_interpreted', {
          dreamId: dream?.id || 'temp-id',
          interpretationType,
          hasSubscription: hasActiveSubscription
        });
        
        if (!hasActiveSubscription) {
          await Event.trackEvent(userId, 'credits_used', {
            amount: creditsNeeded,
            purpose: 'dream_interpretation',
            dreamId: dream?.id || 'temp-id'
          });
        }
      } catch (eventError) {
        console.log('Event tracking skipped (MongoDB not available)');
      }
      
      // Log dream interpretation
      dreamLog(userId, dream?.id || 'temp-id', {
        interpretationType,
        creditsUsed: creditsNeeded,
        processingTime
      });
      
      res.status(201).json({
        message: req.t('dreams:interpretedSuccess'),
        dream: {
          id: dream?.id || Date.now().toString(),
          dreamText: dreamText,
          interpretation: interpretation,
          metadata: dreamData.metadata,
          tags: tags,
          isRecurring: isRecurring,
          createdAt: dream?.created_at || new Date().toISOString()
        },
        creditsRemaining: 'unlimited' // Free mode - always unlimited
      });
      
    } catch (error) {
      next(error);
    }
  })
);

// Get user's dream history
router.get('/history', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const {
    page = 1,
    limit = 10,
    sortBy = 'created_at',
    order = 'desc',
    filter = {}
  } = req.query;
  
  try {
    // Check if user has enabled dream storage
    const profile = await getUserProfile(userId);
    if (profile?.preferences?.dreamStorage === false) {
      return res.json({
        message: req.t('dreams:storageDisabled'),
        dreams: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: 1
      });
    }
    
    // Get dreams from Supabase
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    let query = supabase
      .from('dreams')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order(sortBy, { ascending: order === 'asc' })
      .range(from, to);
    
    const { data: dreams, error, count } = await query;
    
    if (error) {
      console.error('Error fetching dreams:', error);
      // Fallback to empty response
      return res.json({
        dreams: [],
        totalCount: 0,
        totalPages: 0,
        currentPage: page
      });
    }
    
    res.json({
      dreams: dreams || [],
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: page
    });
    
  } catch (error) {
    next(error);
  }
}));

// Get single dream by ID
router.get('/:dreamId', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { dreamId } = req.params;
  
  try {
    const { data: dream, error } = await supabase
      .from('dreams')
      .select('*')
      .eq('id', dreamId)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();
    
    if (error || !dream) {
      throw new AppError('Dream not found', 404);
    }
    
    res.json({
      dream
    });
    
  } catch (error) {
    next(error);
  }
}));

// Update dream (add tags, rating, etc.)
router.patch('/:dreamId', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { dreamId } = req.params;
  const updates = req.body;
  
  // Only allow certain fields to be updated
  const allowedUpdates = ['tags', 'rating', 'user_context', 'is_recurring'];
  const requestedUpdates = Object.keys(updates);
  const isValidOperation = requestedUpdates.every(update => allowedUpdates.includes(update));
  
  if (!isValidOperation) {
    throw new AppError('Invalid updates', 400);
  }
  
  try {
    // Convert field names to snake_case for Supabase
    const supabaseUpdates = {};
    if (updates.tags) supabaseUpdates.tags = updates.tags;
    if (updates.rating) supabaseUpdates.rating = updates.rating;
    if (updates.userContext) supabaseUpdates.user_context = updates.userContext;
    if (updates.isRecurring) supabaseUpdates.is_recurring = updates.isRecurring;
    
    const { data: dream, error } = await supabase
      .from('dreams')
      .update(supabaseUpdates)
      .eq('id', dreamId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error || !dream) {
      throw new AppError('Dream not found', 404);
    }
    
    res.json({
      message: req.t('dreams:updated'),
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
    const { data: dream, error } = await supabase
      .from('dreams')
      .update({ is_deleted: true })
      .eq('id', dreamId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error || !dream) {
      throw new AppError('Dream not found', 404);
    }
    
    res.json({
      message: req.t('dreams:deleted')
    });
    
  } catch (error) {
    next(error);
  }
}));

// Get dream statistics
router.get('/stats/summary', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    // Get dream statistics from Supabase
    const { data: dreams, error } = await supabase
      .from('dreams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false);
    
    if (error) {
      console.error('Error fetching dream stats:', error);
      return res.json({
        stats: {
          totalDreams: 0,
          recurringDreams: 0,
          averageRating: 0,
          topThemes: []
        }
      });
    }
    
    // Calculate statistics
    const stats = {
      totalDreams: dreams?.length || 0,
      recurringDreams: dreams?.filter(d => d.is_recurring).length || 0,
      averageRating: 0,
      topThemes: []
    };
    
    // Calculate average rating if dreams have ratings
    const ratedDreams = dreams?.filter(d => d.rating) || [];
    if (ratedDreams.length > 0) {
      const totalRating = ratedDreams.reduce((sum, d) => {
        const avgRating = (d.rating.accuracy + d.rating.helpfulness) / 2;
        return sum + avgRating;
      }, 0);
      stats.averageRating = totalRating / ratedDreams.length;
    }
    
    // Extract top themes
    const themeCounts = {};
    dreams?.forEach(dream => {
      if (dream.interpretation?.mainThemes) {
        dream.interpretation.mainThemes.forEach(theme => {
          themeCounts[theme] = (themeCounts[theme] || 0) + 1;
        });
      }
    });
    
    stats.topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([theme, count]) => ({ theme, count }));
    
    res.json({
      stats
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
    // Search in Supabase using text search
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    const { data: dreams, error } = await supabase
      .from('dreams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .or(`dream_text.ilike.%${q}%,tags.cs.{${q}}`)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (error) {
      console.error('Error searching dreams:', error);
      return res.json({
        dreams: [],
        query: q,
        page,
        limit
      });
    }
    
    res.json({
      dreams: dreams || [],
      query: q,
      page,
      limit
    });
    
  } catch (error) {
    next(error);
  }
}));

// Get recurring dream patterns
router.get('/patterns/recurring', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const { data: recurringDreams, error } = await supabase
      .from('dreams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_recurring', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching recurring dreams:', error);
      return res.json({
        patterns: {},
        totalRecurringDreams: 0
      });
    }
    
    // Group by recurring pattern
    const patterns = {};
    recurringDreams?.forEach(dream => {
      const patternId = dream.recurring_dream_id || dream.id;
      if (!patterns[patternId]) {
        patterns[patternId] = {
          firstOccurrence: dream.created_at,
          lastOccurrence: dream.created_at,
          count: 0,
          themes: new Set(),
          dreams: []
        };
      }
      patterns[patternId].count++;
      patterns[patternId].lastOccurrence = dream.created_at;
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
    
    res.json({
      patterns,
      totalRecurringDreams: recurringDreams?.length || 0
    });
    
  } catch (error) {
    next(error);
  }
}));
// PDF export for premium users
const PDFDocument = require('pdfkit');
const { requirePremiumFeature } = require('../middleware/quota');

// GET /api/reports/pdf/:id
router.get('/reports/pdf/:dreamId',
  authenticate,
  requirePremiumFeature('pdf_export'),
  catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const { dreamId } = req.params;

    try {
      // Fetch dream from Supabase
      const { data: dream, error } = await supabase
        .from('dreams')
        .select('*')
        .eq('id', dreamId)
        .eq('user_id', userId)
        .single();

      if (error || !dream) {
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
      doc.fontSize(12).text(dream.dream_text);
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