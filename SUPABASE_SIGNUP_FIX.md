# Fix Supabase Signup Issues

## Current Problem
The signup endpoint is returning: `Email address "johndoe@gmail.com" is invalid`

This error is coming from Supabase Auth when trying to create a new user.

## Solution Steps

### 1. Check Supabase Dashboard Settings

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/gwgjckczyscpaozlevpe)
2. Navigate to **Authentication** → **Providers**
3. Click on **Email** provider
4. Make sure these settings are configured:
   - ✅ **Enable Email provider** is ON
   - ❌ **Confirm email** is OFF (for testing)
   - ❌ **Secure email change** is OFF (for testing)
   - ✅ **Enable signup** is ON

### 2. Check Supabase Project Status

1. In your Supabase dashboard, check if the project is:
   - Active (not paused)
   - Not exceeding any quotas
   - Has the correct region selected

### 3. Verify Database Tables

Run this in your Supabase SQL Editor to check if tables exist:

```sql
-- Check if auth schema and tables exist
SELECT COUNT(*) as user_count FROM auth.users;

-- Check if your custom tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

If tables don't exist, run the `supabase-quick-setup.sql` file.

### 4. Test Supabase Auth Directly

Create this test file to bypass the backend and test Supabase directly:

```javascript
// test-supabase-direct.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testDirectSignup() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test@example.com',
    password: 'TestPassword123!'
  });
  
  if (error) {
    console.log('Signup error:', error);
  } else {
    console.log('Signup success:', data);
  }
}

testDirectSignup();
```

### 5. Alternative: Use Mock Mode

If Supabase continues to have issues, you can temporarily use mock mode:

1. Update your `.env` file:
```env
# Temporarily use dummy URL to trigger mock mode
SUPABASE_URL=https://dummy.supabase.co
```

2. Restart the server

This will use the mock Supabase implementation for testing.

### 6. Check Email Domain Restrictions

Some Supabase projects might have email domain restrictions. Check:

1. Go to **Authentication** → **Providers** → **Email**
2. Look for any domain allowlist/blocklist settings
3. Remove any restrictions for testing

### 7. Verify API Keys Match Your Project

Make sure your API keys are from the correct project:

1. Go to **Settings** → **API** in your Supabase dashboard
2. Compare the `anon` key with your `SUPABASE_ANON_KEY`
3. Compare the `service_role` key with your `SUPABASE_SERVICE_KEY`
4. Make sure the Project URL matches your `SUPABASE_URL`

### 8. Check Rate Limiting

Supabase has rate limits on authentication endpoints:
- 30 requests per hour for signup
- 60 requests per hour for login

If you've been testing a lot, you might be rate-limited. Wait an hour or create a new project.

## Quick Fix for Development

If you need to continue development immediately, update the auth route to handle this error gracefully:

```javascript
// In backend/src/routes/auth.js, line 74-79
if (authError) {
  // Log the actual error for debugging
  console.error('Supabase signup error:', authError);
  
  // For development, create a mock user if Supabase fails
  if (process.env.NODE_ENV === 'development' && authError.message.includes('invalid')) {
    // Return mock success for development
    const mockUserId = require('crypto').randomUUID();
    return res.status(201).json({
      message: 'User created successfully (MOCK MODE)',
      user: {
        id: mockUserId,
        email: email,
        displayName: displayName || email.split('@')[0],
        locale,
        emailVerified: false
      },
      accessToken: 'mock_token_' + mockUserId
    });
  }
  
  if (authError.message.includes('already registered')) {
    throw new AppError('Email already registered', 409);
  }
  throw new AppError(authError.message, 400);
}
```

## Testing After Fix

Once you've applied the fixes:

1. Restart your backend server
2. Run the test: `node test-signup-real.js`
3. Check the response

## If All Else Fails

1. Create a new Supabase project
2. Run the `supabase-quick-setup.sql` script
3. Update your `.env` with new credentials
4. Restart and test again

## Contact Support

If the issue persists, contact Supabase support with:
- Your project ID: `gwgjckczyscpaozlevpe`
- The error message
- The fact that signups are failing with "invalid email" error