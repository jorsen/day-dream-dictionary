import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          locale: string;
          timezone: string;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          timezone?: string;
          preferences?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          timezone?: string;
          preferences?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'admin' | 'moderator';
          permissions: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: 'user' | 'admin' | 'moderator';
          permissions?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'user' | 'admin' | 'moderator';
          permissions?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };
      credits: {
        Row: {
          id: string;
          user_id: string;
          balance: number;
          total_earned: number;
          total_spent: number;
          last_reset: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          balance?: number;
          total_earned?: number;
          total_spent?: number;
          last_reset?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          balance?: number;
          total_earned?: number;
          total_spent?: number;
          last_reset?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      dreams: {
        Row: {
          id: string;
          user_id: string;
          dream_text: string;
          interpretation: Record<string, any>;
          interpretation_type: string;
          ai_model: string;
          credits_used: number;
          is_favorite: boolean;
          tags: string[] | null;
          mood: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          dream_text: string;
          interpretation: Record<string, any>;
          interpretation_type?: string;
          ai_model?: string;
          credits_used?: number;
          is_favorite?: boolean;
          tags?: string[] | null;
          mood?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          dream_text?: string;
          interpretation?: Record<string, any>;
          interpretation_type?: string;
          ai_model?: string;
          credits_used?: number;
          is_favorite?: boolean;
          tags?: string[] | null;
          mood?: string | null;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};
