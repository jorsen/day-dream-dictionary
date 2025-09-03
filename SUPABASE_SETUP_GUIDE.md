# Supabase Setup Guide for Day Dream Dictionary

This guide will walk you through setting up Supabase for your Day Dream Dictionary application, including database tables, authentication, and security policies.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Access Your Supabase Project](#access-your-supabase-project)
3. [Database Schema Setup](#database-schema-setup)
4. [Authentication Setup](#authentication-setup)
5. [Row Level Security (RLS)](#row-level-security-rls)
6. [Testing Your Setup](#testing-your-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

✅ You already have:
- A Supabase project created (Project ID: `gwgjckczyscpaozlevpe`)
- Valid API keys configured in your `.env` file
- Connection to Supabase confirmed

## Access Your Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in with your account
3. Select your project: `gwgjckczyscpaozlevpe`
4. You should see the project dashboard

## Database Schema Setup

### Step 1: Navigate to SQL Editor

1. In your Supabase dashboard, click on **SQL Editor** in the left sidebar
2. Click **New Query** to create a new SQL script

### Step 2: Create Core Tables

Copy and paste this entire SQL script into the SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    date_of_birth DATE,
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'basic', 'pro')),
    status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create credits table
CREATE TABLE IF NOT EXISTS public.credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned INTEGER DEFAULT 0,
    lifetime_spent INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create dreams table
CREATE TABLE IF NOT EXISTS public.dreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    interpretation TEXT,
    interpretation_type TEXT CHECK (interpretation_type IN ('basic', 'deep')),
    mood TEXT,
    tags TEXT[],
    symbols TEXT[],
    is_recurring BOOLEAN DEFAULT FALSE,
    is_lucid BOOLEAN DEFAULT FALSE,
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
    dream_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create dream_interpretations table
CREATE TABLE IF NOT EXISTS public.dream_interpretations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dream_id UUID NOT NULL REFERENCES public.dreams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interpretation_type TEXT NOT NULL CHECK (interpretation_type IN ('basic', 'deep')),
    content TEXT NOT NULL,
    symbols_identified TEXT[],
    themes TEXT[],
    emotions TEXT[],
    credits_used INTEGER DEFAULT 1,
    ai_model TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create payments_history table
CREATE TABLE IF NOT EXISTS public.payments_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create roles table (for admin access)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'moderator')),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create usage_stats table
CREATE TABLE IF NOT EXISTS public.usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    basic_interpretations_used INTEGER DEFAULT 0,
    deep_interpretations_used INTEGER DEFAULT 0,
    dreams_created INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month, year)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON public.dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON public.dreams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_interpretations_dream_id ON public.dream_interpretations(dream_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_month_year ON public.usage_stats(user_id, month, year);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON public.credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dreams_updated_at BEFORE UPDATE ON public.dreams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

3. Click **Run** to execute the SQL script
4. You should see a success message indicating all tables were created

### Step 3: Create Functions for User Management

Add these helper functions by creating a new query:

```sql
-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    -- Initialize credits (5 free credits for new users)
    INSERT INTO public.credits (user_id, balance, lifetime_earned)
    VALUES (NEW.id, 5, 5);
    
    -- Create free subscription
    INSERT INTO public.subscriptions (user_id, plan_type, status)
    VALUES (NEW.id, 'free', 'active');
    
    -- Set default role
    INSERT INTO public.roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    -- Initialize usage stats for current month
    INSERT INTO public.usage_stats (user_id, month, year)
    VALUES (NEW.id, EXTRACT(MONTH FROM NOW()), EXTRACT(YEAR FROM NOW()));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user data on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check user's interpretation quota
CREATE OR REPLACE FUNCTION public.check_interpretation_quota(
    p_user_id UUID,
    p_interpretation_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_subscription_type TEXT;
    v_current_month INTEGER;
    v_current_year INTEGER;
    v_basic_used INTEGER;
    v_deep_used INTEGER;
    v_credits INTEGER;
    v_limit INTEGER;
BEGIN
    -- Get current month and year
    v_current_month := EXTRACT(MONTH FROM NOW());
    v_current_year := EXTRACT(YEAR FROM NOW());
    
    -- Get user's subscription type
    SELECT plan_type INTO v_subscription_type
    FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1;
    
    -- Get user's credits
    SELECT balance INTO v_credits
    FROM public.credits
    WHERE user_id = p_user_id;
    
    -- Get current month usage
    SELECT basic_interpretations_used, deep_interpretations_used
    INTO v_basic_used, v_deep_used
    FROM public.usage_stats
    WHERE user_id = p_user_id 
    AND month = v_current_month 
    AND year = v_current_year;
    
    -- Check based on subscription type
    IF v_subscription_type = 'pro' THEN
        RETURN TRUE; -- Unlimited for pro users
    ELSIF v_subscription_type = 'basic' THEN
        v_limit := 50; -- 50 interpretations per month for basic
        RETURN (v_basic_used + v_deep_used) < v_limit;
    ELSE -- free tier
        IF p_interpretation_type = 'deep' THEN
            RETURN v_deep_used < 3 AND v_credits >= 3;
        ELSE
            RETURN v_basic_used < 5 AND v_credits >= 1;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Row Level Security (RLS)

### Step 4: Enable RLS and Create Policies

Run this SQL to enable Row Level Security:

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dream_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Dreams policies
CREATE POLICY "Users can view own dreams" ON public.dreams
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own dreams" ON public.dreams
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dreams" ON public.dreams
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dreams" ON public.dreams
    FOR DELETE USING (auth.uid() = user_id);

-- Dream interpretations policies
CREATE POLICY "Users can view own interpretations" ON public.dream_interpretations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interpretations" ON public.dream_interpretations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Credits policies
CREATE POLICY "Users can view own credits" ON public.credits
    FOR SELECT USING (auth.uid() = user_id);

-- Payments history policies
CREATE POLICY "Users can view own payments" ON public.payments_history
    FOR SELECT USING (auth.uid() = user_id);

-- Roles policies
CREATE POLICY "Users can view own role" ON public.roles
    FOR SELECT USING (auth.uid() = user_id);

-- Usage stats policies
CREATE POLICY "Users can view own usage stats" ON public.usage_stats
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (optional - for admin panel)
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.user_id = auth.uid()
            AND roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can view all dreams" ON public.dreams
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.user_id = auth.uid()
            AND roles.role = 'admin'
        )
    );
```

## Authentication Setup

### Step 5: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Enable **Email** provider (should be enabled by default)
3. Configure email settings:
   - **Enable Email Confirmations**: Toggle ON for production
   - **Enable Email Change Confirmations**: Toggle ON
   
4. (Optional) Enable social providers:
   - Click on **Google** and add your OAuth credentials
   - Click on **GitHub** and add your OAuth credentials

### Step 6: Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize the templates for:
   - Confirmation Email
   - Password Recovery
   - Magic Link
   - Email Change

## Testing Your Setup

### Step 7: Test Database Connection

Run the test script you already have:

```bash
cd backend
node test-supabase-connection.js
```

### Step 8: Test Table Creation

In the SQL Editor, run this query to verify tables exist:

```sql
-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check row counts
SELECT 
    'profiles' as table_name, COUNT(*) as row_count FROM public.profiles
UNION ALL
SELECT 'dreams', COUNT(*) FROM public.dreams
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM public.subscriptions
UNION ALL
SELECT 'credits', COUNT(*) FROM public.credits;
```

### Step 9: Create a Test User

You can create a test user using the Supabase dashboard:

1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter email and password
4. Click **Create user**

Or use this SQL to create a test user with all related data:

```sql
-- Note: This is for testing only. In production, users should sign up through your app
-- First, create the user in auth.users (this would normally be done via Supabase Auth)
-- The trigger will automatically create related records in other tables
```

## Environment Variables Reference

Your `.env` file should have these Supabase-related variables:

```env
# Supabase Configuration
SUPABASE_URL=https://gwgjckczyscpaozlevpe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints to Test

Once your backend is running, you can test these endpoints:

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user

### Dreams
- `GET /api/v1/dreams` - Get user's dreams
- `POST /api/v1/dreams` - Create new dream
- `POST /api/v1/dreams/:id/interpret` - Get dream interpretation

## Troubleshooting

### Common Issues and Solutions

1. **"Table does not exist" error**
   - Run the SQL scripts in Step 2 to create tables
   - Check you're in the correct project

2. **"Invalid API key" error**
   - Verify your API keys start with `eyJ`
   - Check keys match your project
   - Regenerate keys if needed (Settings → API)

3. **"Permission denied" error**
   - Check RLS policies are correctly set
   - Verify user is authenticated
   - Check user has required role

4. **Connection timeout**
   - Check your internet connection
   - Verify Supabase project is not paused
   - Check if you're hitting rate limits

### Resetting Everything

If you need to start over:

```sql
-- WARNING: This will delete all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then run all the CREATE TABLE scripts again
```

## Next Steps

1. ✅ Database tables created
2. ✅ RLS policies configured
3. ✅ Authentication set up
4. 🔄 Test with your backend API
5. 🔄 Connect frontend to Supabase
6. 🔄 Implement Stripe webhooks for subscriptions
7. 🔄 Set up production environment

## Useful Supabase Dashboard Links

- **SQL Editor**: Write and execute SQL queries
- **Table Editor**: Visual interface to view/edit data
- **Authentication**: Manage users and auth settings
- **Database**: View tables, functions, and triggers
- **API Docs**: Auto-generated API documentation
- **Logs**: View database and auth logs

## Support Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [SQL Reference](https://supabase.com/docs/guides/database)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**Note**: This guide sets up the complete database schema for your Day Dream Dictionary app. Make sure to test each component thoroughly before deploying to production.