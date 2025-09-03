# 🚀 Quick Deploy to Render.com

## Step-by-Step Deployment

### 1. Prepare Your Code
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Ready for Render deployment - free mode enabled"
```

### 2. Create GitHub Repository
1. Go to [GitHub](https://github.com/new)
2. Create new repository: `day-dream-dictionary`
3. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/day-dream-dictionary.git
git branch -M main
git push -u origin main
```

### 3. Deploy on Render

1. **Go to [Render Dashboard](https://dashboard.render.com)**

2. **Click "New +" → "Web Service"**

3. **Connect GitHub repository**

4. **Configure Service:**
   - Name: `day-dream-dictionary-api`
   - Environment: `Node`
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`

5. **Add Environment Variables** (click Advanced):

```env
# Required - Copy these exactly
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Supabase - Get from your Supabase project
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# OpenRouter - Get from OpenRouter.ai
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:20241022
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_MAX_TOKENS=2000

# Security - Click "Generate" for each
JWT_SECRET=[Generate]
REFRESH_TOKEN_SECRET=[Generate]
SESSION_SECRET=[Generate]

# CORS - Allow all for now
CORS_ORIGIN=*
FRONTEND_URL=https://daydreamdictionary.com

# Free Mode Settings
FREE_DEEP_INTERPRETATIONS_MONTHLY=1000
FREE_BASIC_INTERPRETATIONS_MONTHLY=1000

# Leave MongoDB empty (using Supabase)
MONGODB_URI=
```

6. **Click "Create Web Service"**

### 4. Wait for Deployment
- Takes 3-5 minutes
- Watch the logs for any errors
- Should see "Server running on port 5000"

### 5. Test Your API

Your API will be available at:
```
https://day-dream-dictionary-api.onrender.com
```

Test endpoints:
- Health: `https://day-dream-dictionary-api.onrender.com/health`
- API: `https://day-dream-dictionary-api.onrender.com/api/v1/test`

### 6. Create Supabase Tables

Go to your Supabase SQL Editor and run:

```sql
-- Dreams table
CREATE TABLE IF NOT EXISTS dreams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    dream_text TEXT NOT NULL,
    interpretation JSONB,
    metadata JSONB,
    user_context JSONB,
    tags TEXT[],
    is_recurring BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    locale VARCHAR(5) DEFAULT 'en',
    source VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255),
    type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name VARCHAR(255),
    locale VARCHAR(5) DEFAULT 'en',
    preferences JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credits table
CREATE TABLE IF NOT EXISTS credits (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    lifetime_earned INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(50),
    status VARCHAR(50),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_type ON events(type);
```

## ✅ Deployment Complete!

Your Day Dream Dictionary API is now live and running in FREE MODE:
- No payment restrictions
- All dream interpretations are free
- Ready for testing and development

## 🧪 Test Your Deployment

1. Open `test-dream-free.html` in your browser
2. Update the API_BASE to your Render URL:
   ```javascript
   const API_BASE = 'https://day-dream-dictionary-api.onrender.com/api/v1';
   ```
3. Test dream interpretation

## 📝 Important Notes

- **Free Tier**: Render free tier sleeps after 15 minutes of inactivity
- **Cold Starts**: First request after sleep takes ~30 seconds
- **Logs**: Check Render dashboard for server logs
- **Errors**: Most common issue is missing environment variables

## 🆘 Troubleshooting

If deployment fails:
1. Check all environment variables are set
2. Verify Supabase credentials are correct
3. Ensure OpenRouter API key is valid
4. Check build logs in Render dashboard

## 🎉 Success!

Your API is deployed and ready to use. The dream interpretation is completely free and unrestricted as requested!