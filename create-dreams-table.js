const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwgjckczyscpaozlevpe.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Z2pja2N6eXNjcGFvemxldnBlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjkxMTE3MywiZXhwIjoyMDcyNDg3MTczfQ.YW8MY5qNLKMwfeSrIHjIDTN42HgeiQ6YRBZ-McyPXGM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDreamsTable() {
  try {
    console.log('Creating dreams table...');

    // First, let's check if the table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('dreams')
      .select('*')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.log('Dreams table does not exist. Creating it...');

      // Create the table using raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE dreams (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL,
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
        `
      });

      if (error) {
        console.log('Error creating table with RPC:', error);
        console.log('Trying direct table creation...');

        // Try inserting a test record to create the table
        const testDream = {
          user_id: '00000000-0000-0000-0000-000000000000',
          dream_text: 'Test dream',
          interpretation: { test: true }
        };

        const { data: insertData, error: insertError } = await supabase
          .from('dreams')
          .insert([testDream]);

        if (insertError && insertError.code === '42P01') {
          console.log('Table creation failed. Please create the dreams table manually in Supabase dashboard.');
          console.log('Use this SQL:');
          console.log(`
CREATE TABLE dreams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
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
          `);
        } else if (insertError) {
          console.log('Insert error:', insertError);
        } else {
          console.log('✅ Dreams table created and test record inserted!');
        }
      } else {
        console.log('✅ Dreams table created successfully with RPC!');
      }
    } else if (checkError) {
      console.log('Error checking table:', checkError);
    } else {
      console.log('✅ Dreams table already exists!');
    }

  } catch (err) {
    console.log('Failed:', err.message);
  }
}

createDreamsTable();
