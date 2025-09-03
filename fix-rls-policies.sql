-- Fix Row Level Security policies for profiles table
-- Run this in Supabase SQL Editor to allow profile creation during signup

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new policies that allow proper profile creation
-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- Also fix the same for other tables that might have issues
-- Fix credits table policies
DROP POLICY IF EXISTS "Users can view own credits" ON public.credits;
CREATE POLICY "Users can view own credits" 
ON public.credits FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits" 
ON public.credits FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Fix roles table policies
DROP POLICY IF EXISTS "Users can view own role" ON public.roles;
CREATE POLICY "Users can view own role" 
ON public.roles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own role" 
ON public.roles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Alternative: If the above doesn't work, temporarily disable RLS for testing
-- (uncomment these lines if needed)
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.credits DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'credits', 'roles')
ORDER BY tablename, cmd;