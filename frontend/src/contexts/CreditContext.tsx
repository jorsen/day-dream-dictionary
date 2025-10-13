'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface CreditContextType {
  credits: number;
  loading: boolean;
  refreshCredits: () => Promise<void>;
  useCredits: (amount: number) => Promise<{ success: boolean; error?: string }>;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
};

interface CreditProviderProps {
  children: React.ReactNode;
}

export const CreditProvider: React.FC<CreditProviderProps> = ({ children }) => {
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refreshCredits = async () => {
    if (!user) {
      setCredits(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching credits:', error);
        // Fallback to mock credits for development
        setCredits(5);
      } else {
        setCredits(data?.balance || 5);
      }
    } catch (error) {
      console.error('Error refreshing credits:', error);
      // Fallback to mock credits for development
      setCredits(5);
    } finally {
      setLoading(false);
    }
  };

  const useCredits = async (amount: number): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (credits < amount) {
      return { success: false, error: 'Insufficient credits' };
    }

    try {
      // Optimistically update UI
      setCredits(prev => prev - amount);

      // Update in database
      const { error } = await supabase.rpc('increment_total_spent', {
        user_id: user.id,
        amount: amount
      });

      if (error) {
        // Revert optimistic update on error
        setCredits(prev => prev + amount);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      // Revert optimistic update on error
      setCredits(prev => prev + amount);
      return { success: false, error: 'Failed to use credits' };
    }
  };

  useEffect(() => {
    refreshCredits();
  }, [user]);

  const value: CreditContextType = {
    credits,
    loading,
    refreshCredits,
    useCredits,
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
};
