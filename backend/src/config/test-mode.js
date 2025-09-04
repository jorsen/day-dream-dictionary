// Test mode configuration for running without external dependencies
const testMode = process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test';

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
  from: (table) => ({
    select: (columns, options) => ({
      eq: (column, value) => ({
        single: async () => {
          if (table === 'credits' && column === 'user_id' && value === 'test-user-id') {
            return { data: { balance: 5 }, error: null };
          }
          if (table === 'profiles') {
            return { data: { display_name: 'Test User', locale: 'en' }, error: null };
          }
          if (table === 'subscriptions' && column === 'user_id' && value === 'test-user-id') {
            return { data: null, error: { code: 'PGRST116' } }; // No active subscription
          }
          return { data: null, error: { code: 'PGRST116' } };
        },
        order: (column, options) => ({
          range: (from, to) => ({
            eq: (col, val) => ({
              single: async () => {
                if (table === 'dreams' && col === 'user_id' && val === 'free-user') {
                  return { data: { id: 'test-dream-id', dream_text: 'test dream', interpretation: {} }, error: null };
                }
                return { data: null, error: { code: 'PGRST116' } };
              }
            })
          })
        })
      }),
      limit: () => ({ data: [], error: null })
    }),
    insert: (data) => ({
      select: () => ({
        single: async () => {
          if (table === 'dreams') {
            return { data: { id: 'test-dream-id', ...data[0] }, error: null };
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
  })
};

module.exports = {
  testMode,
  mockSupabase
};
