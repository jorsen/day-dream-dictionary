-- Fix profiles table to match the application requirements
-- Run this in Supabase SQL Editor after running the main setup script

-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Update the handle_new_user function to not insert display_name
-- (it will be added later when the user profile is created)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile with minimal data
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Initialize credits (5 free credits for new users)
    INSERT INTO public.credits (user_id, balance, lifetime_earned)
    VALUES (NEW.id, 5, 5)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create free subscription
    INSERT INTO public.subscriptions (user_id, plan_type, status)
    VALUES (NEW.id, 'free', 'active');
    
    -- Set default role
    INSERT INTO public.roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Initialize usage stats for current month
    INSERT INTO public.usage_stats (user_id, month, year)
    VALUES (NEW.id, EXTRACT(MONTH FROM NOW()), EXTRACT(YEAR FROM NOW()))
    ON CONFLICT (user_id, month, year) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;