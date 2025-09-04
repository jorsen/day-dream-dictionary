-- Create credit_bonuses table for dynamic credit system
CREATE TABLE IF NOT EXISTS public.credit_bonuses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_bonus INTEGER NOT NULL DEFAULT 0,
    welcome_bonus INTEGER NOT NULL DEFAULT 0,
    behavioral_bonus INTEGER NOT NULL DEFAULT 0,
    loyalty_tier TEXT NOT NULL DEFAULT 'bronze',
    subscription_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure only one record per user
    UNIQUE(user_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_credit_bonuses_user_id ON public.credit_bonuses(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_bonuses_loyalty_tier ON public.credit_bonuses(loyalty_tier);

-- Enable Row Level Security
ALTER TABLE public.credit_bonuses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own credit bonuses" ON public.credit_bonuses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit bonuses" ON public.credit_bonuses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert credit bonuses" ON public.credit_bonuses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update credit bonuses" ON public.credit_bonuses
    FOR UPDATE WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_credit_bonuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_credit_bonuses_updated_at
    BEFORE UPDATE ON public.credit_bonuses
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_bonuses_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.credit_bonuses TO authenticated;
GRANT ALL ON public.credit_bonuses TO service_role;
