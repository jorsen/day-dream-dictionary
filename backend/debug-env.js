// Debug environment variables
require('dotenv').config({ path: '.env' });

console.log('🔍 Environment Variables Debug');
console.log('============================');
console.log('TEST_MODE:', process.env.TEST_MODE);
console.log('TEST_MODE type:', typeof process.env.TEST_MODE);
console.log('TEST_MODE === "true":', process.env.TEST_MODE === 'true');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set');

const { testMode } = require('./src/config/test-mode');
console.log('testMode from config:', testMode);
