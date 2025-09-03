-- ============================================
-- Day Dream Dictionary - Complete Database Setup
-- Run this entire script in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: CREATE ALL TABLES
-- ============================================

-- 1. Profiles table (extends Supabase auth.users)
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

-- 2. Subscriptions table
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

-- 3. Credits table
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

-- 4. Dreams table
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

-- 5. Dream interpretations table
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

-- 6. Payments history table
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

-- 7. Roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'moderator')),
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Usage stats table
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

-- ============================================
-- STEP 2: CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON public.dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON public.dreams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_interpretations_dream_id ON public.dream_interpretations(dream_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_stats_user_month_year ON public.usage_stats(user_id, month, year);

-- ============================================
-- STEP 3: CREATE TRIGGER FUNCTIONS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
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

-- ============================================
-- STEP 4: CREATE USER MANAGEMENT FUNCTIONS
-- ============================================

-- Handle new user signup
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

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Check interpretation quota function
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
    v_current_month := EXTRACT(MONTH FROM NOW());
    v_current_year := EXTRACT(YEAR FROM NOW());
    
    SELECT plan_type INTO v_subscription_type
    FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active'
    LIMIT 1;
    
    SELECT balance INTO v_credits
    FROM public.credits
    WHERE user_id = p_user_id;
    
    SELECT basic_interpretations_used, deep_interpretations_used
    INTO v_basic_used, v_deep_used
    FROM public.usage_stats
    WHERE user_id = p_user_id 
    AND month = v_current_month 
    AND year = v_current_year;
    
    IF v_subscription_type = 'pro' THEN
        RETURN TRUE;
    ELSIF v_subscription_type = 'basic' THEN
        v_limit := 50;
        RETURN (COALESCE(v_basic_used, 0) + COALESCE(v_deep_used, 0)) < v_limit;
    ELSE
        IF p_interpretation_type = 'deep' THEN
            RETURN COALESCE(v_deep_used, 0) < 3 AND COALESCE(v_credits, 0) >= 3;
        ELSE
            RETURN COALESCE(v_basic_used, 0) < 5 AND COALESCE(v_credits, 0) >= 1;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dream_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: CREATE RLS POLICIES
-- ============================================

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

-- Admin policies
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

-- ============================================
-- STEP 7: VERIFY SETUP
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';
    
    RAISE NOTICE '✅ Setup Complete!';
    RAISE NOTICE '   - Tables created: %', table_count;
    RAISE NOTICE '   - RLS policies created: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '   1. Create a test user in Authentication → Users';
    RAISE NOTICE '   2. Test your backend API endpoints';
    RAISE NOTICE '   3. Configure email templates if needed';
END $$;

-- ============================================
-- VERIFICATION QUERIES (Run these separately to check)
-- ============================================

-- Check all tables
SELECT table_name, 
       CASE 
           WHEN table_name IN ('profiles', 'dreams', 'subscriptions', 'credits', 
                               'dream_interpretations', 'payments_history', 'roles', 'usage_stats')
           THEN '✅ Created'
           ELSE '❌ Missing'
       END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, 
       CASE WHEN rowsecurity THEN '✅ RLS Enabled' ELSE '❌ RLS Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;