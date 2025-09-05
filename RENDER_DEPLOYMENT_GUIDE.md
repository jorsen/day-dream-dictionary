# 🚀 Deploy Day Dream Dictionary to Render.com

## Prerequisites
- GitHub account with your code repository
- Render.com account (free tier works)
- Supabase project (for database and auth)
- OpenRouter API key (for dream interpretation)

## Step 1: Prepare Your Repository

1. **Create a GitHub repository** if you haven't already:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Day Dream Dictionary"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/day-dream-dictionary.git
   git push -u origin main
   ```

2. **Ensure these files are in your repo root**:
   - `render.yaml` (already created)
   - `backend/` folder with all source code
   - `.gitignore` file

## Step 2: Set Up Render.com

1. **Sign up/Login** to [Render.com](https://render.com)

2. **Connect GitHub**:
   - Go to Dashboard → New → Web Service
   - Connect your GitHub account
   - Select your `day-dream-dictionary` repository

## Step 3: Configure the Service

### Basic Settings:
- **Name**: `day-dream-dictionary-api`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Root Directory**: Leave blank (we handle this in render.yaml)
- **Runtime**: Node
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`

### Environment Variables:

Click "Advanced" and add these environment variables:

#### Required Variables:
```
NODE_ENV=production
PORT=5000
API_VERSION=v1

# Supabase Configuration
SUPABASE_URL=https://gwgjckczyscpaozlevpe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTExNzMsImV4cCI6MjA3MjQ4NzE3M30.gKKl8PoJ7vDt9UWwY9yQv_V3Qr_hA5KsrwjK__XU1Bo
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMTE3MywiZXhwIjoyMDcyNDg3MTczfQ.YW8MY5qNLKMwfeSrIHjIDTN42HgeiQ6YRBZ-McyPXGM

# OpenRouter API Configuration
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:20241022
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_MAX_TOKENS=2000

# JWT Security Keys
JWT_SECRET=vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==
REFRESH_TOKEN_SECRET=452757dc9928f8adc6c6c1b598b544ad
SESSION_SECRET=f6a39ad7f121015434b6a6256a5712e9

# JWT Expiration Times
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# CORS Configuration (CRITICAL - Update with your actual frontend URL)
CORS_ORIGIN=https://day-dream-dictionary.onrender.com,https://daydreamdictionary.com
FRONTEND_URL=https://day-dream-dictionary.onrender.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Free Mode Settings
FREE_DEEP_INTERPRETATIONS_MONTHLY=1000
FREE_BASIC_INTERPRETATIONS_MONTHLY=1000
```

#### Optional Variables (for future):
```
# Stripe Configuration (when ready for payments)
STRIPE_PUBLISHABLE_KEY=sb_publishable_IgmN5IMAsp39Hy-yWMokuA_t51PLLNt
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Alternative AI Providers
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# MongoDB (if using instead of Supabase)
MONGODB_URI=

# Email Configuration
EMAIL_FROM=noreply@daydreamdictionary.com
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=

# Analytics
GOOGLE_ANALYTICS_ID=
MIXPANEL_TOKEN=

# Feature Flags
ENABLE_PREMIUM_FEATURES=false
ENABLE_EMAIL_VERIFICATION=false
ENABLE_RATE_LIMITING=true
ENABLE_LOGGING=true
TEST_MODE=false
```

## Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Build your application
   - Start the server

3. **Monitor the deployment**:
   - Check the logs for any errors
   - Wait for "Live" status (usually 2-5 minutes)

## Step 5: Verify Deployment

Once deployed, test your API:

1. **Health Check**:
   ```
   https://your-app.onrender.com/health
   ```

2. **Test Signup Endpoint**:
   ```bash
   curl -X POST https://your-app.onrender.com/api/v1/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "sample1@gmail.com",
       "password": "sample",
       "displayName": "Sample User",
       "locale": "en"
     }'
   ```

3. **Test Dream Interpretation**:
   ```bash
   curl -X POST https://your-app.onrender.com/api/v1/dreams/interpret \
     -H "Content-Type: application/json" \
     -d '{
       "dreamText": "I dreamed I was flying high in the sky",
       "interpretationType": "basic",
       "userContext": {},
       "locale": "en",
       "tags": [],
       "isRecurring": false
     }'
   ```

## Step 6: Set Up Supabase Tables

Run these SQL commands in your Supabase SQL editor:

```sql
-- Create dreams table
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

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255),
    type VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_created_at ON dreams(created_at);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_type ON events(type);
```

## Step 7: Configure Frontend

Update your frontend to use the Render URL:

```javascript
const API_BASE = 'https://your-app.onrender.com/api/v1';
```

## Troubleshooting

### Common Issues:

1. **Build fails**: Check `package.json` dependencies
2. **Server crashes**: Check environment variables
3. **Database connection fails**: Verify Supabase credentials
4. **CORS errors**: Update CORS_ORIGIN environment variable

### Monitoring:

- Use Render's dashboard for logs
- Set up health check alerts
- Monitor API response times

## Free Tier Limitations

Render's free tier includes:
- 750 hours/month runtime
- Auto-sleep after 15 minutes of inactivity
- Cold starts (first request may be slow)

## Upgrade Options

When ready to scale:
1. Upgrade to Render paid plan ($7/month)
2. Add custom domain
3. Enable auto-scaling
4. Add persistent disk for file uploads

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com
- Your API Health: https://your-app.onrender.com/health

---

## Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] GitHub connected to Render
- [ ] Environment variables configured
- [ ] Supabase tables created
- [ ] Deployment successful
- [ ] Health check passing
- [ ] Frontend connected
- [ ] Test dream interpretation working

## Next Steps

1. Test all API endpoints
2. Set up monitoring/alerts
3. Configure custom domain
4. Add SSL certificate (automatic on Render)
5. Set up CI/CD pipeline
6. Configure backup strategy
