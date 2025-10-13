-- Day Dream Dictionary - Supabase Database Setup
-- Run this script in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'incomplete', 'trialing');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    locale TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role user_role DEFAULT 'user',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create credits table
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    balance INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    last_reset TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT,
    status subscription_status DEFAULT 'incomplete',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    plan_name TEXT,
    plan_id TEXT,
    price_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments_history table
CREATE TABLE IF NOT EXISTS payments_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stripe_payment_id TEXT,
    amount INTEGER, -- in cents
    currency TEXT DEFAULT 'usd',
    status TEXT,
    description TEXT,
    credits_added INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create dreams table (for storing dream interpretations)
CREATE TABLE IF NOT EXISTS dreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    dream_text TEXT NOT NULL,
    interpretation JSONB NOT NULL,
    interpretation_type TEXT DEFAULT 'basic',
    ai_model TEXT DEFAULT 'claude-3.5-sonnet',
    credits_used INTEGER DEFAULT 1,
    is_favorite BOOLEAN DEFAULT FALSE,
    tags TEXT[],
    mood TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create events table (for analytics)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments_history(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON dreams(created_at);
CREATE INDEX IF NOT EXISTS idx_dreams_is_favorite ON dreams(is_favorite);
CREATE INDEX IF NOT EXISTS idx_dreams_is_public ON dreams(is_public);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dreams_updated_at BEFORE UPDATE ON dreams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM roles
        WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
    )
);

-- Create RLS policies for roles
CREATE POLICY "Users can view own role" ON roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON roles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM roles r
        WHERE r.user_id = auth.uid() AND r.role = 'admin'
    )
);

-- Create RLS policies for credits
CREATE POLICY "Users can view own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON credits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can manage credits" ON credits FOR ALL USING (true);

-- Create RLS policies for subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for payments_history
CREATE POLICY "Users can view own payment history" ON payments_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON payments_history FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Create RLS policies for dreams
CREATE POLICY "Users can view own dreams" ON dreams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dreams" ON dreams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dreams" ON dreams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dreams" ON dreams FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view public dreams" ON dreams FOR SELECT USING (is_public = true);
CREATE POLICY "Admins can view all dreams" ON dreams FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Create RLS policies for events
CREATE POLICY "Users can view own events" ON events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own events" ON events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all events" ON events FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

    -- Create role (default to 'user')
    INSERT INTO public.roles (user_id, role)
    VALUES (NEW.id, 'user');

    -- Create credits (default to 5 for new users)
    INSERT INTO public.credits (user_id, balance)
    VALUES (NEW.id, 5);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role::TEXT
        FROM roles
        WHERE roles.user_id = $1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user credits
CREATE OR REPLACE FUNCTION public.get_user_credits(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT balance
        FROM credits
        WHERE credits.user_id = $1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert initial admin user (replace with your email)
-- Note: This should be done after setting up your Supabase project
-- You'll need to run this manually or through the dashboard:
-- INSERT INTO roles (user_id, role) VALUES ('your-admin-user-id', 'admin');

-- Create storage bucket for user uploads (if needed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies (if needed)
CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'user-uploads' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT USING (
    bucket_id = 'user-uploads' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Grant storage permissions
GRANT ALL ON storage.objects TO anon, authenticated;
GRANT ALL ON storage.buckets TO anon, authenticated;

-- Create some sample data for testing (optional)
-- This should be removed in production

-- Insert test admin role (replace with actual user ID)
-- INSERT INTO roles (user_id, role) VALUES ('test-admin-id', 'admin') ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Insert test credits for development
-- UPDATE credits SET balance = 100 WHERE user_id = 'test-user-id';

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE roles IS 'User roles and permissions';
COMMENT ON TABLE credits IS 'User credits for premium features';
COMMENT ON TABLE subscriptions IS 'Stripe subscription management';
COMMENT ON TABLE payments_history IS 'Payment transaction history';
COMMENT ON TABLE dreams IS 'Dream interpretations and user dream history';
COMMENT ON TABLE events IS 'User activity events for analytics';
