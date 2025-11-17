// Test mode configuration for running without external dependencies
const testMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test' ||
  (process.env.TEST_MODE !== 'false' && process.env.SUPABASE_URL === 'https://your-project-id.supabase.co') ||
  // Enable test mode for production deployment to allow demo logins
  (process.env.NODE_ENV === 'production' && process.env.TEST_MODE === 'demo');

const mockSupabase = {
  auth: {
    getSession: async () => ({ data: null, error: null }),
    signUp: async (data) => ({
      data: {
        user: {
          id: 'test-user-id',
          email: data.email,
          email_confirmed_at: null
        }
      },
      error: null
    }),
    signInWithPassword: async (data) => ({
      data: {
        user: {
          id: 'test-user-id',
          email: data.email,
          email_confirmed_at: new Date().toISOString()
        },
        session: { access_token: 'test-token' }
      },
      error: null
    }),
    signOut: async () => ({ error: null }),
    admin: {
      getUserById: async (userId) => ({
        data: {
          id: userId,
          email: 'test@example.com',
          email_confirmed_at: new Date().toISOString(),
          banned_until: null
        },
        error: null
      })
    }
  },
  from: (table) => {
    // Store dreams in memory for testing
    if (!mockSupabase._dreams) {
      mockSupabase._dreams = [
        {
          id: 'test-dream-1',
          user_id: 'test-user-id',
          dream_text: 'I was flying through clouds, feeling completely free and happy. The wind was gentle and I could see beautiful landscapes below me.',
          interpretation: {
            mainThemes: ['freedom', 'exploration'],
            emotionalTone: 'The dream evokes feelings of joy, freedom, and positivity, suggesting a hopeful and optimistic emotional state.',
            symbols: [
              {
                symbol: 'flying',
                meaning: 'Flying represents freedom, ambition, and transcendence. It may reflect your desire to rise above challenges or escape limitations.',
                significance: 'high'
              }
            ],
            personalInsight: 'Your dream about flying suggests a deep desire for liberation and self-expression. You may be feeling constrained in some area of your life and seeking greater autonomy.',
            guidance: 'Consider what areas of your life feel restrictive. Explore ways to create more freedom and self-expression in your daily life.'
          },
          metadata: {
            interpretationType: 'basic',
            creditsUsed: 0,
            processingTime: 150,
            modelUsed: 'anthropic/claude-3.5-sonnet:20241022',
            temperature: 0.7,
            maxTokens: 2000
          },
          user_context: {},
          tags: [],
          is_recurring: false,
          locale: 'en',
          source: 'test',
          created_at: new Date().toISOString(),
          is_deleted: false
        },
        {
          id: 'test-dream-2',
          user_id: 'test-user-id',
          dream_text: 'I was being chased through a dark forest by a shadowy figure. My heart was pounding and I felt terrified, but I kept running without looking back.',
          interpretation: {
            mainThemes: ['pursuit', 'fear'],
            emotionalTone: 'The dream carries an intense emotional tone with elements of fear or anxiety, reflecting inner turmoil or unresolved concerns.',
            symbols: [
              {
                symbol: 'being chased',
                meaning: 'Being chased represents avoidance, fear, or unresolved issues. It may reflect anxiety or something you\'re trying to escape.',
                significance: 'high'
              }
            ],
            personalInsight: 'The theme of pursuit in your dream may reflect anxiety or unresolved issues that you\'re trying to escape or confront in your waking life.',
            guidance: 'Reflect on what you might be avoiding in your waking life. Sometimes confronting our fears leads to greater peace and understanding.'
          },
          metadata: {
            interpretationType: 'basic',
            creditsUsed: 0,
            processingTime: 145,
            modelUsed: 'anthropic/claude-3.5-sonnet:20241022',
            temperature: 0.7,
            maxTokens: 2000
          },
          user_context: {},
          tags: [],
          is_recurring: false,
          locale: 'en',
          source: 'test',
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          is_deleted: false
        },
        {
          id: 'test-dream-3',
          user_id: 'test-user-id',
          dream_text: 'I found myself in a beautiful garden filled with colorful flowers and talking animals. Everything felt peaceful and I was able to understand what animals were saying to me.',
          interpretation: {
            mainThemes: ['peace', 'communication'],
            emotionalTone: 'The dream evokes feelings of joy, freedom, and positivity, suggesting a hopeful and optimistic emotional state.',
            symbols: [
              {
                symbol: 'animals',
                meaning: 'Animals represent different aspects of our instincts and natural wisdom. Talking animals may symbolize a connection to your intuition.',
                significance: 'medium'
              }
            ],
            personalInsight: 'Your dream about talking animals suggests a deep connection to your intuition and inner wisdom. You may be seeking guidance from your subconscious mind.',
            guidance: 'Trust your intuition as you navigate uncertainty. Your dreams may be guiding you toward new opportunities and discoveries.'
          },
          metadata: {
            interpretationType: 'basic',
            creditsUsed: 0,
            processingTime: 152,
            modelUsed: 'anthropic/claude-3.5-sonnet:20241022',
            temperature: 0.7,
            maxTokens: 2000
          },
          user_context: {},
          tags: [],
          is_recurring: false,
          locale: 'en',
          source: 'test',
          created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          is_deleted: false
        }
      ];
    }

    return {
      select: (columns = '*', options = {}) => {
        let queryConditions = {};
        let orderByColumn = null;
        let orderByAscending = true;
        let countExact = options.count === 'exact';
        let headOnly = options.head === true;

        const queryBuilder = {
          eq: (column, value) => {
            queryConditions[column] = value;
            return queryBuilder;
          },
          gte: (column, value) => {
            queryConditions[`${column}_gte`] = value;
            return queryBuilder;
          },
          not: (column, value) => {
            queryConditions[`${column}_not`] = value;
            return queryBuilder;
          },
          order: (column, options = {}) => {
            orderByColumn = column;
            orderByAscending = options.ascending !== false;
            return queryBuilder;
          },
          range: (from, to) => {
            queryBuilder.rangeFrom = from;
            queryBuilder.rangeTo = to;
            return queryBuilder;
          },
          single: async () => {
            // Handle different table queries based on conditions
            if (table === 'credits' && queryConditions.user_id === 'test-user-id') {
              return { data: { balance: 5 }, error: null };
            }
            if (table === 'profiles' && queryConditions.user_id) {
              return { data: { display_name: 'Test User', locale: 'en', user_id: queryConditions.user_id }, error: null };
            }
            if (table === 'subscriptions' && queryConditions.user_id === 'test-user-id' && queryConditions.status === 'active') {
              return { data: null, error: { code: 'PGRST116' } }; // No active subscription
            }
            if (table === 'subscriptions' && queryConditions.user_id) {
              return { data: null, error: { code: 'PGRST116' } }; // No subscription found
            }
            return { data: null, error: { code: 'PGRST116' } };
          }
        };

        // Create a simple async function that returns the result directly
        const executeQuery = async () => {
          let results = [];

          if (table === 'dreams') {
            results = [...mockSupabase._dreams];
            
            // Apply filters
            if (queryConditions.user_id) {
              results = results.filter(dream => dream.user_id === queryConditions.user_id);
            }
            if (queryConditions.is_deleted !== undefined) {
              results = results.filter(dream => dream.is_deleted === queryConditions.is_deleted);
            }
            if (queryConditions.is_recurring !== undefined) {
              results = results.filter(dream => dream.is_recurring === queryConditions.is_recurring);
            }
            if (queryConditions.created_at_gte) {
              const date = new Date(queryConditions.created_at_gte);
              results = results.filter(dream => new Date(dream.created_at) >= date);
            }
            if (queryConditions.is_deleted_not) {
              results = results.filter(dream => dream.is_deleted !== queryConditions.is_deleted_not);
            }

            // Apply sorting
            if (orderByColumn) {
              results.sort((a, b) => {
                const aVal = a[orderByColumn];
                const bVal = b[orderByColumn];
                if (orderByAscending) {
                  return aVal > bVal ? 1 : -1;
                } else {
                  return aVal < bVal ? 1 : -1;
                }
              });
            }

            // Apply pagination
            if (queryBuilder.rangeFrom !== undefined && queryBuilder.rangeTo !== undefined) {
              results = results.slice(queryBuilder.rangeFrom, queryBuilder.rangeTo + 1);
            }

            // Handle count queries
            if (countExact) {
              return {
                data: headOnly ? null : results,
                count: results.length,
                error: null
              };
            }

            return {
              data: results,
              count: results.length,
              error: null
            };
          }

          return { data: results, error: null };
        };

        // Override methods to return the async function directly
        queryBuilder.eq = (column, value) => {
          queryConditions[column] = value;
          return executeQuery();
        };
        queryBuilder.gte = (column, value) => {
          queryConditions[`${column}_gte`] = value;
          return executeQuery();
        };
        queryBuilder.not = (column, value) => {
          queryConditions[`${column}_not`] = value;
          return executeQuery();
        };
        queryBuilder.order = (column, options = {}) => {
          orderByColumn = column;
          orderByAscending = options.ascending !== false;
          return executeQuery();
        };
        queryBuilder.range = (from, to) => {
          queryBuilder.rangeFrom = from;
          queryBuilder.rangeTo = to;
          return executeQuery();
        };

        // Override methods to return the async function
        queryBuilder.eq = (column, value) => {
          queryConditions[column] = value;
          return queryBuilder;
        };
        queryBuilder.gte = (column, value) => {
          queryConditions[`${column}_gte`] = value;
          return queryBuilder;
        };
        queryBuilder.not = (column, value) => {
          queryConditions[`${column}_not`] = value;
          return queryBuilder;
        };
        queryBuilder.order = (column, options = {}) => {
          orderByColumn = column;
          orderByAscending = options.ascending !== false;
          return queryBuilder;
        };
        queryBuilder.range = (from, to) => {
          queryBuilder.rangeFrom = from;
          queryBuilder.rangeTo = to;
          return queryBuilder;
        };

        // Make the query builder itself async
        Object.setPrototypeOf(queryBuilder, Object.getPrototypeOf({
          then: executeQuery.then.bind(executeQuery),
          catch: executeQuery.catch.bind(executeQuery)
        }));

        return queryBuilder;
      },
      limit: (count) => ({
        data: mockSupabase._dreams ? mockSupabase._dreams.slice(0, count) : [],
        error: null
      }),
      insert: (data) => ({
        select: () => ({
          single: async () => {
            if (table === 'dreams') {
              const dreamData = { id: `test-dream-${Date.now()}`, ...data[0], created_at: new Date().toISOString() };
              mockSupabase._dreams.push(dreamData);
              return { data: dreamData, error: null };
            }
            return { data: { id: 'test-id' }, error: null };
          }
        })
      }),
      upsert: () => ({
        select: () => ({
          single: async () => ({ data: { id: 'test-id' }, error: null })
        })
      }),
      update: (data) => ({
        eq: (column, value) => ({
          select: () => ({
            single: async () => {
              if (table === 'dreams' && column === 'user_id' && value === 'free-user') {
                return { data: { id: 'test-dream-id', ...data }, error: null };
              }
              return { data: { id: 'test-id' }, error: null };
            }
          })
        })
      }),
      delete: () => ({
        eq: (column, value) => ({
          select: () => ({
            single: async () => ({ data: { id: 'test-id' }, error: null })
          })
        })
      })
    };
  }
};

module.exports = {
  testMode,
  mockSupabase
};
