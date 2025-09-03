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
    signOut: async () => ({ error: null })
  },
  from: (table) => ({
    select: (columns) => ({
      eq: (column, value) => ({
        single: async () => {
          if (table === 'credits' && column === 'user_id' && value === 'test-user-id') {
            return { data: { balance: 999 }, error: null };
          }
          if (table === 'profiles') {
            return { data: { display_name: 'Test User', locale: 'en' }, error: null };
          }
           if (table === 'subscriptions' && column === 'user_id' && value === 'test-user-id') {
            return { data: null, error: { code: 'PGRST116' } }; // No active subscription
          }
          return { data: null, error: { code: 'PGRST116' } };
        }
      }),
      limit: () => ({ data: [], error: null })
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: 'test-id' }, error: null })
      })
    }),
    upsert: () => ({
      select: () => ({
        single: async () => ({ data: { id: 'test-id' }, error: null })
      })
    }),
    update: () => ({
      eq: () => ({
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