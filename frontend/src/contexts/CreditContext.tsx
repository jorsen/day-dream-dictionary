'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CreditInfo {
  balance: number;
  dynamicInfo?: {
    loyaltyTier: string;
    subscriptionMultiplier: number;
    loyaltyMultiplier: number;
    availableBonusCredits: number;
  };
}

interface CreditContextType {
  creditInfo: CreditInfo | null;
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
  updateCredits: (newBalance: number) => void;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export function CreditProvider({ children }: { children: ReactNode }) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        setCreditInfo(null);
        setError(null);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/v1/payments/credits', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
        setError(null);
      } else if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        setCreditInfo(null);
        setError('Authentication required');
      } else {
        setError('Failed to load credit information');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const refreshCredits = async () => {
    await fetchCreditInfo();
  };

  const updateCredits = (newBalance: number) => {
    if (creditInfo) {
      setCreditInfo({
        ...creditInfo,
        balance: newBalance
      });
    }
  };

  useEffect(() => {
    fetchCreditInfo();

    // Refresh credit info every 30 seconds
    const interval = setInterval(fetchCreditInfo, 30000);

    // Listen for storage changes (login/logout)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        fetchCreditInfo();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value: CreditContextType = {
    creditInfo,
    loading,
    error,
    refreshCredits,
    updateCredits
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
}
