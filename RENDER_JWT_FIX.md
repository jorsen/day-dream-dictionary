# 🔐 Fix JWT Secret Error on Render

## Problem
Your backend is failing with "secretOrPrivateKey must have a value" because the JWT_SECRET and REFRESH_TOKEN_SECRET environment variables are missing on Render.

## Solution

### Step 1: Go to Your Render Dashboard
1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click on your backend service (day-dream-dictionary-api)

### Step 2: Add Missing Environment Variables
Go to the "Environment" tab and add these REQUIRED variables:

```env
# JWT Secrets - CRITICAL! Click "Generate" or use these secure values
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024
REFRESH_TOKEN_SECRET=your-refresh-token-secret-key-change-this-2024
SESSION_SECRET=your-session-secret-key-change-this-2024

# If you want to generate secure random values, use:
# Option 1: Click the "Generate" button in Render
# Option 2: Use this Node.js command locally:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 3: Verify ALL Required Environment Variables
Make sure you have ALL of these set:

#### Required Security Keys:
- ✅ `JWT_SECRET` - For access tokens
- ✅ `REFRESH_TOKEN_SECRET` - For refresh tokens  
- ✅ `SESSION_SECRET` - For session management

#### Required Supabase Configuration:
- ✅ `SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_ANON_KEY` - Your Supabase anon/public key
- ✅ `SUPABASE_SERVICE_KEY` - Your Supabase service role key

#### Required API Configuration:
- ✅ `OPENROUTER_API_KEY` - Your OpenRouter API key
- ✅ `NODE_ENV` - Set to "production"
- ✅ `PORT` - Set to "5000"
- ✅ `API_VERSION` - Set to "v1"

#### CORS Configuration:
- ✅ `CORS_ORIGIN` - Set to "*" for testing, or your frontend URL for production

### Step 4: Generate Secure Random Values
If you need to generate secure values for the secrets:

1. **Using Render's Generate Button** (Recommended):
   - In the Environment tab, click "Generate" next to each secret field

2. **Using Node.js** (Alternative):
   ```bash
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   node -e "console.log('REFRESH_TOKEN_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   ```

3. **Using OpenSSL** (Alternative):
   ```bash
   openssl rand -hex 64
   ```

### Step 5: Save and Redeploy
1. After adding all environment variables, click "Save Changes"
2. Render will automatically redeploy your service
3. Wait for the deployment to complete (3-5 minutes)

### Step 6: Test Your Backend
Once deployed, test these endpoints:

1. **Health Check**:
   ```
   https://day-dream-dictionary-api.onrender.com/health
   ```
   Should return: `{"status":"OK","message":"Day Dream Dictionary API is running"}`

2. **Test Signup** (using curl or Postman):
   ```bash
   curl -X POST https://day-dream-dictionary-api.onrender.com/api/v1/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test1234!","displayName":"Test User"}'
   ```

### Step 7: Update Frontend Configuration
Make sure your `config.js` file has the correct backend URL:

```javascript
const API_CONFIG = {
    API_BASE_URL: 'https://day-dream-dictionary-api.onrender.com/api/v1'
};
```

## Complete Environment Variables Template

Here's the complete list to copy-paste into Render (update with your actual values):

```env
# Server Configuration
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Security Keys (Generate these!)
JWT_SECRET=GENERATE_A_SECURE_RANDOM_VALUE_HERE
REFRESH_TOKEN_SECRET=GENERATE_ANOTHER_SECURE_RANDOM_VALUE_HERE
SESSION_SECRET=GENERATE_A_THIRD_SECURE_RANDOM_VALUE_HERE

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-key-here

# OpenRouter API
OPENROUTER_API_KEY=your-openrouter-api-key-here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:20241022
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_MAX_TOKENS=2000

# CORS (use * for testing, specific URL for production)
CORS_ORIGIN=*
FRONTEND_URL=https://your-frontend-url.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Free Tier Limits
FREE_DEEP_INTERPRETATIONS_MONTHLY=1000
FREE_BASIC_INTERPRETATIONS_MONTHLY=1000

# MongoDB (optional - leave empty if using only Supabase)
MONGODB_URI=

# JWT Expiration Times (optional)
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
```

## Troubleshooting

### If you still get errors after adding the secrets:

1. **Check the Logs**:
   - In Render dashboard, go to "Logs" tab
   - Look for specific error messages

2. **Verify Environment Variables**:
   - Make sure there are no typos in variable names
   - Ensure values don't have extra quotes or spaces
   - Check that all required variables are set

3. **Common Issues**:
   - Missing JWT_SECRET → "secretOrPrivateKey must have a value"
   - Missing SUPABASE_URL → "Supabase connection failed"
   - Wrong CORS_ORIGIN → Frontend can't connect to API

4. **Test with curl**:
   ```bash
   # Test if server is running
   curl https://day-dream-dictionary-api.onrender.com/health
   
   # Test auth endpoint
   curl -X POST https://day-dream-dictionary-api.onrender.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

## Security Best Practices

1. **Never commit secrets to Git**
2. **Use different secrets for production vs development**
3. **Rotate secrets periodically**
4. **Use strong, random values (at least 32 characters)**
5. **Don't share secrets in plain text**

## Next Steps

After fixing the JWT secret issue:
1. ✅ Backend should be running without errors
2. ✅ Frontend can connect to the API
3. ✅ Authentication should work properly
4. ✅ Users can sign up and log in

Need more help? Check the Render logs for specific error messages.