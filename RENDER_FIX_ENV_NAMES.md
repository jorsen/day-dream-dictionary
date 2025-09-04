# ⚠️ CRITICAL: Fix Environment Variable Names on Render

## The Problem
You have an incorrectly named variable:
- ❌ `env = 94600cf7c4b02819f576f5551ee57797` (WRONG NAME)

## The Solution
You need to DELETE the `env` variable and make sure you have these EXACT variable names:

### Current (INCORRECT):
```
env = 94600cf7c4b02819f576f5551ee57797  ← DELETE THIS
JWT_SECRET = vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==
REFRESH_TOKEN_SECRET = 452757dc9928f8adc6c6c1b598b544ad
SESSION_SECRET = f6a39ad7f121015434b6a6256a5712e9
```

### Should be (CORRECT):
```
NODE_ENV = production  ← ADD THIS (not "env")
JWT_SECRET = vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==
REFRESH_TOKEN_SECRET = 452757dc9928f8adc6c6c1b598b544ad
SESSION_SECRET = f6a39ad7f121015434b6a6256a5712e9
```

## Steps to Fix on Render:

1. **Go to** https://dashboard.render.com
2. **Click** on your backend service
3. **Go to** Environment tab
4. **DELETE** the variable named `env`
5. **ADD** a new variable: `NODE_ENV` with value `production`
6. **VERIFY** you have ALL these variables with EXACT names:

### Required Environment Variables (EXACT NAMES):
```
NODE_ENV=production
PORT=5000
API_VERSION=v1

JWT_SECRET=vEgPP8X0829L1LFilcySFPM2Bhc0kDd2Mrd90uhREZyFy5rc+gY8/JFbWtrfadS46JDIGxzhbCuu1F5gaQOMBQ==
REFRESH_TOKEN_SECRET=452757dc9928f8adc6c6c1b598b544ad
SESSION_SECRET=f6a39ad7f121015434b6a6256a5712e9

SUPABASE_URL=https://gwgjckczyscpaozlevpe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTExNzMsImV4cCI6MjA3MjQ4NzE3M30.gKKl8PoJ7vDt9UWwY9yQv_V3Qr_hA5KsrwjK__XU1Bo
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMTE3MywiZXhwIjoyMDcyNDg3MTczfQ.YW8MY5qNLKMwfeSrIHjIDTN42HgeiQ6YRBZ-McyPXGM

OPENROUTER_API_KEY=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
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet:20241022
OPENROUTER_TEMPERATURE=0.7
OPENROUTER_MAX_TOKENS=2000

CORS_ORIGIN=*
FRONTEND_URL=https://day-dream-dictionary.onrender.com

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

FREE_DEEP_INTERPRETATIONS_MONTHLY=1000
FREE_BASIC_INTERPRETATIONS_MONTHLY=1000

JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

MONGODB_URI=
```

## Important Notes:
- Variable names are CASE SENSITIVE
- Variable names must be EXACT (no typos)
- `NODE_ENV` not `env`
- No spaces in variable names
- No special characters except underscores

## After Fixing:
1. Save Changes
2. Wait for redeployment
3. Test: https://day-dream-dictionary-api.onrender.com/health

The error should be resolved once the variable names are correct!