# ✅ Render Deployment Checklist

## Local Testing Complete
- ✅ Updated `backend/.env` with all required environment variables
- ✅ Added JWT secrets for local development
- ✅ Configured Supabase credentials
- ✅ Added OpenRouter API key

## Frontend Updates Complete
- ✅ Created `config.js` with API endpoint configuration
- ✅ Updated `login.html` to use config.js
- ✅ Updated `profile-dashboard.html` to use config.js
- ✅ Updated `dream-interpretation.html` to use config.js

## Render Backend Configuration Required

### 1. Go to Render Dashboard
Visit: https://dashboard.render.com

### 2. Add ALL Environment Variables to Your Backend Service

Copy and paste these into your Render environment variables (replace [Generate] with actual values):

```env
# Server Configuration
NODE_ENV=production
PORT=5000
API_VERSION=v1

# JWT Security Keys - MUST GENERATE THESE!
JWT_SECRET=CLICK_GENERATE_BUTTON_OR_USE_SECURE_RANDOM_VALUE
REFRESH_TOKEN_SECRET=CLICK_GENERATE_BUTTON_OR_USE_DIFFERENT_SECURE_VALUE
SESSION_SECRET=CLICK_GENERATE_BUTTON_OR_USE_ANOTHER_SECURE_VALUE

# Supabase Configuration (from your DEPLOY-TO-RENDER.md)
SUPABASE_URL=https://gwgjckczyscpaozlevpe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTExNzMsImV4cCI6MjA3MjQ4NzE3M30.gKKl8PoJ7vDt9UWwY9yQv_V3Qr_hA5KsrwjK__XU1Bo
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMTE3MywiZXhwIjoyMDcyNDg3MTczfQ.YW8MY5qNLKMwfeSrIHjIDTN42HgeiQ6YRBZ-McyPXGM

# OpenRouter API Configuration
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:20241022
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_MAX_TOKENS=2000

# CORS Configuration
CORS_ORIGIN=*
FRONTEND_URL=https://day-dream-dictionary.onrender.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Free Mode Settings
FREE_DEEP_INTERPRETATIONS_MONTHLY=1000
FREE_BASIC_INTERPRETATIONS_MONTHLY=1000

# MongoDB (leave empty - using Supabase)
MONGODB_URI=

# JWT Expiration
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
```

### 3. Generate Secure JWT Secrets

**IMPORTANT**: For the three JWT secrets, you MUST either:

**Option A: Use Render's Generate Button** (Recommended)
- Click "Generate" next to JWT_SECRET
- Click "Generate" next to REFRESH_TOKEN_SECRET  
- Click "Generate" next to SESSION_SECRET

**Option B: Generate Your Own** (if Generate button not available)
Run this locally and copy the output:
```javascript
// Run in Node.js console or create a temp.js file
const crypto = require('crypto');
console.log('JWT_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('REFRESH_TOKEN_SECRET=' + crypto.randomBytes(64).toString('hex'));
console.log('SESSION_SECRET=' + crypto.randomBytes(64).toString('hex'));
```

### 4. Save and Deploy
- Click "Save Changes" in Render
- Wait for automatic redeployment (3-5 minutes)

## Testing Your Deployment

### 1. Test Backend Health
```bash
curl https://day-dream-dictionary-api.onrender.com/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Day Dream Dictionary API is running",
  "version": "v1"
}
```

### 2. Test Frontend Connection
1. Visit: https://day-dream-dictionary.onrender.com/login.html
2. Try creating a new account
3. Check browser console for any errors

## Troubleshooting Guide

### If you get "secretOrPrivateKey must have a value":
- ❌ JWT_SECRET is missing or empty
- ✅ Add JWT_SECRET in Render environment variables

### If you get CORS errors:
- ❌ CORS_ORIGIN not configured properly
- ✅ Set CORS_ORIGIN=* for testing or your frontend URL for production

### If you get "Cannot connect to Supabase":
- ❌ SUPABASE_URL or keys are incorrect
- ✅ Verify Supabase credentials are correct

### If frontend can't connect to backend:
- ❌ API URL mismatch in config.js
- ✅ Update config.js with correct backend URL

## Final Verification

Once everything is deployed:

1. **Backend Running**: https://day-dream-dictionary-api.onrender.com/health returns OK
2. **Frontend Deployed**: Your HTML files are accessible
3. **Authentication Works**: Can create account and login
4. **Dream Interpretation Works**: Can submit and interpret dreams

## Important Security Notes

⚠️ **Never commit .env files to Git**
⚠️ **Use different JWT secrets for production vs development**
⚠️ **Keep your API keys secure**
⚠️ **Rotate secrets periodically**

## Support

If you encounter issues:
1. Check Render logs for specific errors
2. Verify all environment variables are set
3. Ensure Supabase tables are created
4. Test API endpoints with curl or Postman

Your app should now be fully deployed and functional! 🎉