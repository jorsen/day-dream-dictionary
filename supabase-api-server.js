const http = require('http');
const url = require('url');

// Supabase configuration
const SUPABASE_URL = 'https://gwgjckczyscpaozlevpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTExNzMsImV4cCI6MjA3MjQ4NzE3M30.gKKl8PoJ7vDt9UWwY9yQv_V3Qr_hA5KsrwjK__XU1Bo';

// In-memory storage for dreams (will sync to Supabase when possible)
let dreamStorage = [];
let dreamIdCounter = 1;

// User management
const users = new Map();
const userSubscriptions = new Map();
const userCredits = new Map();
const userPurchases = new Map();

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        monthlyLimits: {
            basic: 5,
            deep: 1
        },
        features: ['basic_interpretations', 'limited_history', 'ads'],
        description: '5 basic + 1 deep interpretation per month'
    },
    basic: {
        name: 'Basic',
        price: 4.99,
        monthlyLimits: {
            basic: 20,
            deep: 5
        },
        features: ['basic_interpretations', 'deep_interpretations', 'unlimited_history', 'pdf_export', 'no_ads'],
        description: '20 basic + 5 deep interpretations per month'
    },
    pro: {
        name: 'Pro',
        price: 12.99,
        monthlyLimits: {
            basic: -1, // unlimited
            deep: -1  // unlimited
        },
        features: ['unlimited_interpretations', 'analytics', 'voice_journaling', 'reminders', 'symbol_encyclopedia', 'no_ads'],
        description: 'Unlimited interpretations + premium features'
    }
};

// Credit packs configuration
const CREDIT_PACKS = {
    small: { credits: 10, price: 9.99, bonus: 0 },
    medium: { credits: 25, price: 19.99, bonus: 5 },
    large: { credits: 60, price: 39.99, bonus: 15 }
};

// Add-on features
const ADD_ONS = {
    remove_ads: { price: 1.99, features: ['no_ads'] },
    life_season_report: { price: 14.99, features: ['life_season_report'] },
    recurring_dream_map: { price: 9.99, features: ['recurring_dream_map'] },
    couples_report: { price: 19.99, features: ['couples_report'] },
    lucid_kit: { price: 24.99, features: ['lucid_dreaming_kit'] },
    therapist_export: { price: 29.99, features: ['therapist_ready_export'] }
};

// Credit costs for different features
const CREDIT_COSTS = {
    basic_interpretation: 1,
    deep_interpretation: 3,
    analytics_report: 2,
    voice_journaling: 1
};

// Initialize user data
const initializeUserData = (userId) => {
    if (!userSubscriptions.has(userId)) {
        userSubscriptions.set(userId, {
            plan: 'basic',
            startDate: new Date().toISOString(),
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            features: [...SUBSCRIPTION_PLANS.basic.features],
            monthlyUsage: { basic: 0, deep: 0 }
        });
    }
    
    if (!userCredits.has(userId)) {
        userCredits.set(userId, 0); // Start with 0 credits for new users
    }
    
    if (!userPurchases.has(userId)) {
        userPurchases.set(userId, []);
    }
};

// Check user credits and subscription limits
const checkUserLimits = (userId, interpretationType) => {
    initializeUserData(userId);
    
    const subscription = userSubscriptions.get(userId);
    const credits = userCredits.get(userId);
    const plan = SUBSCRIPTION_PLANS[subscription.plan];
    
    // Pro plan users have unlimited access - no credit or monthly limits
    if (subscription.plan === 'pro') {
        return { allowed: true, unlimited: true };
    }
    
    // Check if user has enough credits
    const creditCost = interpretationType === 'deep' ? CREDIT_COSTS.deep_interpretation : CREDIT_COSTS.basic_interpretation;
    if (credits < creditCost) {
        return { allowed: false, reason: 'insufficient_credits', creditsNeeded: creditCost };
    }
    
    // Check monthly limits for free/basic plans
    if (plan.monthlyLimits[interpretationType] !== -1) {
        const usage = subscription.monthlyUsage[interpretationType];
        if (usage >= plan.monthlyLimits[interpretationType]) {
            return { allowed: false, reason: 'monthly_limit_exceeded', limit: plan.monthlyLimits[interpretationType] };
        }
    }
    
    return { allowed: true };
};

// Consume credits and update usage
const consumeCredits = (userId, interpretationType) => {
    const subscription = userSubscriptions.get(userId);
    
    // Pro plan users don't consume credits
    if (subscription.plan === 'pro') {
        subscription.monthlyUsage[interpretationType]++;
        return {
            creditsRemaining: 'unlimited',
            monthlyUsage: subscription.monthlyUsage,
            unlimited: true
        };
    }
    
    // Regular credit consumption for free/basic plans
    const creditCost = interpretationType === 'deep' ? CREDIT_COSTS.deep_interpretation : CREDIT_COSTS.basic_interpretation;
    const currentCredits = userCredits.get(userId);
    userCredits.set(userId, currentCredits - creditCost);
    
    subscription.monthlyUsage[interpretationType]++;
    
    return {
        creditsRemaining: userCredits.get(userId),
        monthlyUsage: subscription.monthlyUsage,
        unlimited: false
    };
};

// Purchase credit packs
const purchaseCreditPack = (userId, packSize) => {
    initializeUserData(userId);
    const pack = CREDIT_PACKS[packSize];
    if (!pack) {
        throw new Error('Invalid pack size');
    }
    
    const currentCredits = userCredits.get(userId);
    const totalCredits = pack.credits + pack.bonus;
    userCredits.set(userId, currentCredits + totalCredits);
    
    const purchase = {
        id: Date.now().toString(),
        type: 'credit_pack',
        packSize: packSize,
        credits: totalCredits,
        price: pack.price,
        purchaseDate: new Date().toISOString()
    };
    
    const purchases = userPurchases.get(userId);
    purchases.push(purchase);
    
    return {
        success: true,
        creditsAdded: totalCredits,
        newBalance: userCredits.get(userId),
        purchase
    };
};

// Upgrade subscription
const upgradeSubscription = (userId, newPlan) => {
    initializeUserData(userId);
    const plan = SUBSCRIPTION_PLANS[newPlan];
    if (!plan) {
        throw new Error('Invalid subscription plan');
    }
    
    const subscription = userSubscriptions.get(userId);
    subscription.plan = newPlan;
    subscription.features = [...plan.features];
    subscription.startDate = new Date().toISOString();
    subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    subscription.monthlyUsage = { basic: 0, deep: 0 }; // Reset usage for new billing cycle
    
    return {
        success: true,
        newPlan: newPlan,
        features: subscription.features,
        nextBillingDate: subscription.nextBillingDate
    };
};

// Helper function to extract user ID from JWT token
const extractUserIdFromToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    // Mock JWT token format: mock-jwt-token-{userId}-{timestamp}
    const match = token.match(/^mock-jwt-token-(.+)-\d+$/);
    return match ? match[1] : null;
};


    // Helper function to make HTTP requests to Supabase
async function makeSupabaseRequest(method, endpoint, data = null) {
    const options = {
        hostname: 'gwgjckczyscpaozlevpe.supabase.co',
        port: 443,
        path: `/rest/v1/${endpoint}`,
        method: method,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };

    if (data) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    return new Promise((resolve, reject) => {
        const req = require('https').request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(body);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (err) => {
            console.log('Supabase connection failed, using local storage:', err.message);
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// Comprehensive dream symbol database with accurate meanings
const dreamSymbols = {
    // Flying and Movement
    flying: {
        meaning: "Freedom, transcendence, rising above problems, spiritual elevation",
        significance: "high",
        context: "Often represents desire for freedom or escaping limitations"
    },
    falling: {
        meaning: "Loss of control, anxiety, fear of failure, letting go",
        significance: "high", 
        context: "May indicate insecurity or major life changes"
    },
    running: {
        meaning: "Pursuit of goals, escaping threats, urgency in life",
        significance: "medium",
        context: "Can represent either chasing dreams or running from problems"
    },
    
    // Water Elements
    water: {
        meaning: "Emotions, subconscious mind, purification, intuition",
        significance: "high",
        context: "Clear water = clarity, turbulent water = emotional turmoil"
    },
    ocean: {
        meaning: "Vast unconscious, spiritual depth, mystery of life",
        significance: "high",
        context: "Calm ocean = peace, stormy ocean = emotional unrest"
    },
    rain: {
        meaning: "Cleansing, renewal, emotional release, sadness",
        significance: "medium",
        context: "Gentle rain = blessing, storm = overwhelming emotions"
    },
    river: {
        meaning: "Life journey, flow of time, transition, personal growth",
        significance: "medium",
        context: "Flowing river = progress, blocked river = obstacles"
    },
    
    // Animals
    snake: {
        meaning: "Transformation, healing, hidden fears, wisdom, temptation",
        significance: "high",
        context: "Can represent both positive (healing) and negative (deception) aspects"
    },
    dog: {
        meaning: "Loyalty, friendship, protection, instinctual nature",
        significance: "medium",
        context: "Friendly dog = trusted relationships, aggressive dog = betrayal fears"
    },
    cat: {
        meaning: "Independence, intuition, feminine energy, mystery",
        significance: "medium",
        context: "Can represent self-reliance or mysterious aspects of self"
    },
    bird: {
        meaning: "Spirituality, freedom, messages from unconscious, aspirations",
        significance: "medium",
        context: "Flying birds = freedom, caged birds = feeling trapped"
    },
    fish: {
        meaning: "Spiritual nourishment, creativity, abundance, deeper consciousness",
        significance: "medium",
        context: "Swimming fish = emotional health, dead fish = lost opportunities"
    },
    
    // Nature Elements
    tree: {
        meaning: "Growth, life, connection to earth/universe, family roots",
        significance: "high",
        context: "Strong tree = stability, falling tree = major life change"
    },
    forest: {
        meaning: "Unconscious mind, mystery, exploration, feeling lost",
        significance: "medium",
        context: "Dark forest = unknown aspects, sunny forest = clarity"
    },
    mountain: {
        meaning: "Obstacles, goals, spiritual elevation, challenges",
        significance: "medium",
        context: "Climbing = ambition, at summit = achievement"
    },
    fire: {
        meaning: "Passion, transformation, destruction, purification, anger",
        significance: "high",
        context: "Controlled fire = creativity, wildfire = destructive emotions"
    },
    flower: {
        meaning: "Beauty, growth, blossoming potential, fragility",
        significance: "medium",
        context: "Blooming flowers = new beginnings, wilted = missed opportunities"
    },
    
    // People and Relationships
    baby: {
        meaning: "New beginnings, innocence, vulnerability, potential",
        significance: "medium",
        context: "Can represent new projects or aspects of self"
    },
    death: {
        meaning: "Transformation, endings, new beginnings, letting go",
        significance: "high",
        context: "Usually symbolic of change, not literal death"
    },
    wedding: {
        meaning: "Union of opposites, commitment, new beginnings, integration",
        significance: "medium",
        context: "Can represent merging different aspects of self"
    },
    
    // Buildings and Structures
    house: {
        meaning: "Self, psyche, security, personal identity",
        significance: "high",
        context: "Different rooms represent different aspects of psyche"
    },
    door: {
        meaning: "Opportunities, transitions, choices, new paths",
        significance: "medium",
        context: "Open door = opportunity, locked door = obstacles"
    },
    window: {
        meaning: "Perspective, insight, opportunities, view of world",
        significance: "medium",
        context: "Clean window = clarity, broken = distorted perception"
    },
    stairs: {
        meaning: "Progress, ascension, connection between levels of consciousness",
        significance: "medium",
        context: "Going up = spiritual growth, going down = exploring unconscious"
    },
    
    // Objects and Items
    car: {
        meaning: "Life journey, personal drive, control over life direction",
        significance: "medium",
        context: "Driving = in control, passenger = letting others direct"
    },
    key: {
        meaning: "Solutions, access, knowledge, opportunities",
        significance: "medium",
        context: "Finding key = discovering solutions, losing key = missed opportunities"
    },
    mirror: {
        meaning: "Self-reflection, truth, self-awareness, inner truth",
        significance: "medium",
        context: "Clear mirror = self-acceptance, broken = distorted self-image"
    },
    phone: {
        meaning: "Communication, connection, messages from unconscious",
        significance: "low",
        context: "Ringing phone = need to communicate, broken = communication issues"
    },
    
    // Colors
    red: {
        meaning: "Passion, anger, love, energy, danger, vitality",
        significance: "medium",
        context: "Can represent intense emotions or warning"
    },
    blue: {
        meaning: "Calm, spirituality, sadness, truth, tranquility",
        significance: "medium",
        context: "Light blue = peace, dark blue = depression"
    },
    green: {
        meaning: "Growth, healing, nature, jealousy, renewal",
        significance: "medium",
        context: "Can represent both positive (growth) and negative (envy)"
    },
    black: {
        meaning: "Unknown, unconscious, mystery, death, potential",
        significance: "medium",
        context: "Can represent fear or untapped potential"
    },
    white: {
        meaning: "Purity, innocence, spirituality, new beginnings",
        significance: "medium",
        context: "Usually positive, representing clarity and truth"
    },
    
    // Actions and States
    crying: {
        meaning: "Emotional release, healing, sadness, processing grief",
        significance: "medium",
        context: "Often represents need for emotional expression"
    },
    laughing: {
        meaning: "Joy, relief, irony, recognition of truth",
        significance: "low",
        context: "Can represent release of tension or insight"
    },
    hiding: {
        meaning: "Avoidance, fear, protection, need for safety",
        significance: "medium",
        context: "May indicate avoiding uncomfortable truths"
    },
    searching: {
        meaning: "Seeking answers, looking for direction, self-discovery",
        significance: "medium",
        context: "What you're searching for is as important as the search itself"
    }
};

// Emotional tones and their indicators
const emotionalIndicators = {
    joyful: ['happy', 'laughing', 'smiling', 'celebrating', 'dancing', 'singing'],
    fearful: ['scared', 'running', 'hiding', 'screaming', 'nightmare', 'terrified'],
    peaceful: ['calm', 'serene', 'quiet', 'meditating', 'floating', 'resting'],
    anxious: ['worried', 'rushing', 'late', 'lost', 'confused', 'overwhelmed'],
    angry: ['fighting', 'yelling', 'breaking', 'arguing', 'frustrated', 'aggressive'],
    sad: ['crying', 'grieving', 'lonely', 'empty', 'depressed', 'sorrowful']
};

// Recurring dream detection and analysis
const analyzeRecurringDreams = (currentDreamText, currentInterpretation) => {
    const currentSymbols = currentInterpretation.symbols.map(s => s.symbol);
    const currentThemes = currentInterpretation.mainThemes;
    const currentEmotions = currentInterpretation.detectedEmotions;
    
    // Find similar dreams from history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentDreams = dreamStorage.filter(dream => {
        const dreamDate = new Date(dream.created_at);
        return dreamDate >= thirtyDaysAgo;
    });
    
    const recurringPatterns = {
        symbolRecurrence: [],
        themeRecurrence: [],
        emotionRecurrence: [],
        overallRecurrenceScore: 0,
        isRecurring: false,
        similarDreams: [],
        recurrenceFrequency: 'none'
    };
    
    if (recentDreams.length === 0) {
        return recurringPatterns;
    }
    
    // Analyze symbol recurrence
    const symbolFrequency = {};
    currentSymbols.forEach(symbol => {
        symbolFrequency[symbol] = 0;
    });
    
    recentDreams.forEach(dream => {
        if (dream.interpretation && dream.interpretation.symbols) {
            const dreamSymbols = dream.interpretation.symbols.map(s => s.symbol);
            currentSymbols.forEach(currentSymbol => {
                if (dreamSymbols.includes(currentSymbol)) {
                    symbolFrequency[currentSymbol]++;
                }
            });
        }
    });
    
    // Find recurring symbols (appearing in 2+ dreams)
    Object.entries(symbolFrequency).forEach(([symbol, count]) => {
        if (count >= 2) {
            recurringPatterns.symbolRecurrence.push({
                symbol: symbol,
                frequency: count,
                significance: dreamSymbols[symbol]?.significance || 'medium'
            });
        }
    });
    
    // Analyze theme recurrence
    const themeFrequency = {};
    currentThemes.forEach(theme => {
        themeFrequency[theme] = 0;
    });
    
    recentDreams.forEach(dream => {
        if (dream.interpretation && dream.interpretation.mainThemes) {
            currentThemes.forEach(currentTheme => {
                if (dream.interpretation.mainThemes.includes(currentTheme)) {
                    themeFrequency[currentTheme]++;
                }
            });
        }
    });
    
    Object.entries(themeFrequency).forEach(([theme, count]) => {
        if (count >= 2) {
            recurringPatterns.themeRecurrence.push({
                theme: theme,
                frequency: count
            });
        }
    });
    
    // Analyze emotion recurrence
    const emotionFrequency = {};
    currentEmotions.forEach(emotion => {
        emotionFrequency[emotion] = 0;
    });
    
    recentDreams.forEach(dream => {
        if (dream.interpretation && dream.interpretation.detectedEmotions) {
            currentEmotions.forEach(currentEmotion => {
                if (dream.interpretation.detectedEmotions.includes(currentEmotion)) {
                    emotionFrequency[currentEmotion]++;
                }
            });
        }
    });
    
    Object.entries(emotionFrequency).forEach(([emotion, count]) => {
        if (count >= 2) {
            recurringPatterns.emotionRecurrence.push({
                emotion: emotion,
                frequency: count
            });
        }
    });
    
    // Calculate overall recurrence score
    const totalRecurrences = recurringPatterns.symbolRecurrence.length + 
                           recurringPatterns.themeRecurrence.length + 
                           recurringPatterns.emotionRecurrence.length;
    
    recurringPatterns.overallRecurrenceScore = totalRecurrences;
    recurringPatterns.isRecurring = totalRecurrences >= 2;
    
    // Determine recurrence frequency
    if (totalRecurrences >= 5) {
        recurringPatterns.recurrenceFrequency = 'high';
    } else if (totalRecurrences >= 3) {
        recurringPatterns.recurrenceFrequency = 'medium';
    } else if (totalRecurrences >= 2) {
        recurringPatterns.recurrenceFrequency = 'low';
    } else {
        recurringPatterns.recurrenceFrequency = 'none';
    }
    
    // Find similar dreams for reference
    recurringPatterns.similarDreams = recentDreams.filter(dream => {
        let similarityScore = 0;
        
        if (dream.interpretation && dream.interpretation.symbols) {
            const dreamSymbols = dream.interpretation.symbols.map(s => s.symbol);
            currentSymbols.forEach(currentSymbol => {
                if (dreamSymbols.includes(currentSymbol)) {
                    similarityScore++;
                }
            });
        }
        
        if (dream.interpretation && dream.interpretation.mainThemes) {
            currentThemes.forEach(currentTheme => {
                if (dream.interpretation.mainThemes.includes(currentTheme)) {
                    similarityScore++;
                }
            });
        }
        
        return similarityScore >= 2; // Dreams with 2+ similarities
    }).slice(0, 3); // Limit to 3 most recent similar dreams
    
    return recurringPatterns;
};

// Enhanced dream interpretation function with recurring analysis
const getMockInterpretation = (dreamText) => {
    const text = dreamText.toLowerCase();
    const detectedSymbols = [];
    const detectedEmotions = [];
    
    // Detect symbols in dream text
    for (const [symbol, data] of Object.entries(dreamSymbols)) {
        if (text.includes(symbol)) {
            detectedSymbols.push({
                symbol: symbol,
                meaning: data.meaning,
                significance: data.significance,
                context: data.context
            });
        }
    }
    
    // Detect emotional tone
    for (const [emotion, indicators] of Object.entries(emotionalIndicators)) {
        if (indicators.some(indicator => text.includes(indicator))) {
            detectedEmotions.push(emotion);
        }
    }
    
    // Determine main themes based on detected symbols
    const mainThemes = [];
    if (detectedSymbols.some(s => ['flying', 'bird', 'mountain'].includes(s.symbol))) {
        mainThemes.push('transcendence');
    }
    if (detectedSymbols.some(s => ['water', 'ocean', 'river', 'rain'].includes(s.symbol))) {
        mainThemes.push('emotional_depth');
    }
    if (detectedSymbols.some(s => ['snake', 'death', 'fire'].includes(s.symbol))) {
        mainThemes.push('transformation');
    }
    if (detectedSymbols.some(s => ['house', 'door', 'room'].includes(s.symbol))) {
        mainThemes.push('self_exploration');
    }
    if (detectedSymbols.some(s => ['running', 'searching', 'journey'].includes(s.symbol))) {
        mainThemes.push('life_direction');
    }
    
    // Fallback themes if none detected
    if (mainThemes.length === 0) {
        mainThemes.push('personal_growth', 'self_discovery');
    }
    
    // Determine emotional tone
    let emotionalTone = 'Neutral';
    if (detectedEmotions.includes('joyful')) {
        emotionalTone = 'Positive and uplifting';
    } else if (detectedEmotions.includes('fearful') || detectedEmotions.includes('anxious')) {
        emotionalTone = 'Challenging but transformative';
    } else if (detectedEmotions.includes('peaceful')) {
        emotionalTone = 'Serene and harmonious';
    } else if (detectedEmotions.includes('angry')) {
        emotionalTone = 'Intense and passionate';
    } else if (detectedEmotions.includes('sad')) {
        emotionalTone = 'Reflective and healing';
    }
    
    // Generate personal insight based on symbols and themes
    let personalInsight = '';
    if (mainThemes.includes('transcendence')) {
        personalInsight = 'Your dream suggests you are seeking to rise above current limitations and explore higher consciousness or new perspectives in your life.';
    } else if (mainThemes.includes('emotional_depth')) {
        personalInsight = 'Your dream is processing deep emotional currents and inviting you to explore your inner feelings and intuitive wisdom.';
    } else if (mainThemes.includes('transformation')) {
        personalInsight = 'Your dream indicates significant personal transformation is occurring, inviting you to embrace change and release old patterns.';
    } else if (mainThemes.includes('self_exploration')) {
        personalInsight = 'Your dream is encouraging deeper self-exploration and understanding of different aspects of your personality and life experience.';
    } else if (mainThemes.includes('life_direction')) {
        personalInsight = 'Your dream reflects questions about your life path and direction, encouraging you to clarify your goals and aspirations.';
    } else {
        personalInsight = 'Your dream offers valuable insights into your current life situation and inner world, inviting reflection and awareness.';
    }
    
    // Generate guidance based on detected symbols
    let guidance = '';
    if (detectedSymbols.length > 0) {
        const highSignificanceSymbols = detectedSymbols.filter(s => s.significance === 'high');
        if (highSignificanceSymbols.length > 0) {
            guidance = `Pay special attention to the symbols of ${highSignificanceSymbols.map(s => s.symbol).join(' and ')}, as they carry important messages for your personal growth. `;
        }
        
        if (detectedEmotions.length > 0) {
            guidance += `Your dream emotions (${detectedEmotions.join(', ')}) are providing clues about areas needing attention or celebration in your waking life. `;
        }
        
        guidance += 'Consider how these dream symbols might relate to your current life circumstances and what changes or insights they might be suggesting.';
    } else {
        guidance = 'Keep a dream journal to track recurring symbols and patterns. Your dreams are uniquely personal and their meanings become clearer over time with consistent reflection.';
    }
    
    const interpretation = {
        mainThemes: mainThemes.slice(0, 3),
        emotionalTone: emotionalTone,
        symbols: detectedSymbols.slice(0, 5), // Return up to 5 most relevant symbols
        personalInsight: personalInsight,
        guidance: guidance,
        detectedEmotions: detectedEmotions
    };
    
    // Analyze for recurring patterns
    const recurringAnalysis = analyzeRecurringDreams(dreamText, interpretation);
    interpretation.recurringAnalysis = recurringAnalysis;
    
    // Add recurring-specific guidance if patterns detected
    if (recurringAnalysis.isRecurring) {
        let recurringGuidance = '\n\n🔄 **RECURRING DREAM PATTERN DETECTED**: ';
        
        if (recurringAnalysis.symbolRecurrence.length > 0) {
            const symbols = recurringAnalysis.symbolRecurrence.map(r => r.symbol).join(', ');
            recurringGuidance += `You've been dreaming about ${symbols} repeatedly. This symbol pattern suggests your subconscious is trying to bring important attention to this area of your life. `;
        }
        
        if (recurringAnalysis.themeRecurrence.length > 0) {
            const themes = recurringAnalysis.themeRecurrence.map(r => r.theme).join(' and ');
            recurringGuidance += `The recurring theme of ${themes} indicates this is a significant area for your personal growth right now. `;
        }
        
        recurringGuidance += 'Recurring dreams often appear when we need to pay special attention to unresolved issues or opportunities for healing and growth.';
        
        interpretation.guidance += recurringGuidance;
        interpretation.isRecurring = true;
        interpretation.recurrenceFrequency = recurringAnalysis.recurrenceFrequency;
    } else {
        interpretation.isRecurring = false;
        interpretation.recurrenceFrequency = 'none';
    }
    
    return interpretation;
};

// Mock API server with Supabase integration
const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${path}`);

    // API root endpoint
    if (path === '/api/v1' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            message: 'Day Dream Dictionary API v1 with Supabase Integration',
            version: '1.0.0',
            endpoints: [
                'GET /api/v1/health',
                'POST /api/v1/auth/login',
                'POST /api/v1/auth/signup',
                'GET /api/v1/dreams',
                'POST /api/v1/dreams/interpret',
                'GET /api/v1/profile/credits',
                'GET /api/v1/profile'
            ]
        }));
        return;
    }

    // Health check
    if (path === '/api/v1/health' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Supabase API Server Running' }));
        return;
    }

    // Auth endpoints
    if (path.startsWith('/api/v1/auth/')) {
        if (path === '/api/v1/auth/login' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { email, password } = data;
                    
                    // Find user by email
                    let userFound = null;
                    for (const [userId, userData] of users.entries()) {
                        if (userData.email === email && userData.password === password) {
                            userFound = { ...userData, id: userId };
                            break;
                        }
                    }
                    
                    if (userFound) {
                        // Generate mock JWT token
                        const token = `mock-jwt-token-${userFound.id}-${Date.now()}`;
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            accessToken: token,
                            token: token,
                            user: {
                                id: userFound.id,
                                email: userFound.email,
                                display_name: userFound.displayName,
                                locale: userFound.locale || 'en'
                            }
                        }));
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            error: 'Invalid credentials',
                            message: 'Email or password is incorrect'
                        }));
                    }
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request data' }));
                }
            });
            return;
        }
        
        if (path === '/api/v1/auth/signup' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { email, password, displayName, locale } = data;
                    
                    // Check if user already exists
                    for (const [userId, userData] of users.entries()) {
                        if (userData.email === email) {
                            res.writeHead(409, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                error: 'User already exists',
                                message: 'An account with this email already exists'
                            }));
                            return;
                        }
                    }
                    
                    // Create new user
                    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const newUser = {
                        id: userId,
                        email: email,
                        password: password, // In production, this would be hashed
                        displayName: displayName || email.split('@')[0],
                        locale: locale || 'en',
                        createdAt: new Date().toISOString(),
                        emailVerified: true
                    };
                    
                    // Store user
                    users.set(userId, newUser);
                    
                    // Initialize user data for new user
                    initializeUserData(userId);
                    
                    // Generate mock JWT token
                    const token = `mock-jwt-token-${userId}-${Date.now()}`;
                    
                    console.log(`✅ New user created: ${email} (${userId})`);
                    
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        accessToken: token,
                        token: token,
                        user: {
                            id: newUser.id,
                            email: newUser.email,
                            display_name: newUser.displayName,
                            locale: newUser.locale
                        }
                    }));
                } catch (error) {
                    console.error('Signup error:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request data' }));
                }
            });
            return;
        }
    }

    // Dreams endpoints
    if (path.startsWith('/api/v1/dreams')) {
        if (path === '/api/v1/dreams' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ dreams: dreamStorage }));
            return;
        }
        
        if (path === '/api/v1/dreams/stats' && method === 'GET') {
            const now = new Date();
            const thisMonth = now.getMonth();
            const thisYear = now.getFullYear();
            
            const thisMonthDreams = dreamStorage.filter(dream => {
                const dreamDate = new Date(dream.created_at);
                return dreamDate.getMonth() === thisMonth && dreamDate.getFullYear() === thisYear;
            });

            const stats = {
                totalDreams: dreamStorage.length,
                totalInterpretations: dreamStorage.length,
                thisMonth: thisMonthDreams.length,
                creditsUsed: dreamStorage.length,
                interpretationTypes: {
                    basic: dreamStorage.filter(d => d.interpretation_type === 'basic').length,
                    deep: dreamStorage.filter(d => d.interpretation_type === 'deep').length,
                    premium: dreamStorage.filter(d => d.interpretation_type === 'premium').length
                }
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
            return;
        }
        
        if (path === '/api/v1/dreams/interpret' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const userId = data.user_id || 'test-user-id';
                    const interpretationType = data.interpretationType || 'basic';
                    
                    // Check user limits and credits
                    const limitCheck = checkUserLimits(userId, interpretationType);
                    if (!limitCheck.allowed) {
                        res.writeHead(402, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            error: 'Limit exceeded',
                            reason: limitCheck.reason,
                            details: limitCheck
                        }));
                        return;
                    }
                    
                    const interpretation = getMockInterpretation(data.dreamText);
                    
                    // Consume credits and update usage
                    const consumption = consumeCredits(userId, interpretationType);
                    
                    const dreamData = {
                        id: dreamIdCounter.toString(),
                        dream_text: data.dreamText,
                        interpretation_type: interpretationType,
                        interpretation: interpretation,
                        created_at: new Date().toISOString(),
                        user_id: userId,
                        credits_consumed: interpretationType === 'deep' ? 3 : 1,
                        credits_remaining: consumption.creditsRemaining
                    };

                    // Store in local memory
                    dreamStorage.push(dreamData);
                    dreamIdCounter++;

                    // Try to store in Supabase (but don't fail if it doesn't work)
                    try {
                        await makeSupabaseRequest('POST', 'dreams', {
                            dream_text: dreamData.dream_text,
                            interpretation_type: dreamData.interpretation_type,
                            interpretation: dreamData.interpretation,
                            user_id: dreamData.user_id,
                            created_at: dreamData.created_at
                        });
                        console.log('Dream successfully stored in Supabase');
                    } catch (supabaseError) {
                        console.log('Dream stored locally (Supabase unavailable):', supabaseError.message);
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(dreamData));
                } catch (error) {
                    console.error('Error processing dream:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid request data' }));
                }
            });
            return;
        }
    }


    // Account reset endpoint
    if (path === '/api/v1/account/reset' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const userId = data.user_id || 'test-user-id';
                
                // Reset user data to clean state
                initializeUserData(userId);
                
                // Clear credits and reset to basic plan
                userCredits.set(userId, 0);
                
                const subscription = userSubscriptions.get(userId);
                subscription.plan = 'basic';
                subscription.features = [...SUBSCRIPTION_PLANS.basic.features];
                subscription.monthlyUsage = { basic: 0, deep: 0 };
                subscription.startDate = new Date().toISOString();
                subscription.nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                
                // Clear purchase history
                userPurchases.set(userId, []);
                
                // Clear dream history for this user
                const userDreams = dreamStorage.filter(dream => dream.user_id === userId);
                userDreams.forEach(dream => {
                    const index = dreamStorage.indexOf(dream);
                    if (index > -1) {
                        dreamStorage.splice(index, 1);
                    }
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Account reset successfully. You now have 0 credits and a Basic plan.',
                    newAccountState: {
                        plan: 'basic',
                        credits: 0,
                        monthlyUsage: { basic: 0, deep: 0 },
                        features: SUBSCRIPTION_PLANS.basic.features
                    }
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Monetization endpoints
    if (path.startsWith('/api/v1/monetization/')) {
        if (path === '/api/v1/monetization/plans' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                plans: SUBSCRIPTION_PLANS,
                creditPacks: CREDIT_PACKS,
                addOns: ADD_ONS
            }));
            return;
        }
        
        if (path === '/api/v1/monetization/subscribe' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    // Extract user ID from authentication header
                    const authHeader = req.headers.authorization;
                    const userId = extractUserIdFromToken(authHeader) || data.user_id || 'test-user-id';
                    const result = upgradeSubscription(userId, data.plan);
                    
                    console.log(`✅ User ${userId} upgraded to ${data.plan} plan`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        if (path === '/api/v1/monetization/purchase-credits' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    // Extract user ID from authentication header
                    const authHeader = req.headers.authorization;
                    const userId = extractUserIdFromToken(authHeader) || data.user_id || 'test-user-id';
                    const result = purchaseCreditPack(userId, data.packSize);
                    
                    console.log(`✅ User ${userId} purchased ${data.packSize} credit pack`);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
        
        if (path === '/api/v1/monetization/purchase-addon' && method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const userId = data.user_id || 'test-user-id';
                    const addOn = ADD_ONS[data.addOnType];
                    
                    if (!addOn) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid add-on type' }));
                        return;
                    }
                    
                    const purchase = {
                        id: Date.now().toString(),
                        type: 'addon',
                        addOnType: data.addOnType,
                        price: addOn.price,
                        features: addOn.features,
                        purchaseDate: new Date().toISOString()
                    };
                    
                    const purchases = userPurchases.get(userId);
                    purchases.push(purchase);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        purchase,
                        message: `${data.addOnType} add-on activated successfully`
                    }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
    }

    // Enhanced profile endpoint with subscription info
    if (path === '/api/v1/profile' && method === 'GET') {
        const authHeader = req.headers.authorization;
        const userId = extractUserIdFromToken(authHeader) || 'test-user-id';
        
        initializeUserData(userId);
        
        // Get user data
        const userData = users.get(userId);
        const subscription = userSubscriptions.get(userId);
        const credits = userCredits.get(userId);
        const purchases = userPurchases.get(userId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            profile: {
                id: userId,
                email: userData?.email || 'test@example.com',
                display_name: userData?.displayName || 'Test User',
                locale: userData?.locale || 'en',
                credits: credits,
                role: 'user',
                emailVerified: true,
                created_at: userData?.createdAt || new Date().toISOString(),
                subscription: {
                    plan: subscription.plan,
                    features: subscription.features,
                    nextBillingDate: subscription.nextBillingDate,
                    monthlyUsage: subscription.monthlyUsage
                },
                purchases: purchases.slice(-10) // Last 10 purchases
            }
        }));
        return;
    }

    // Enhanced credits endpoint with subscription info
    if (path === '/api/v1/profile/credits' && method === 'GET') {
        const authHeader = req.headers.authorization;
        const userId = extractUserIdFromToken(authHeader) || 'test-user-id';
        
        initializeUserData(userId);
        
        const subscription = userSubscriptions.get(userId);
        const credits = userCredits.get(userId);
        const plan = SUBSCRIPTION_PLANS[subscription.plan];
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            balance: credits,
            subscription: {
                plan: subscription.plan,
                monthlyLimits: plan.monthlyLimits,
                monthlyUsage: subscription.monthlyUsage,
                features: subscription.features
            },
            creditCosts: CREDIT_COSTS
        }));
        return;
    }

    // Default response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`\n🌙 Day Dream Dictionary API Server with Supabase Integration is running!`);
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🗄️  Database: Supabase (with local fallback)`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`  GET  /api/v1/health`);
    console.log(`  POST /api/v1/auth/login`);
    console.log(`  POST /api/v1/auth/signup`);
    console.log(`  GET  /api/v1/dreams`);
    console.log(`  POST /api/v1/dreams/interpret (stores in Supabase)`);
    console.log(`  GET  /api/v1/profile/credits`);
    console.log(`  GET  /api/v1/profile`);
    console.log(`\n🚀 Press Ctrl+C to stop the server\n`);
});
