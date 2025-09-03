-- Create dreams table in Supabase
CREATE TABLE IF NOT EXISTS dreams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  dream_text TEXT NOT NULL,
  interpretation JSONB NOT NULL,
  metadata JSONB,
  user_context JSONB,
  tags TEXT[] DEFAULT '{}',
  is_recurring BOOLEAN DEFAULT false,
  recurring_dream_id UUID,
  locale VARCHAR(5) DEFAULT 'en',
  source VARCHAR(50) DEFAULT 'web',
  rating JSONB,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON dreams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_is_deleted ON dreams(is_deleted);
CREATE INDEX IF NOT EXISTS idx_dreams_is_recurring ON dreams(is_recurring);
CREATE INDEX IF NOT EXISTS idx_dreams_tags ON dreams USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own dreams
CREATE POLICY "Users can view own dreams" ON dreams
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own dreams
CREATE POLICY "Users can insert own dreams" ON dreams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own dreams
CREATE POLICY "Users can update own dreams" ON dreams
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own dreams (soft delete)
CREATE POLICY "Users can delete own dreams" ON dreams
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_dreams_updated_at
  BEFORE UPDATE ON dreams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON dreams TO authenticated;
GRANT SELECT ON dreams TO anon;