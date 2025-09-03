const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./mongodb');
const { testMode, mockSupabase } = require('./test-mode');

let supabase = null;
let supabaseAdmin = null;

const initSupabase = async () => {
  try {
    // Use mock in test mode
    if (testMode || process.env.SUPABASE_URL === 'https://dummy.supabase.co') {
      logger.info('⚠️ Running in TEST MODE - Using mock Supabase');
      supabase = mockSupabase;
      supabaseAdmin = mockSupabase;
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.warn('Missing Supabase configuration. Running in test mode.');
      supabase = mockSupabase;
      supabaseAdmin = mockSupabase;
      return;
    }

    // Create public client (for client-side operations)
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });

    // Create admin client (for server-side operations with elevated privileges)
    if (supabaseServiceKey) {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }

    // Test connection by checking if we can access the auth service
    const { data, error } = await supabase.auth.getSession();
    
    if (error && error.message !== 'Auth session missing!') {
      throw error;
    }

    logger.info('✅ Supabase initialized successfully');
    
    // Initialize database tables if they don't exist
    await initializeTables();
    
  } catch (error) {
    logger.error('Supabase initialization failed:', error);
    throw error;
  }
};

const initializeTables = async () => {
  try {
    // This function would typically run migrations or check for required tables
    // For now, we'll assume tables are created via Supabase dashboard or migrations
    
    // Check if profiles table exists and has the correct structure
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError && profilesError.code === '42P01') {
      logger.warn('Profiles table does not exist. Please run migrations.');
    }
    
    // Check other tables
    const tables = ['subscriptions', 'payments_history', 'credits', 'roles'];
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        logger.warn(`${table} table does not exist. Please run migrations.`);
      }
    }
    
  } catch (error) {
    logger.error('Error checking database tables:', error);
  }
};

// Helper function to get user by ID
const getUserById = async (userId) => {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Error fetching user:', error);
    throw error;
  }
};

// Helper function to create user profile
const createUserProfile = async (userId, profileData) => {
  try {
    // Use admin client to bypass RLS for profile creation during signup
    const adminClient = supabaseAdmin || supabase;
    
    // First check if profile already exists (created by trigger)
    const { data: existingProfile, error: checkError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (existingProfile) {
      // Profile already exists (created by trigger), update it
      const { data, error } = await adminClient
        .from('profiles')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Profile doesn't exist, create it
      const { data, error } = await adminClient
        .from('profiles')
        .insert([
          {
            user_id: userId,
            email: profileData.email || '',
            ...profileData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  } catch (error) {
    logger.error('Error creating/updating user profile:', error);
    throw error;
  }
};

// Helper function to get user profile
const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    throw error;
  }
};

// Helper function to update user profile
const updateUserProfile = async (userId, updates) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw error;
  }
};

// Helper function to check user role
const checkUserRole = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data?.role || 'user';
  } catch (error) {
    logger.error('Error checking user role:', error);
    return 'user';
  }
};

// Helper function to get user credits
const getUserCredits = async (userId) => {
  try {
    const { data, error } = await (supabaseAdmin || supabase)
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data?.balance || 0;
  } catch (error) {
    logger.error('Error fetching user credits:', error);
    return 0;
  }
};

// Helper function to update user credits
const updateUserCredits = async (userId, amount, operation = 'add') => {
  try {
    // Get current balance
    const currentBalance = await getUserCredits(userId);
    
    // Calculate new balance
    const newBalance = operation === 'add' 
      ? currentBalance + amount 
      : Math.max(0, currentBalance - amount);
    
    // Update or insert credits
    const { data, error } = await supabase
      .from('credits')
      .upsert([
        {
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Error updating user credits:', error);
    throw error;
  }
};

// Helper function to get user subscription
const getUserSubscription = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    logger.error('Error fetching user subscription:', error);
    return null;
  }
};

module.exports = {
  initSupabase,
  getSupabase: () => supabase,
  getSupabaseAdmin: () => supabaseAdmin,
  getUserById,
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  checkUserRole,
  getUserCredits,
  updateUserCredits,
  getUserSubscription
};