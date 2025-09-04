const axios = require('axios');

/**
 * AI Provider Configuration
 * Supports multiple AI providers with automatic fallback
 */

// Provider configurations
const PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    models: {
      default: 'anthropic/claude-3.5-sonnet:20241022',
      fast: 'meta-llama/llama-3.1-8b-instruct:free',
      premium: 'anthropic/claude-3-5-sonnet-20241022'
    },
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://daydreamdictionary.com',
      'X-Title': 'Day Dream Dictionary',
      'Content-Type': 'application/json'
    })
  },

  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: {
      default: 'gpt-4',
      fast: 'gpt-3.5-turbo',
      premium: 'gpt-4-turbo-preview'
    },
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    })
  },

  anthropic: {
    name: 'Anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    models: {
      default: 'claude-3-5-sonnet-20241022',
      fast: 'claude-3-haiku-20240307',
      premium: 'claude-3-5-sonnet-20241022'
    },
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    })
  }
};

/**
 * Get the current active provider based on environment variables
 */
function getActiveProvider() {
  // Priority: OpenRouter > OpenAI > Anthropic
  if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'YOUR_NEW_OPENROUTER_API_KEY_HERE') {
    return { provider: PROVIDERS.openrouter, key: process.env.OPENROUTER_API_KEY, type: 'openrouter' };
  }

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    return { provider: PROVIDERS.openai, key: process.env.OPENAI_API_KEY, type: 'openai' };
  }

  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
    return { provider: PROVIDERS.anthropic, key: process.env.ANTHROPIC_API_KEY, type: 'anthropic' };
  }

  // No valid provider found
  return null;
}

/**
 * Interpret dream using the active AI provider
 */
async function interpretDream(dreamText, locale = 'en', interpretationType = 'basic') {
  const activeProvider = getActiveProvider();

  if (!activeProvider) {
    console.log('No valid AI provider configured - using mock interpretation');
    return getMockInterpretation(dreamText, interpretationType, locale);
  }

  const { provider, key, type } = activeProvider;
  const model = provider.models[interpretationType] || provider.models.default;

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
    let response;

    if (type === 'anthropic') {
      // Anthropic API format
      response = await axios.post(
        `${provider.baseURL}/messages`,
        {
          model: model,
          max_tokens: 2000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        },
        {
          headers: provider.headers(key)
        }
      );

      const interpretation = JSON.parse(response.data.content[0].text);
      return validateInterpretation(interpretation);

    } else {
      // OpenAI/OpenRouter format
      response = await axios.post(
        `${provider.baseURL}/chat/completions`,
        {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        },
        {
          headers: provider.headers(key)
        }
      );

      const interpretation = JSON.parse(response.data.choices[0].message.content);
      return validateInterpretation(interpretation);
    }

  } catch (error) {
    console.error(`${provider.name} API error:`, error.response?.data || error.message);

    // Check for specific error types
    if (error.response?.data?.error?.message?.includes('Key limit exceeded') ||
        error.response?.data?.error?.message?.includes('quota exceeded') ||
        error.response?.data?.error?.message?.includes('insufficient funds')) {
      console.log(`${provider.name} API limit exceeded - using mock interpretation`);
      return getMockInterpretation(dreamText, interpretationType, locale);
    }

    // For other errors, also fallback to mock
    console.log(`${provider.name} API error - using mock interpretation`);
    return getMockInterpretation(dreamText, interpretationType, locale);
  }
}

/**
 * Validate interpretation structure
 */
function validateInterpretation(interpretation) {
  if (!interpretation.mainThemes || !interpretation.emotionalTone ||
      !interpretation.symbols || !interpretation.personalInsight || !interpretation.guidance) {
    throw new Error('Invalid interpretation structure received from AI');
  }
  return interpretation;
}

/**
 * Dynamic interpretation generator based on dream content
 */
function generateDynamicInterpretation(dreamText, interpretationType = 'basic', locale = 'en') {
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

    // Add default themes if none found
    if (themes.length === 0) {
      themes.push('self-discovery', 'personal-growth');
    }

    return themes.slice(0, 3); // Limit to 3 main themes
  };

  // Find relevant symbols in the dream text
  const getSymbols = (text) => {
    const foundSymbols = [];

    Object.keys(symbolPatterns).forEach(keyword => {
      if (text.includes(keyword)) {
        foundSymbols.push(symbolPatterns[keyword]);
      }
    });

    // If no specific symbols found, add some general ones
    if (foundSymbols.length === 0) {
      foundSymbols.push({
        symbol: 'dream elements',
        meaning: 'The specific elements in your dream represent aspects of your subconscious mind trying to communicate with you.',
        significance: 'medium'
      });
    }

    return foundSymbols.slice(0, 3); // Limit to 3 symbols
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
}

/**
 * Get mock interpretation for fallback - now uses dynamic interpretation
 */
function getMockInterpretation(dreamText = "I dreamed of flying high in the sky", interpretationType = 'basic', locale = 'en') {
  console.log('Using dynamic interpretation based on user input:', dreamText.substring(0, 50) + '...');
  return generateDynamicInterpretation(dreamText, interpretationType, locale);
}

/**
 * Get provider status
 */
function getProviderStatus() {
  const activeProvider = getActiveProvider();

  if (!activeProvider) {
    return {
      status: 'no_provider',
      message: 'No AI provider configured',
      provider: null
    };
  }

  return {
    status: 'active',
    message: `${activeProvider.provider.name} is active`,
    provider: activeProvider.type,
    model: activeProvider.provider.models.default
  };
}

module.exports = {
  interpretDream,
  getProviderStatus,
  getMockInterpretation,
  PROVIDERS
};
